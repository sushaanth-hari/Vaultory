from typing import List, Optional
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.database import get_db
from app.models.product import Product
from app.models.warranty import Warranty
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.services.cloudinary_service import storage_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/products", tags=["Products"])

def calculate_warranty_dates(purchase_date: Optional[date], duration_months: int):
    p_date = purchase_date or date.today()
    # Approx 30.44 days per month or calendar calculation
    # e.g. 12 months = 365 days
    days = int(duration_months * 30.4375)
    end_date = p_date + timedelta(days=days)
    today = date.today()
    if end_date < today:
        status = "expired"
    elif (end_date - today).days <= 30:
        status = "expiring_soon"
    else:
        status = "active"
    return p_date, end_date, status

@router.get("", response_model=List[ProductResponse])
def get_user_products(
    search: Optional[str] = None,
    category: Optional[str] = None,
    warranty_status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Product).filter(Product.user_id == current_user.id)
    
    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Product.name.ilike(s),
                Product.brand.ilike(s),
                Product.model_number.ilike(s),
                Product.serial_number.ilike(s),
                Product.retailer.ilike(s)
            )
        )
    
    if category and category != "All":
        query = query.filter(Product.category == category)
        
    products = query.order_by(Product.created_at.desc()).all()
    
    # Filter by warranty status if requested
    if warranty_status and warranty_status != "All":
        today = date.today()
        filtered = []
        for p in products:
            if not p.warranty:
                continue
            rem = (p.warranty.end_date - today).days if p.warranty.end_date else -1
            calc_status = "expired" if rem < 0 else ("expiring_soon" if rem <= 30 else "active")
            if calc_status == warranty_status.lower():
                filtered.append(p)
        return filtered

    return products

@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    prod_in: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Create Product
    product = Product(
        user_id=current_user.id,
        name=prod_in.name,
        brand=prod_in.brand,
        model_number=prod_in.model_number,
        serial_number=prod_in.serial_number,
        category=prod_in.category or "Electronics",
        purchase_date=prod_in.purchase_date or date.today(),
        purchase_price=prod_in.purchase_price or 0.0,
        currency=prod_in.currency or "USD",
        retailer=prod_in.retailer,
        notes=prod_in.notes
    )
    db.add(product)
    db.commit()
    db.refresh(product)

    # 2. Automatically create associated Warranty Record
    dur = prod_in.warranty_duration_months or 12
    start_d, end_d, w_status = calculate_warranty_dates(product.purchase_date, dur)
    
    warranty = Warranty(
        product_id=product.id,
        duration_months=dur,
        start_date=start_d,
        end_date=end_d,
        warranty_type=prod_in.warranty_type or "Manufacturer",
        status=w_status,
        notes=prod_in.warranty_notes or f"Auto-calculated {dur} months coverage from purchase date."
    )
    db.add(warranty)
    db.commit()
    db.refresh(product)

    return product

@router.get("/{product_id}", response_model=ProductResponse)
def get_product_details(
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

    return product

@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    prod_update: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = prod_update.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(product, field, val)

    # If purchase date changed, update warranty dates if warranty exists
    if "purchase_date" in update_data and product.warranty:
        dur = product.warranty.duration_months
        start_d, end_d, w_status = calculate_warranty_dates(product.purchase_date, dur)
        product.warranty.start_date = start_d
        product.warranty.end_date = end_d
        product.warranty.status = w_status

    db.commit()
    db.refresh(product)
    return product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
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

    db.delete(product)
    db.commit()
    return None

@router.post("/{product_id}/receipt")
async def upload_product_receipt(
    product_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    file_url, filename = await storage_service.upload_file(file, folder="vaultory/receipts")
    product.receipt_url = file_url
    product.receipt_filename = filename
    db.commit()
    db.refresh(product)

    return {"receipt_url": file_url, "receipt_filename": filename}

