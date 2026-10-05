from datetime import datetime, timedelta


def severity_weight(severity: str) -> int:
    mapping = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
    return mapping.get(severity, 1)


def calculate_area_risk(area_group):
    complaint_count = len(area_group)
    recent_count = sum(1 for c in area_group if c.date >= datetime.utcnow() - timedelta(days=7))
    avg_severity = sum(severity_weight(c.severity) for c in area_group) / max(complaint_count, 1)
    affected = sum(c.affected_people for c in area_group)
    recurrence = sum(1 for c in area_group if c.status in {"Open", "In Progress"})
    score = (complaint_count * 3) + (recent_count * 5) + (avg_severity * 10) + (affected / 30) + (recurrence * 4)
    if score >= 80:
        risk = "HIGH"
    elif score >= 45:
        risk = "MEDIUM"
    else:
        risk = "LOW"
    confidence = min(97, round((score / 120) * 100, 1))
    return {
        "risk": risk,
        "confidence": confidence,
        "score": round(score, 1),
        "reasons": [
            f"{recent_count} complaints in the last 7 days",
            f"Average severity of {avg_severity:.1f}/4",
            f"{affected} residents affected",
            f"{recurrence} recurring operational issues" if recurrence else "Stable recurrence pattern"
        ]
    }
