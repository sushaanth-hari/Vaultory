from typing import List, Dict, Any
from datetime import datetime, date, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Product
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/timeline", tags=["Ownership Timeline"])

@router.get("/products/{product_id}")
def get_product_ownership_timeline(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> List[Dict[str, Any]]:
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    events = []

    # 1. Purchase Event
    if product.purchase_date:
        p_dt = datetime.combine(product.purchase_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        events.append({
            "id": f"purchase_{product.id}",
            "type": "purchase",
            "title": f"Product Purchased: {product.name}",
            "date": str(product.purchase_date),
            "timestamp": p_dt.isoformat(),
            "description": f"Acquired at {product.retailer or 'Retailer'} for {product.currency or 'USD'} {product.purchase_price:.2f}",
            "badge": "Ownership Inception",
            "icon": "shopping-bag",
            "metadata": {
                "retailer": product.retailer,
                "price": product.purchase_price,
                "model": product.model_number,
                "serial": product.serial_number
            }
        })

    # 2. Receipt Upload Event
    if product.receipt_url:
        r_dt = product.created_at.replace(tzinfo=timezone.utc) if product.created_at else datetime.now(timezone.utc)
        events.append({
            "id": f"receipt_{product.id}",
            "type": "receipt_upload",
            "title": "Purchase Receipt Document Digitized",
            "date": r_dt.strftime("%Y-%m-%d"),
            "timestamp": r_dt.isoformat(),
            "description": f"Verified receipt file ({product.receipt_filename or 'receipt document'}) attached to ownership vault.",
            "badge": "Verified Document",
            "icon": "file-text",
            "file_url": product.receipt_url
        })

    # 3. Warranty Activation Event
    if product.warranty:
        w = product.warranty
        w_dt = datetime.combine(w.start_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        events.append({
            "id": f"warranty_start_{w.id}",
            "type": "warranty_start",
            "title": f"{w.warranty_type} Warranty Activated",
            "date": str(w.start_date),
            "timestamp": w_dt.isoformat(),
            "description": f"{w.duration_months} months coverage active until {w.end_date}. {w.coverage_details or ''}",
            "badge": "Warranty Active",
            "icon": "shield-check",
            "metadata": {
                "duration_months": w.duration_months,
                "end_date": str(w.end_date),
                "type": w.warranty_type
            }
        })

        # Warranty Expiration Milestone
        exp_dt = datetime.combine(w.end_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        today = date.today()
        is_expired = w.end_date < today
        events.append({
            "id": f"warranty_end_{w.id}",
            "type": "warranty_end",
            "title": "Warranty Expiration Milestone",
            "date": str(w.end_date),
            "timestamp": exp_dt.isoformat(),
            "description": "Warranty coverage expired." if is_expired else f"Coverage scheduled to expire on {w.end_date}.",
            "badge": "Expired" if is_expired else "Upcoming Expiry",
            "icon": "alert-circle" if is_expired else "clock",
            "is_future": not is_expired
        })

    # 4. Condition Photos Events
    for photo in product.condition_photos:
        ph_dt = photo.created_at.replace(tzinfo=timezone.utc) if photo.created_at else datetime.now(timezone.utc)
        is_orig = photo.photo_type == "original"
        events.append({
            "id": f"photo_{photo.id}",
            "type": "condition_photo",
            "title": "Original Condition Photographic Baseline" if is_orig else "Verified Condition Update",
            "date": ph_dt.strftime("%Y-%m-%d"),
            "timestamp": ph_dt.isoformat(),
            "description": photo.caption or ("Initial baseline photograph captured." if is_orig else "Current condition photograph recorded."),
            "badge": "Original Evidence" if is_orig else "Condition Check",
            "icon": "camera",
            "file_url": photo.photo_url,
            "metadata": {
                "photo_type": photo.photo_type,
                "notes": photo.notes
            }
        })

    # 5. Repair & Service Events
    for repair in product.repairs:
        rep_dt = datetime.combine(repair.repair_date, datetime.min.time()).replace(tzinfo=timezone.utc)
        events.append({
            "id": f"repair_{repair.id}",
            "type": "repair",
            "title": f"Service & Repair: {repair.service_center}",
            "date": str(repair.repair_date),
            "timestamp": rep_dt.isoformat(),
            "description": f"{repair.description} (Cost: {repair.currency} {repair.cost:.2f} | Status: {repair.status})",
            "badge": "Warranty Covered" if repair.warranty_covered else "Out-of-Pocket",
            "icon": "wrench",
            "file_url": repair.document_url,
            "metadata": {
                "cost": repair.cost,
                "status": repair.status,
                "covered": repair.warranty_covered
            }
        })

    # Sort chronologically by date/timestamp
    events.sort(key=lambda x: x["timestamp"])

    return events

