from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.product import Product
from app.models.user import User
from app.services.pdf_service import pdf_service
from app.api.deps import get_current_user

router = APIRouter(prefix="/evidence", tags=["Warranty Evidence & PDF Generation"])

@router.get("/products/{product_id}/pdf")
def download_product_evidence_pdf(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generates and returns an official ReportLab PDF evidence report containing
    product specifications, purchase receipt, warranty calculations,
    original/current photographs, and complete repair history.
    """
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.user_id == current_user.id
    ).first()

    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    try:
        pdf_bytes = pdf_service.generate_product_evidence_pdf(product, current_user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate evidence report PDF: {str(e)}")

    safe_name = "".join(c for c in product.name if c.isalnum() or c in (' ', '_', '-')).rstrip()
    filename = f"Vaultory_Evidence_{safe_name.replace(' ', '_')}_{product.id}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )

@router.get("/products/{product_id}/preview")
def preview_product_evidence_summary(
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

    orig_photos = [p for p in product.condition_photos if p.photo_type == "original"]
    curr_photos = [p for p in product.condition_photos if p.photo_type == "current"]

    return {
        "product_id": product.id,
        "product_name": product.name,
        "brand": product.brand,
        "has_receipt": bool(product.receipt_url),
        "receipt_url": product.receipt_url,
        "warranty_available": bool(product.warranty),
        "warranty_status": product.warranty.status if product.warranty else "none",
        "original_photos_count": len(orig_photos),
        "current_photos_count": len(curr_photos),
        "repairs_count": len(product.repairs),
        "ready_for_export": True
    }

