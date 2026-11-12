from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Date, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Warranty(Base):
    __tablename__ = "warranties"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), unique=True, nullable=False, index=True)
    
    duration_months = Column(Integer, default=12)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    warranty_type = Column(String(50), default="Manufacturer")  # Manufacturer, Extended, Retailer, Lifetime
    coverage_details = Column(Text, nullable=True)
    provider_contact = Column(String(255), nullable=True)
    status = Column(String(50), default="active")  # active, expiring_soon, expired
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    product = relationship("Product", back_populates="warranty")
