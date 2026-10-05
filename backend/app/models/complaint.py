from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    submitted_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    complaint_text: Mapped[str] = mapped_column(Text, nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    issue_type: Mapped[str] = mapped_column(String(255), nullable=False)
    location: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Open", index=True)
    affected_people: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration: Mapped[str] = mapped_column(String(100), nullable=False, default="Immediate")
    predicted_maintenance: Mapped[str] = mapped_column(String(50), nullable=False, default="LOW")
    maintenance_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    priority_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    priority_level: Mapped[str] = mapped_column(String(50), nullable=False, default="LOW")
    priority_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (
        Index("ix_complaints_lat_lon", "latitude", "longitude"),
        Index("ix_complaints_issue_location", "issue_type", "location"),
    )
