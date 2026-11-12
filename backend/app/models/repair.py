from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Date, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Repair(Base):
    __tablename__ = "repairs"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    service_center = Column(String(255), nullable=False)
    repair_date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    cost = Column(Float, default=0.0)
    currency = Column(String(10), default="USD")
    document_url = Column(String(500), nullable=True)
    document_filename = Column(String(255), nullable=True)
    warranty_covered = Column(Boolean, default=False)
    status = Column(String(50), default="Completed")  # Completed, In Progress, Pending
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="repairs")
