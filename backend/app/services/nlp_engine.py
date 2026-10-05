import re
from typing import Dict, List

AREA_LIBRARY = [
    "Vashi", "Nerul", "Thane", "Airoli", "Kopar Khairane", "Sanpada", "Belapur", "Ghansoli",
    "Seawoods", "Turbhe", "Panvel", "Kharghar", "Mulund", "Andheri", "Chembur", "Wadala"
]

ISSUE_KEYWORDS = {
    "Water Shortage": ["no water", "water shortage", "no supply", "water not available", "dry tap", "water scarcity", "without water", "no running water"],
    "Leakage": ["leaking", "leakage", "pipe leak", "pipeline leaking", "burst pipe", "water leaking", "dripping pipe", "broken pipe"],
    "Low Pressure": ["low pressure", "weak pressure", "pressure drop", "slow flow", "poor pressure", "low flow"],
    "Contamination": ["dirty water", "contaminated", "brown water", "yellow water", "rusted water", "muddy water", "smell", "bad taste"],
    "Supply Interruption": ["supply interrupted", "water cut", "interruption", "supply off", "outage", "stopped supply"],
    "Pipeline Damage": ["pipeline damage", "damaged pipeline", "cracked pipe", "broken line", "road cave in", "cavity", "pipe burst"],
}

SEVERITY_RULES = {
    "Water Shortage": 2,
    "Leakage": 2,
    "Contamination": 3,
    "Supply Interruption": 3,
    "Pipeline Damage": 3,
    "Low Pressure": 1,
    "Other": 1,
}


def clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def tokenize(text: str) -> List[str]:
    return re.findall(r"[a-zA-Z]+(?:'[a-zA-Z]+)?", text.lower())


def detect_location(text: str) -> str:
    for area in AREA_LIBRARY:
        if area.lower() in text.lower():
            return area
    return "Unknown Area"


def detect_duration(text: str) -> str:
    patterns = [
        (r"(\d+)\s*(?:days?|day)", "days"),
        (r"(\d+)\s*(?:hours?|hr)", "hours"),
        (r"(\d+)\s*(?:weeks?|wk)", "weeks"),
        (r"for the last\s*(\d+)\s*(?:days?|day)", "days"),
        (r"for\s*(\d+)\s*(?:days?|day)", "days"),
        (r"since\s*(yesterday|last night|last week)", "period"),
    ]
    for pattern, _ in patterns:
        match = re.search(pattern, text.lower())
        if match:
            value = match.group(1) if match.groups() else "1"
            if "day" in pattern or pattern.startswith("for"):
                return f"{value} days"
            if "hour" in pattern:
                return f"{value} hours"
            if "week" in pattern:
                return f"{value} weeks"
            return "1 day"
    if "two days" in text.lower() or "2 days" in text.lower():
        return "2 days"
    if "yesterday" in text.lower() or "last night" in text.lower():
        return "1 day"
    return "Immediate"


def detect_issue_types(text: str) -> List[str]:
    lower = text.lower()
    scores: Dict[str, int] = {key: 0 for key in ISSUE_KEYWORDS}
    for issue, keywords in ISSUE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in lower:
                scores[issue] += 2
    if "no water" in lower and "pipeline" in lower and "leaking" in lower:
        scores["Water Shortage"] += 2
        scores["Leakage"] += 2
    detected = [issue for issue, score in scores.items() if score > 0]
    return detected if detected else ["Other"]


def estimate_severity(issue_types: List[str]) -> str:
    severity_points = sum(SEVERITY_RULES.get(issue, 1) for issue in issue_types)
    if severity_points >= 6:
        return "CRITICAL"
    if severity_points >= 4:
        return "HIGH"
    if severity_points >= 2:
        return "MEDIUM"
    return "LOW"


def compute_confidence(text: str, issue_types: List[str], location: str, duration: str) -> float:
    score = 0.45
    score += min(len(issue_types) * 0.15, 0.35)
    score += 0.15 if location != "Unknown Area" else 0
    score += 0.12 if duration != "Immediate" else 0
    score += min(len(tokenize(text)) / 100, 0.15)
    return round(min(score, 0.97), 2)


def analyze_complaint(complaint_text: str, known_location: str | None = None) -> Dict:
    clean = clean_text(complaint_text)
    issue_types = detect_issue_types(clean)
    location = known_location or detect_location(clean)
    duration = detect_duration(clean)
    severity = estimate_severity(issue_types)
    confidence = compute_confidence(clean, issue_types, location, duration)
    reasons = []
    if "Water Shortage" in issue_types:
        reasons.append("Demand exceeds supply in the reported area")
    if "Leakage" in issue_types:
        reasons.append("Pipeline leak or burst indicates a pressure loss risk")
    if "Low Pressure" in issue_types:
        reasons.append("Pressure reduction is affecting service continuity")
    if "Contamination" in issue_types:
        reasons.append("Water quality issue reported by residents")
    if "Supply Interruption" in issue_types:
        reasons.append("Service interruption suggests operational disruption")
    if "Pipeline Damage" in issue_types:
        reasons.append("Infrastructure damage is likely affecting network reliability")
    return {
        "issue_types": issue_types,
        "location": location,
        "duration": duration,
        "severity": severity,
        "confidence": confidence,
        "explanation": reasons or ["Complaint was classified using keyword and rule-based NLP fallback."],
        "raw_text": clean,
    }
