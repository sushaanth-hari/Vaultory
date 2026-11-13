import os
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.services.ocr_service import ocr_service
from app.services.ai_service import ai_service
from app.services.cloudinary_service import storage_service
from app.schemas.product import ProductReceiptScanResponse
from app.models.user import User
from app.api.deps import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR & AI Processing"])

@router.post("/scan-receipt", response_model=ProductReceiptScanResponse)
async def scan_receipt_and_extract_product(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    1. Uploads the receipt image/file.
    2. Runs OCR (RapidOCR / pypdf / Tesseract) to extract exact text from receipt.
    3. Strictly validates that the document is a valid purchase receipt/bill. Rejects invalid documents.
    4. Extracts exact product, price, purchase date, retailer, warranty duration without fabricating details.
    5. Returns structured preview data + receipt file URL for user review before saving.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    # Upload and obtain file URL and cached local path
    file_url, original_filename = await storage_service.upload_file(file, folder="vaultory/receipts")
    local_path = storage_service.get_local_path_from_url(file_url)

    if not local_path or not os.path.exists(local_path):
        raise HTTPException(status_code=500, detail="Failed to save or locate uploaded receipt file.")

    # 1. OCR Text Extraction (Exact content extraction from file)
    raw_text = ocr_service.extract_text_from_file(local_path)

    if not raw_text or not raw_text.strip():
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass
        raise HTTPException(
            status_code=400,
            detail="Invalid bill: No readable text could be detected from the uploaded document. Please upload a clear and legible purchase receipt or invoice."
        )

    # 2. AI Structuring & Strict Bill Validation
    structured_data = ai_service.structure_receipt_text(raw_text)

    # 3. Reject invalid bill
    if not structured_data.get("is_valid_receipt", True):
        rejection_reason = structured_data.get("rejection_reason") or (
            "Invalid bill: The uploaded document does not appear to be a valid purchase receipt or bill. "
            "Please upload an actual invoice or purchase receipt."
        )
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass
        raise HTTPException(status_code=400, detail=rejection_reason)

    # 4. Require minimum valid bill content (must identify product name or price/retailer)
    if not structured_data.get("name") and structured_data.get("purchase_price") is None:
        if os.path.exists(local_path):
            try:
                os.remove(local_path)
            except Exception:
                pass
        raise HTTPException(
            status_code=400,
            detail="Invalid bill: Unable to extract purchased item details or pricing from this document. Please ensure the receipt is clear and legitimate."
        )

    # Attach file info so user can proceed to product creation
    structured_data["receipt_url"] = file_url
    structured_data["receipt_filename"] = original_filename

    return structured_data
