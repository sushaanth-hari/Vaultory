from datetime import date, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Product
from app.models.warranty import Warranty
from app.models.repair import Repair
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary")
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    today = date.today()

    # 1. Products
    products = db.query(Product).filter(Product.user_id == current_user.id).all()
    total_products = len(products)
    total_inventory_value = sum((p.purchase_price or 0.0) for p in products)

    # 2. Warranties
    warranties = (
        db.query(Warranty)
        .join(Product, Warranty.product_id == Product.id)
        .filter(Product.user_id == current_user.id)
        .all()
    )

    active_warranties = 0
    expiring_soon = 0
    expired_warranties = 0
    upcoming_list = []

    for w in warranties:
        if not w.end_date:
            continue
        days = (w.end_date - today).days
        if days < 0:
            expired_warranties += 1
        elif days <= 30:
            expiring_soon += 1
            active_warranties += 1
            upcoming_list.append({
                "product_id": w.product_id,
                "product_name": w.product.name if w.product else "Unknown",
                "brand": w.product.brand if w.product else "",
                "end_date": str(w.end_date),
                "days_remaining": days,
                "warranty_type": w.warranty_type,
                "category": w.product.category if w.product else "Electronics"
            })
        else:
            active_warranties += 1

    # Sort upcoming by earliest expiration
    upcoming_list.sort(key=lambda x: x["days_remaining"])

    # 3. Recent Products
    recent_prods = (
        db.query(Product)
        .filter(Product.user_id == current_user.id)
        .order_by(Product.created_at.desc())
        .limit(5)
        .all()
    )

    recent_products_data = []
    for p in recent_prods:
        w_days = (p.warranty.end_date - today).days if (p.warranty and p.warranty.end_date) else None
        w_stat = "none"
        if w_days is not None:
            w_stat = "expired" if w_days < 0 else ("expiring_soon" if w_days <= 30 else "active")

        recent_products_data.append({
            "id": p.id,
            "name": p.name,
            "brand": p.brand,
            "model_number": p.model_number,
            "category": p.category,
            "purchase_date": str(p.purchase_date) if p.purchase_date else None,
            "purchase_price": p.purchase_price,
            "currency": p.currency,
            "receipt_url": p.receipt_url,
            "warranty_status": w_stat,
            "warranty_days_remaining": w_days,
            "created_at": p.created_at
        })

    # 4. Repairs Count
    total_repairs = (
        db.query(Repair)
        .join(Product, Repair.product_id == Product.id)
        .filter(Product.user_id == current_user.id)
        .count()
    )

    return {
        "total_products": total_products,
        "total_inventory_value": round(total_inventory_value, 2),
        "active_warranties": active_warranties,
        "expiring_soon": expiring_soon,
        "expired_warranties": expired_warranties,
        "total_repairs": total_repairs,
        "upcoming_expirations": upcoming_list,
        "recent_products": recent_products_data
    }

