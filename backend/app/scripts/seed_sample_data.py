import random
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models.complaint import Complaint

LOCATION_MAP = {
    "Vashi": (19.0770, 73.0094),
    "Nerul": (19.0330, 73.0211),
    "Thane": (19.2183, 72.9781),
    "Airoli": (19.1547, 72.9994),
    "Kopar Khairane": (19.1184, 73.0047),
    "Sanpada": (19.0850, 73.0060),
    "Belapur": (19.0177, 73.0458),
    "Ghansoli": (19.1297, 73.0044),
    "Seawoods": (19.0197, 73.0188),
    "Turbhe": (19.0676, 73.0055),
}

TEMPLATES = [
    "There has been no water in {location} for {days} days and a pipeline is leaking near the station.",
    "Low water pressure is affecting homes in {location}; residents report weak flow for {days} days.",
    "The supply is interrupted in {location} and water is contaminated in the main line.",
    "A pipeline is damaged near {location} and water is leaking onto the road.",
    "Residents in {location} have had no water supply for {days} days and complain of low pressure.",
    "The water in {location} has a bad smell and residents say it is dirty and unsafe.",
    "The pipeline near the bus stop in {location} has burst, causing significant leakage.",
    "There is no running water across {location} for {days} days and the issue is spreading to nearby blocks.",
]


def ensure_sample_data():
    engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}, future=True)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    db = Session()
    count = db.query(Complaint).count()
    if count >= 100:
        db.close()
        return
    random.seed(42)
    complaint_records = []
    for index in range(1, 121):
        location = random.choice(list(LOCATION_MAP.keys()))
        days = random.randint(1, 12)
        template = random.choice(TEMPLATES)
        text = template.format(location=location, days=days)
        issue_types = ["Water Shortage", "Leakage"] if "leaking" in text.lower() or "no water" in text.lower() else ["Low Pressure"] if "pressure" in text.lower() else ["Contamination"] if "smell" in text.lower() or "dirty" in text.lower() else ["Supply Interruption"]
        severity = random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"])
        if "no water" in text.lower() or "supply" in text.lower() or "pipeline" in text.lower():
            severity = random.choice(["HIGH", "CRITICAL"])
        lat, lon = LOCATION_MAP[location]
        lat += random.uniform(-0.0100, 0.0100)
        lon += random.uniform(-0.0080, 0.0080)
        complaint_records.append(
            Complaint(
                complaint_text=text,
                date=(datetime.utcnow() - timedelta(days=random.randint(0, 30), hours=random.randint(1, 18))),
                issue_type=", ".join(issue_types),
                location=location,
                latitude=round(lat, 5),
                longitude=round(lon, 5),
                severity=severity,
                status=random.choice(["Open", "In Progress", "Resolved"]),
                affected_people=random.randint(50, 1800),
                duration=f"{days} days",
                predicted_maintenance=random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
                maintenance_confidence=random.randint(62, 94),
                priority_score=random.randint(46, 96),
                priority_level=random.choice(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
                priority_reason="Generated from realistic urban complaint patterns and connected infrastructure diagnostics.",
            )
        )
    db.add_all(complaint_records)
    db.commit()
    db.close()
