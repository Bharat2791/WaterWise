from collections import Counter
from datetime import datetime, timedelta


def build_dashboard_payload(complaints):
    total = len(complaints)
    open_items = sum(1 for c in complaints if c.status != "Resolved")
    critical = sum(1 for c in complaints if c.severity == "CRITICAL")
    high_risk = sum(1 for c in complaints if c.predicted_maintenance in {"HIGH", "CRITICAL"})
    affected_population = sum(c.affected_people for c in complaints)
    issue_counts = Counter(c.issue_type for c in complaints)
    severity_counts = Counter(c.severity for c in complaints)
    location_counts = Counter(c.location for c in complaints)
    recent = sum(1 for c in complaints if c.date >= datetime.utcnow() - timedelta(days=7))
    prev_week = sum(1 for c in complaints if datetime.utcnow() - timedelta(days=14) <= c.date < datetime.utcnow() - timedelta(days=7))
    trend_change = round(((recent - prev_week) / max(prev_week, 1)) * 100, 1)
    return {
        "total_complaints": total,
        "open_complaints": open_items,
        "critical_issues": critical,
        "high_risk_areas": high_risk,
        "affected_population": affected_population,
        "trend_change": trend_change,
        "issues": {k: v for k, v in issue_counts.items()},
        "severity": {k: v for k, v in severity_counts.items()},
        "areas": {k: v for k, v in location_counts.items()},
        "recent_7_days": recent,
    }


def build_trend_series(complaints):
    output = []
    for days_back in range(14, -1, -1):
        target = (datetime.utcnow() - timedelta(days=days_back)).date()
        count = sum(1 for c in complaints if c.date.date() == target)
        output.append({"date": target.isoformat(), "complaints": count})
    return output


def build_issue_distribution(complaints):
    counts = Counter(c.issue_type for c in complaints)
    return [{"name": key, "value": value} for key, value in counts.items()]


def build_severity_distribution(complaints):
    counts = Counter(c.severity for c in complaints)
    order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    return [{"name": sev, "value": counts.get(sev, 0)} for sev in order]
