from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class WarrantyBase(BaseModel):
    duration_months: int = 12
    start_date: date
    end_date: date
    warranty_type: str = "Manufacturer"
    coverage_details: Optional[str] = None
    provider_contact: Optional[str] = None
    status: str = "active"
    notes: Optional[str] = None

class WarrantyCreate(WarrantyBase):
    product_id: Optional[int] = None

class WarrantyUpdate(BaseModel):
    duration_months: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    warranty_type: Optional[str] = None
    coverage_details: Optional[str] = None
    provider_contact: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class WarrantyResponse(WarrantyBase):
    id: int
    product_id: int
    remaining_days: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

