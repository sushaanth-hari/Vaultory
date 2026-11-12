import os
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.models.condition_photo import ConditionPhoto
from app.models.product import Product
from app.models.user import User
from app.schemas.condition_photo import ConditionPhotoResponse, ImageComparisonResponse
from app.services.cloudinary_service import storage_service
from app.services.image_comparison_service import image_comparison_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/condition-photos", tags=["Product Condition & OpenCV Analysis"])

class CompareRequest(BaseModel):
    original_photo_id: int
    current_photo_id: int

@router.post("/products/{product_id}", response_model=ConditionPhotoResponse)
async def upload_condition_photo(
    product_id: int,
    file: UploadFile = File(...),
    photo_type: str = Form("original"),  # "original" or "current"
    caption: str = Form(""),
    notes: str = Form(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    file_url, filename = await storage_service.upload_file(file, folder="vaultory/condition")
    
    photo = ConditionPhoto(
        product_id=product.id,
        photo_url=file_url,
        photo_type=photo_type.lower(),
        caption=caption or f"{photo_type.capitalize()} condition photo",
        notes=notes,
        taken_at=datetime.now(timezone.utc)
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)

    return photo

@router.get("/products/{product_id}", response_model=List[ConditionPhotoResponse])
def get_product_photos(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    return product.condition_photos

@router.delete("/{photo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_photo(
    photo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    photo = (
        db.query(ConditionPhoto)
        .join(Product, ConditionPhoto.product_id == Product.id)
        .filter(ConditionPhoto.id == photo_id, Product.user_id == current_user.id)
        .first()
    )

    if not photo:
        raise HTTPException(status_code=404, detail="Condition photo not found")

    db.delete(photo)
    db.commit()
    return None

@router.post("/compare", response_model=ImageComparisonResponse)
def compare_photos(
    req: CompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Executes OpenCV image alignment and computer vision comparison
    between the original and current condition photos.
    """
    orig_photo = (
        db.query(ConditionPhoto)
        .join(Product, ConditionPhoto.product_id == Product.id)
        .filter(ConditionPhoto.id == req.original_photo_id, Product.user_id == current_user.id)
        .first()
    )
    curr_photo = (
        db.query(ConditionPhoto)
        .join(Product, ConditionPhoto.product_id == Product.id)
        .filter(ConditionPhoto.id == req.current_photo_id, Product.user_id == current_user.id)
        .first()
    )

    if not orig_photo or not curr_photo:
        raise HTTPException(status_code=404, detail="One or both condition photos were not found.")

    orig_path = storage_service.get_local_path_from_url(orig_photo.photo_url)
    curr_path = storage_service.get_local_path_from_url(curr_photo.photo_url)

    if not orig_path or not os.path.exists(orig_path):
        raise HTTPException(status_code=400, detail="Original photo file is not available locally for OpenCV processing.")
    if not curr_path or not os.path.exists(curr_path):
        raise HTTPException(status_code=400, detail="Current photo file is not available locally for OpenCV processing.")

    try:
        result = image_comparison_service.compare_condition_photos(
            original_img_path=orig_path,
            current_img_path=curr_path,
            original_photo_id=orig_photo.id,
            current_photo_id=curr_photo.id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenCV visual comparison error: {str(e)}")

