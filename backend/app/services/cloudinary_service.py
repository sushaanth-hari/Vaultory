import os
import uuid
import shutil
import logging
from typing import Tuple, Optional
from fastapi import UploadFile
from app.core.config import settings

logger = logging.getLogger(__name__)

# Ensure local upload dir exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

class StorageService:
    def __init__(self):
        self.use_cloudinary = False
        if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
            try:
                import cloudinary
                import cloudinary.uploader
                cloudinary.config(
                    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                    api_key=settings.CLOUDINARY_API_KEY,
                    api_secret=settings.CLOUDINARY_API_SECRET,
                    secure=True
                )
                self.use_cloudinary = True
                logger.info("Cloudinary storage service configured successfully.")
            except Exception as e:
                logger.warning(f"Failed to configure Cloudinary ({e}). Using local storage.")
        else:
            logger.info("Cloudinary credentials not provided. Using local storage.")

    async def upload_file(self, file: UploadFile, folder: str = "vaultory") -> Tuple[str, str]:
        """
        Uploads a file to Cloudinary if configured, otherwise stores locally.
        Returns: (file_url, original_filename)
        """
        filename = file.filename or f"upload_{uuid.uuid4().hex}"
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        
        # Read contents
        contents = await file.read()
        
        if self.use_cloudinary:
            try:
                import cloudinary.uploader
                # Determine resource type (raw for pdfs, image for images)
                resource_type = "raw" if ext == ".pdf" else "image"
                upload_result = cloudinary.uploader.upload(
                    contents,
                    folder=folder,
                    public_id=os.path.splitext(unique_name)[0],
                    resource_type=resource_type
                )
                url = upload_result.get("secure_url") or upload_result.get("url")
                # Also save a local cache copy for opencv / reportlab processing
                local_path = os.path.join(settings.UPLOAD_DIR, unique_name)
                with open(local_path, "wb") as f:
                    f.write(contents)
                return url, filename
            except Exception as e:
                logger.error(f"Cloudinary upload failed ({e}). Falling back to local storage.")
        
        # Local storage fallback
        local_path = os.path.join(settings.UPLOAD_DIR, unique_name)
        with open(local_path, "wb") as f:
            f.write(contents)
            
        file_url = f"/uploads/{unique_name}"
        return file_url, filename

    def save_bytes(self, content_bytes: bytes, filename: str, folder: str = "vaultory") -> Tuple[str, str]:
        """
        Saves raw bytes (e.g. generated heatmaps or PDFs) to storage.
        """
        ext = os.path.splitext(filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        local_path = os.path.join(settings.UPLOAD_DIR, unique_name)
        
        with open(local_path, "wb") as f:
            f.write(content_bytes)

        if self.use_cloudinary:
            try:
                import cloudinary.uploader
                resource_type = "raw" if ext == ".pdf" else "image"
                result = cloudinary.uploader.upload(
                    local_path,
                    folder=folder,
                    public_id=os.path.splitext(unique_name)[0],
                    resource_type=resource_type
                )
                return result.get("secure_url", f"/uploads/{unique_name}"), unique_name
            except Exception as e:
                logger.warning(f"Cloudinary upload failed ({e}). Returning local URL.")

        return f"/uploads/{unique_name}", unique_name

    def get_local_path_from_url(self, url: str) -> Optional[str]:
        """
        Resolves a local disk path from either a local /uploads/ URL or matches cached file.
        """
        if not url:
            return None
        if url.startswith("/uploads/"):
            filename = url.replace("/uploads/", "")
            path = os.path.join(settings.UPLOAD_DIR, filename)
            if os.path.exists(path):
                return path
        # Check if basename exists in upload dir
        basename = os.path.basename(url.split("?")[0])
        path = os.path.join(settings.UPLOAD_DIR, basename)
        if os.path.exists(path):
            return path
        return None

storage_service = StorageService()

