from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class ConditionPhoto(Base):
    __tablename__ = "condition_photos"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    photo_url = Column(String(500), nullable=False)
    photo_type = Column(String(50), default="original")  # "original" or "current"
    caption = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    taken_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="condition_photos")
