from typing import List, Dict, Any
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.warranty import Warranty
from app.models.product import Product
from app.models.user import User
from app.schemas.warranty import WarrantyResponse, WarrantyUpdate
from app.api.deps import get_current_user

router = APIRouter(prefix="/warranties", tags=["Warranty Management"])

def enhance_warranty(w: Warranty) -> Dict[str, Any]:
    today = date.today()
    rem_days = (w.end_date - today).days if w.end_date else 0
    if rem_days < 0:
        stat = "expired"
    elif rem_days <= 30:
        stat = "expiring_soon"
    else:
        stat = "active"

    return {
        "id": w.id,
        "product_id": w.product_id,
        "product_name": w.product.name if w.product else "Unknown",
        "product_brand": w.product.brand if w.product else "",
        "product_model": w.product.model_number if w.product else "",
        "duration_months": w.duration_months,
        "start_date": w.start_date,
        "end_date": w.end_date,
        "warranty_type": w.warranty_type,
        "coverage_details": w.coverage_details,
        "provider_contact": w.provider_contact,
        "status": stat,
        "notes": w.notes,
        "remaining_days": rem_days,
        "is_active": rem_days > 0,
        "created_at": w.created_at,
        "updated_at": w.updated_at
    }

@router.get("")
def get_all_user_warranties(
    status_filter: str = "all",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    warranties = (
        db.query(Warranty)
        .join(Product, Warranty.product_id == Product.id)
        .filter(Product.user_id == current_user.id)
        .order_by(Warranty.end_date.asc())
        .all()
    )

    enhanced = [enhance_warranty(w) for w in warranties]

    if status_filter != "all":
        enhanced = [w for w in enhanced if w["status"] == status_filter.lower()]

    return enhanced

@router.get("/stats")
def get_warranty_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    warranties = (
        db.query(Warranty)
        .join(Product, Warranty.product_id == Product.id)
        .filter(Product.user_id == current_user.id)
        .all()
    )

    today = date.today()
    total = len(warranties)
    active = 0
    expiring_soon = 0
    expired = 0

    for w in warranties:
        if not w.end_date:
            continue
        days = (w.end_date - today).days
        if days < 0:
            expired += 1
        elif days <= 30:
            expiring_soon += 1
            active += 1
        else:
            active += 1

    return {
        "total_warranties": total,
        "active_warranties": active,
        "expiring_soon": expiring_soon,
        "expired_warranties": expired
    }

@router.put("/{warranty_id}")
def update_warranty(
    warranty_id: int,
    w_update: WarrantyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    warranty = (
        db.query(Warranty)
        .join(Product, Warranty.product_id == Product.id)
        .filter(Warranty.id == warranty_id, Product.user_id == current_user.id)
        .first()
    )

    if not warranty:
        raise HTTPException(status_code=404, detail="Warranty not found")

    data = w_update.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(warranty, field, val)

    # Recalculate status
    today = date.today()
    if warranty.end_date:
        rem = (warranty.end_date - today).days
        warranty.status = "expired" if rem < 0 else ("expiring_soon" if rem <= 30 else "active")

    db.commit()
    db.refresh(warranty)
    return enhance_warranty(warranty)

