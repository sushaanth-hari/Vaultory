from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from app.schemas.warranty import WarrantyResponse
from app.schemas.condition_photo import ConditionPhotoResponse
from app.schemas.repair import RepairResponse

class ProductBase(BaseModel):
    name: str
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    category: Optional[str] = "Electronics"
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = 0.0
    currency: Optional[str] = "USD"
    retailer: Optional[str] = None
    notes: Optional[str] = None

class ProductCreate(ProductBase):
    warranty_duration_months: Optional[int] = 12
    warranty_type: Optional[str] = "Manufacturer"
    warranty_notes: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    category: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[float] = None
    currency: Optional[str] = None
    retailer: Optional[str] = None
    notes: Optional[str] = None

class ProductResponse(ProductBase):
    id: int
    user_id: int
    receipt_url: Optional[str] = None
    receipt_filename: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    warranty: Optional[WarrantyResponse] = None
    condition_photos: List[ConditionPhotoResponse] = []
    repairs: List[RepairResponse] = []

    class Config:
        from_attributes = True

class ProductReceiptScanResponse(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[str] = None
    purchase_price: Optional[float] = None
    currency: Optional[str] = None
    retailer: Optional[str] = None
    warranty_duration_months: Optional[int] = None
    raw_extracted_text: str
    confidence_notes: Optional[str] = None
    is_valid_receipt: bool = True
    receipt_url: Optional[str] = None
    receipt_filename: Optional[str] = None

