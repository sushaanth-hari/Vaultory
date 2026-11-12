from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class ConditionPhotoBase(BaseModel):
    photo_type: str = "original"  # "original" or "current"
    caption: Optional[str] = None
    notes: Optional[str] = None
    taken_at: Optional[datetime] = None

class ConditionPhotoCreate(ConditionPhotoBase):
    pass

class ConditionPhotoResponse(ConditionPhotoBase):
    id: int
    product_id: int
    photo_url: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ImageComparisonResponse(BaseModel):
    original_photo_id: int
    current_photo_id: int
    similarity_score: float  # 0.0 to 100.0%
    structural_difference_percentage: float
    verdict: str  # "Identical / Minimal Change", "Minor Wear & Tear", "Significant Degradation/Damage"
    diff_heatmap_url: Optional[str] = None
    keypoints_matched: int
    wear_analysis: List[str]
    details: Dict[str, Any]

