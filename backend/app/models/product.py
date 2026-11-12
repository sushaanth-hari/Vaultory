from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Date, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False, index=True)
    brand = Column(String(100), nullable=True, index=True)
    model_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True, default="Electronics")
    
    purchase_date = Column(Date, nullable=True)
    purchase_price = Column(Float, nullable=True, default=0.0)
    currency = Column(String(10), default="USD")
    retailer = Column(String(255), nullable=True)
    
    receipt_url = Column(String(500), nullable=True)
    receipt_filename = Column(String(255), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="products")
    warranty = relationship("Warranty", back_populates="product", uselist=False, cascade="all, delete-orphan")
    condition_photos = relationship("ConditionPhoto", back_populates="product", cascade="all, delete-orphan", order_by="ConditionPhoto.created_at.desc()")
    repairs = relationship("Repair", back_populates="product", cascade="all, delete-orphan", order_by="Repair.repair_date.desc()")
    notification_logs = relationship("NotificationLog", back_populates="product", cascade="all, delete-orphan")
