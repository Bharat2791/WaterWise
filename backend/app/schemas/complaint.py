from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ComplaintBase(BaseModel):
    complaint_text: str = Field(..., min_length=8)
    date: Optional[datetime] = None
    issue_type: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    severity: Optional[str] = None
    status: Optional[str] = "Open"
    affected_people: Optional[int] = 0
    duration: Optional[str] = None
    predicted_maintenance: Optional[str] = "LOW"
    maintenance_confidence: Optional[float] = 0.0
    priority_score: Optional[float] = 0.0
    priority_level: Optional[str] = "LOW"
    priority_reason: Optional[str] = None


class ComplaintCreate(ComplaintBase):
    model_config = ConfigDict(from_attributes=True)


class ComplaintUpdate(BaseModel):
    complaint_text: Optional[str] = None
    date: Optional[datetime] = None
    issue_type: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    affected_people: Optional[int] = None
    duration: Optional[str] = None
    predicted_maintenance: Optional[str] = None
    maintenance_confidence: Optional[float] = None
    priority_score: Optional[float] = None
    priority_level: Optional[str] = None
    priority_reason: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ComplaintRead(ComplaintBase):
    id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
