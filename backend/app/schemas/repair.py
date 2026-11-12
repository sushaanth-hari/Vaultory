from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime

class RepairBase(BaseModel):
    service_center: str
    repair_date: date
    description: str
    cost: float = 0.0
    currency: str = "USD"
    warranty_covered: bool = False
    status: str = "Completed"

class RepairCreate(RepairBase):
    pass

class RepairUpdate(BaseModel):
    service_center: Optional[str] = None
    repair_date: Optional[date] = None
    description: Optional[str] = None
    cost: Optional[float] = None
    currency: Optional[str] = None
    warranty_covered: Optional[bool] = None
    status: Optional[str] = None

class RepairResponse(RepairBase):
    id: int
    product_id: int
    document_url: Optional[str] = None
    document_filename: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

