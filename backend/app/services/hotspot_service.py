from collections import Counter
from datetime import datetime, timedelta

import numpy as np
from sklearn.cluster import DBSCAN


SEVERITY_SCORE = {"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


def generate_hotspots(complaints):
    if len(complaints) < 3:
        return []

    coords = [(c.latitude, c.longitude) for c in complaints if c.latitude is not None and c.longitude is not None]
    if len(coords) < 3:
        return []

    clustering = DBSCAN(eps=0.02, min_samples=3).fit(np.array(coords))
    labels = clustering.labels_
    clusters = {}
    for idx, label in enumerate(labels):
        if label == -1:
            continue
        clusters.setdefault(int(label), []).append(complaints[idx])

    hotspots = []
    for label, items in clusters.items():
        if len(items) < 3:
            continue
        issue_counter = Counter(c.issue_type for c in items)
        dominant_issue = issue_counter.most_common(1)[0][0]
        avg_severity = sum(SEVERITY_SCORE.get(c.severity, 1) for c in items) / len(items)
        recent_count = sum(1 for c in items if c.date >= datetime.utcnow() - timedelta(days=7))
        affected = sum(c.affected_people for c in items)
        complaints_last_7 = sum(1 for c in items if c.date >= datetime.utcnow() - timedelta(days=7))
        complaints_prev_7 = sum(1 for c in items if datetime.utcnow() - timedelta(days=14) <= c.date < datetime.utcnow() - timedelta(days=7))
        growth = round(((complaints_last_7 - complaints_prev_7) / max(complaints_prev_7, 1)) * 100, 1)
        hotspot_score = min(100, round((len(items) * 12) + (avg_severity * 8) + (recent_count * 3), 1))
        maintenance_risk = "HIGH" if hotspot_score > 70 else "MEDIUM" if hotspot_score > 45 else "LOW"
        hotspots.append({
            "id": f"HOTSPOT-{label + 1}",
            "location": items[0].location,
            "complaint_count": len(items),
            "dominant_issue": dominant_issue,
            "average_severity": avg_severity,
            "average_severity_label": "HIGH" if avg_severity >= 3 else "MEDIUM" if avg_severity >= 2 else "LOW",
            "recent_count": recent_count,
            "growth": growth,
            "affected_population": affected,
            "hotspot_score": hotspot_score,
            "maintenance_risk": maintenance_risk,
            "lat": float(np.mean([c.latitude for c in items])),
            "lng": float(np.mean([c.longitude for c in items])),
        })
    return sorted(hotspots, key=lambda x: x["complaint_count"], reverse=True)
