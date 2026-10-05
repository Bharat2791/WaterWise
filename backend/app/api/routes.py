from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.complaint import Complaint
from app.models.user import User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.services.analytics_service import build_dashboard_payload, build_issue_distribution, build_severity_distribution, build_trend_series
from app.services.auth_service import create_access_token, decode_access_token, hash_password, verify_password
from app.services.hotspot_service import generate_hotspots
from app.services.maintenance_service import calculate_area_risk
from app.services.nlp_engine import analyze_complaint
from app.services.priority_service import calculate_priority

router = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sign in to access this resource.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise unauthorized
    try:
        claims = decode_access_token(token)
    except ValueError:
        raise unauthorized
    user = db.query(User).filter(User.id == claims["sub"]).first()
    if not user or user.role != claims["role"]:
        raise unauthorized
    return user


def require_role(user: User, role: str) -> None:
    if user.role != role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Your account does not have access to this action.")


def auth_response(user: User) -> dict:
    return {
        "access_token": create_access_token(user.id, user.role),
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email, "role": user.role},
    }


def coerce_datetime(value):
    if value is None:
        return datetime.utcnow()
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            try:
                return datetime.strptime(value, "%Y-%m-%d")
            except ValueError:
                return datetime.utcnow()
    return datetime.utcnow()


@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        database_status = "Connected"
    except Exception:
        database_status = "Degraded"
    return {
        "status": "ok",
        "backend": "Connected",
        "database": database_status,
        "ai_engine": "Ready",
        "gis": "Ready",
        "timestamp": datetime.utcnow().isoformat(),
    }


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User.id).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    user = User(email=payload.email, password_hash=hash_password(payload.password), role=payload.role)
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="An account with this email already exists.")
    db.refresh(user)
    return {"success": True, "message": "Account created. Sign in with your new credentials.", "user": {"id": user.id, "email": user.email, "role": user.role}}


@router.post("/auth/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or user.role != payload.role or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email, password, or account type.")
    return auth_response(user)


@router.get("/auth/me")
def current_user_profile(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email, "role": user.role}


@router.post("/complaints/analyze")
def analyze_complaint_request(payload: dict, user: User = Depends(get_current_user)):
    require_role(user, "citizen")
    complaint_text = payload.get("complaint_text")
    if not complaint_text or len(str(complaint_text).strip()) < 8:
        raise HTTPException(status_code=400, detail="Complaint text is required and must be meaningful.")
    result = analyze_complaint(str(complaint_text), payload.get("location"))
    return {"success": True, "analysis": result}


@router.post("/complaints", status_code=status.HTTP_201_CREATED)
def create_complaint(payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "citizen")
    complaint_text = payload.get("complaint_text")
    if not complaint_text:
        raise HTTPException(status_code=400, detail="Complaint text is required")
    analysis = analyze_complaint(str(complaint_text), payload.get("location"))
    date = coerce_datetime(payload.get("date"))
    lat = float(payload.get("latitude") or 19.0770)
    lon = float(payload.get("longitude") or 73.0094)
    location = payload.get("location") or analysis["location"]
    issue_type = ", ".join(analysis["issue_types"])
    severity = payload.get("severity") or analysis["severity"]
    status_val = payload.get("status") or "Open"
    affected_people = int(payload.get("affected_people") or max(50, len(complaint_text.split()) * 4))
    risk = payload.get("predicted_maintenance") or "MEDIUM"
    score = float(payload.get("priority_score") or max(40, min(95, 45 + len(issue_type.split(",")) * 18)))
    record = Complaint(
        submitted_by_id=user.id,
        complaint_text=str(complaint_text),
        date=date,
        issue_type=issue_type,
        location=location,
        latitude=lat,
        longitude=lon,
        severity=severity,
        status=status_val,
        affected_people=affected_people,
        duration=payload.get("duration") or analysis["duration"],
        predicted_maintenance=risk,
        maintenance_confidence=float(payload.get("maintenance_confidence") or analysis["confidence"] * 100),
        priority_score=score,
        priority_level=payload.get("priority_level") or ("CRITICAL" if score >= 80 else "HIGH" if score >= 60 else "MEDIUM" if score >= 40 else "LOW"),
        priority_reason=payload.get("priority_reason") or "; ".join(analysis["explanation"]),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/complaints")
def list_complaints(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    issue: Optional[str] = None,
    location: Optional[str] = None,
    search: Optional[str] = None,
):
    query = db.query(Complaint)
    if user.role == "citizen":
        query = query.filter(Complaint.submitted_by_id == user.id)
    if status:
        query = query.filter(Complaint.status == status)
    if severity:
        query = query.filter(Complaint.severity == severity)
    if issue:
        query = query.filter(Complaint.issue_type.ilike(f"%{issue}%"))
    if location:
        query = query.filter(Complaint.location.ilike(f"%{location}%"))
    if search:
        search_value = f"%{search}%"
        query = query.filter((Complaint.complaint_text.ilike(search_value)) | (Complaint.location.ilike(search_value)))
    items = query.order_by(Complaint.date.desc()).offset(skip).limit(limit).all()
    return items


@router.get("/complaints/{complaint_id}")
def get_complaint(complaint_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    record = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not record or (user.role == "citizen" and record.submitted_by_id != user.id):
        raise HTTPException(status_code=404, detail="Complaint not found")
    return record


@router.put("/complaints/{complaint_id}")
def update_complaint(complaint_id: int, payload: dict, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    record = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Complaint not found")
    for key, value in payload.items():
        if hasattr(record, key) and value is not None:
            setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/complaints/{complaint_id}")
def delete_complaint(complaint_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    record = db.query(Complaint).filter(Complaint.id == complaint_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Complaint not found")
    db.delete(record)
    db.commit()
    return {"success": True, "deleted_id": complaint_id}


@router.post("/complaints/upload")
def upload_complaints(file: UploadFile = File(...), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".csv") or filename_lower.endswith(".xlsx")):
        raise HTTPException(status_code=400, detail="Only CSV or XLSX files are allowed")
    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    import io
    import pandas as pd

    df = pd.read_csv(io.BytesIO(contents)) if filename_lower.endswith(".csv") else pd.read_excel(io.BytesIO(contents))
    required = ["complaint_text", "date", "location", "latitude", "longitude", "severity", "status", "affected_people"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {missing}")
    created = []
    for _, row in df.iterrows():
        complaint_text = str(row.get("complaint_text") or "").strip()
        if not complaint_text:
            continue
        analysis = analyze_complaint(complaint_text, row.get("location"))
        record = Complaint(
            complaint_text=complaint_text,
            date=coerce_datetime(row.get("date") if row.get("date") else datetime.utcnow()),
            issue_type=row.get("issue_type") or ", ".join(analysis["issue_types"]),
            location=row.get("location") or analysis["location"],
            latitude=float(row.get("latitude") or 19.0770),
            longitude=float(row.get("longitude") or 73.0094),
            severity=str(row.get("severity") or analysis["severity"]).upper(),
            status=str(row.get("status") or "Open").title(),
            affected_people=int(row.get("affected_people") or 0),
            duration=row.get("duration") or analysis["duration"],
            predicted_maintenance=row.get("predicted_maintenance") or "MEDIUM",
            maintenance_confidence=float(row.get("maintenance_confidence") or analysis["confidence"] * 100),
            priority_score=float(row.get("priority_score") or 55),
            priority_level=row.get("priority_level") or "MEDIUM",
            priority_reason=row.get("priority_reason") or "; ".join(analysis["explanation"]),
        )
        db.add(record)
        created.append(record)
    db.commit()
    return {"success": True, "count": len(created), "records": [c.id for c in created]}


@router.get("/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    complaints = db.query(Complaint).all()
    return build_dashboard_payload(complaints)


@router.get("/hotspots")
def hotspots(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    complaints = db.query(Complaint).order_by(Complaint.date.desc()).all()
    return generate_hotspots(complaints)


@router.get("/predictions")
def predictions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    complaints = db.query(Complaint).all()
    grouped = {}
    for c in complaints:
        grouped.setdefault(c.location, []).append(c)
    results = []
    for location, area_items in grouped.items():
        risk = calculate_area_risk(area_items)
        results.append({
            "area": location,
            "risk": risk["risk"],
            "confidence": risk["confidence"],
            "score": risk["score"],
            "reasons": risk["reasons"],
            "complaint_count": len(area_items),
        })
    return sorted(results, key=lambda x: x["score"], reverse=True)


@router.get("/areas")
def areas(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    complaints = db.query(Complaint).all()
    grouped = {}
    for c in complaints:
        grouped.setdefault(c.location, {"complaints": 0, "affected_population": 0, "issue": c.issue_type})
        grouped[c.location]["complaints"] += 1
        grouped[c.location]["affected_population"] += c.affected_people
    return [{"location": name, "complaints": item["complaints"], "affected_population": item["affected_population"], "issue": item["issue"]} for name, item in grouped.items()]


@router.get("/alerts")
def alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    complaints = db.query(Complaint).all()
    items = []
    for c in complaints[:10]:
        if c.severity in {"HIGH", "CRITICAL"}:
            items.append({
                "id": f"ALERT-{c.id}",
                "severity": c.severity,
                "timestamp": c.date.isoformat(),
                "area": c.location,
                "description": f"{c.issue_type} complaint requires operational attention.",
                "related_complaints": [c.id],
                "recommended_attention": "Escalate to asset maintenance team.",
                "reviewed": False,
            })
    if not items:
        items.append({
            "id": "ALERT-DEFAULT",
            "severity": "LOW",
            "timestamp": datetime.utcnow().isoformat(),
            "area": "System",
            "description": "No immediate operational alerts in the current dataset.",
            "related_complaints": [],
            "recommended_attention": "Continue routine monitoring.",
            "reviewed": False,
        })
    return items


@router.get("/analytics")
def analytics(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    require_role(user, "receiver")
    complaints = db.query(Complaint).order_by(Complaint.date.asc()).all()
    return {
        "trend_series": build_trend_series(complaints),
        "issue_distribution": build_issue_distribution(complaints),
        "severity_distribution": build_severity_distribution(complaints),
        "hotspots": generate_hotspots(complaints),
        "priority_ranking": calculate_priority(complaints)[:10],
    }
