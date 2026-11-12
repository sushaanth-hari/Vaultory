import os
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from app.services.ocr_service import ocr_service
from app.services.ai_service import ai_service
from app.services.cloudinary_service import storage_service
from app.schemas.product import ProductReceiptScanResponse
from app.models.user import User
from app.api.deps import get_current_user

router = APIRouter(prefix="/ocr", tags=["OCR & AI Processing"])

@router.post("/scan-receipt")
async def scan_receipt_and_extract_product(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    1. Uploads the receipt image/file.
    2. Runs Tesseract OCR to extract text from receipt.
    3. Runs AI Service (OpenAI) to structure product, price, purchase date, warranty duration.
    4. Returns structured preview data + receipt file URL for user review before saving.
    """
    if not file:
        raise HTTPException(status_code=400, detail="No file provided")

    # Upload and obtain file URL and cached local path
    file_url, original_filename = await storage_service.upload_file(file, folder="vaultory/receipts")
    local_path = storage_service.get_local_path_from_url(file_url)

    if not local_path or not os.path.exists(local_path):
        raise HTTPException(status_code=500, detail="Failed to save or locate uploaded receipt file.")

    # 1. OCR Text Extraction via Tesseract
    raw_text = ocr_service.extract_text_from_image(local_path)

    # 2. AI Structuring via OpenAI
    structured_data = ai_service.structure_receipt_text(raw_text)

    # Attach file info so user can proceed to product creation
    structured_data["receipt_url"] = file_url
    structured_data["receipt_filename"] = original_filename

    return structured_data

