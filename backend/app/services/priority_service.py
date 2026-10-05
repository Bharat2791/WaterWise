
def calculate_priority(complaints):
    if not complaints:
        return []
    grouped = {}
    for item in complaints:
        grouped.setdefault(item.location, []).append(item)
    priorities = []
    for location, area_items in grouped.items():
        recent = len(area_items)
        severity_total = sum({"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}.get(c.severity, 1) for c in area_items)
        affected = sum(c.affected_people for c in area_items)
        maintenance = max({"LOW": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}.get(c.predicted_maintenance, 1) for c in area_items)
        hotspot = max(c.priority_score for c in area_items) if area_items else 0
        score = min(100, round((severity_total * 7) + (affected / 20) + (recent * 4) + (maintenance * 9) + (hotspot * 0.6), 1))
        if score >= 85:
            level = "CRITICAL"
        elif score >= 65:
            level = "HIGH"
        elif score >= 45:
            level = "MEDIUM"
        else:
            level = "LOW"
        reason = (
            f"{len(area_items)} complaints in area, {affected} residents affected, "
            f"dominant maintenance risk {max(c.predicted_maintenance for c in area_items)}"
        )
        priorities.append({
            "location": location,
            "priority_score": score,
            "priority_level": level,
            "complaint_count": len(area_items),
            "affected_population": affected,
            "dominant_issue": max(set(c.issue_type.split(',')[0] for c in area_items), key=lambda s: sum(1 for c in area_items if c.issue_type.startswith(s))),
            "reason": reason,
        })
    return sorted(priorities, key=lambda item: item["priority_score"], reverse=True)
