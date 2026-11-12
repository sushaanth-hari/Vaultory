from typing import List, Optional
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.repair import Repair
from app.models.product import Product
from app.models.user import User
from app.schemas.repair import RepairResponse, RepairUpdate
from app.services.cloudinary_service import storage_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/repairs", tags=["Repair Management"])

@router.get("", response_model=List[dict])
def get_all_user_repairs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repairs = (
        db.query(Repair)
        .join(Product, Repair.product_id == Product.id)
        .filter(Product.user_id == current_user.id)
        .order_by(Repair.repair_date.desc())
        .all()
    )

    result = []
    for r in repairs:
        result.append({
            "id": r.id,
            "product_id": r.product_id,
            "product_name": r.product.name if r.product else "Unknown",
            "product_brand": r.product.brand if r.product else "",
            "service_center": r.service_center,
            "repair_date": r.repair_date,
            "description": r.description,
            "cost": r.cost,
            "currency": r.currency,
            "document_url": r.document_url,
            "document_filename": r.document_filename,
            "warranty_covered": r.warranty_covered,
            "status": r.status,
            "created_at": r.created_at
        })

    return result

@router.post("/products/{product_id}", response_model=RepairResponse, status_code=status.HTTP_201_CREATED)
async def create_repair_record(
    product_id: int,
    service_center: str = Form(...),
    repair_date: str = Form(...),
    description: str = Form(...),
    cost: float = Form(0.0),
    currency: str = Form("USD"),
    warranty_covered: bool = Form(False),
    status: str = Form("Completed"),
    document: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    doc_url = None
    doc_filename = None
    if document and document.filename:
        doc_url, doc_filename = await storage_service.upload_file(document, folder="vaultory/repairs")

    try:
        parsed_date = date.fromisoformat(repair_date)
    except Exception:
        parsed_date = date.today()

    repair = Repair(
        product_id=product.id,
        service_center=service_center,
        repair_date=parsed_date,
        description=description,
        cost=cost,
        currency=currency,
        document_url=doc_url,
        document_filename=doc_filename,
        warranty_covered=warranty_covered,
        status=status
    )
    db.add(repair)
    db.commit()
    db.refresh(repair)

    return repair

@router.get("/products/{product_id}", response_model=List[RepairResponse])
def get_product_repairs(
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

    return product.repairs

@router.put("/{repair_id}", response_model=RepairResponse)
def update_repair(
    repair_id: int,
    repair_update: RepairUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repair = (
        db.query(Repair)
        .join(Product, Repair.product_id == Product.id)
        .filter(Repair.id == repair_id, Product.user_id == current_user.id)
        .first()
    )

    if not repair:
        raise HTTPException(status_code=404, detail="Repair record not found")

    data = repair_update.model_dump(exclude_unset=True)
    for field, val in data.items():
        setattr(repair, field, val)

    db.commit()
    db.refresh(repair)
    return repair

@router.delete("/{repair_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repair(
    repair_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repair = (
        db.query(Repair)
        .join(Product, Repair.product_id == Product.id)
        .filter(Repair.id == repair_id, Product.user_id == current_user.id)
        .first()
    )

    if not repair:
        raise HTTPException(status_code=404, detail="Repair record not found")

    db.delete(repair)
    db.commit()
    return None

