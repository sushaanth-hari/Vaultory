import os
import io
import shutil
import logging
from PIL import Image
import numpy as np
import pytesseract
from app.core.config import settings

logger = logging.getLogger(__name__)

class OCRService:
    def __init__(self):
        self.tesseract_available = False
        self.rapidocr_available = False
        self.rapid_ocr = None

        self._configure_rapidocr()
        self._configure_tesseract()

    def _configure_rapidocr(self):
        try:
            from rapidocr_onnxruntime import RapidOCR
            self.rapid_ocr = RapidOCR()
            self.rapidocr_available = True
            logger.info("RapidOCR engine initialized successfully.")
        except Exception as e:
            self.rapid_ocr = None
            self.rapidocr_available = False
            logger.warning(f"RapidOCR engine not available: {e}")

    def _configure_tesseract(self):
        candidate_paths = [
            settings.TESSERACT_CMD,
            r"C:\Program Files\Tesseract-OCR\tesseract.exe",
            r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
            shutil.which("tesseract")
        ]
        
        for path in candidate_paths:
            if path and os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                self.tesseract_available = True
                logger.info(f"Tesseract OCR found at: {path}")
                return
        
        try:
            version = pytesseract.get_tesseract_version()
            self.tesseract_available = True
            logger.info(f"Tesseract OCR is available on PATH (version {version})")
        except Exception:
            self.tesseract_available = False
            logger.info("Tesseract binary not found; RapidOCR will be used as primary engine.")

    def extract_text_from_file(self, file_path: str) -> str:
        """
        Extracts exact raw text from an image or PDF file using RapidOCR / pypdf / Tesseract.
        Returns empty string if no text is found. NEVER fabricates or mocks receipt details.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        ext = os.path.splitext(file_path)[1].lower()

        if ext == ".pdf":
            return self._extract_from_pdf(file_path)
        else:
            return self._extract_from_image(file_path)

    def _extract_from_pdf(self, pdf_path: str) -> str:
        """Extracts text from PDF documents via pypdf, falling back to OCR on embedded images."""
        extracted_lines = []
        try:
            import pypdf
            reader = pypdf.PdfReader(pdf_path)
            # Try text layer extraction first
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    extracted_lines.append(page_text.strip())

            if extracted_lines:
                return "\n".join(extracted_lines).strip()

            # If no digital text layer found, OCR any embedded images (scanned PDFs)
            for page in reader.pages:
                for img_file in page.images:
                    pil_img = Image.open(io.BytesIO(img_file.data)).convert("RGB")
                    text = self._ocr_pil_image(pil_img)
                    if text:
                        extracted_lines.append(text)

            return "\n".join(extracted_lines).strip()
        except Exception as e:
            logger.error(f"Error extracting text from PDF {pdf_path}: {e}")
            return ""

    def _extract_from_image(self, image_path: str) -> str:
        """Extracts text from image file using RapidOCR, falling back to pytesseract."""
        # 1. Primary: RapidOCR (ONNX model, robust, no external OS binary needed)
        if self.rapidocr_available and self.rapid_ocr:
            try:
                result, _ = self.rapid_ocr(image_path)
                if result:
                    lines = [line[1].strip() for line in result if line[1] and line[1].strip()]
                    if lines:
                        return "\n".join(lines).strip()
            except Exception as e:
                logger.error(f"RapidOCR extraction failed for {image_path}: {e}")

        # 2. Secondary: PyTesseract (if installed on host)
        if self.tesseract_available:
            try:
                img = Image.open(image_path)
                if img.mode not in ('L', 'RGB'):
                    img = img.convert('RGB')
                text = pytesseract.image_to_string(img)
                if text and text.strip():
                    return text.strip()
            except Exception as e:
                logger.error(f"PyTesseract extraction failed for {image_path}: {e}")

        # 3. Fallback for text documents or formatted receipt files
        try:
            with open(image_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read().strip()
                # If it's actual ASCII/UTF-8 readable text and not binary garbage
                if content and len(content) >= 15:
                    words = [w for w in content.split() if w.isalnum()]
                    if len(words) >= 3:
                        return content
        except Exception:
            pass

        # Return empty string if no readable text detected. Never fabricate mock details.
        return ""

    def _ocr_pil_image(self, pil_img: Image.Image) -> str:
        """Internal helper to OCR an in-memory PIL image."""
        if self.rapidocr_available and self.rapid_ocr:
            try:
                img_array = np.array(pil_img.convert("RGB"))
                result, _ = self.rapid_ocr(img_array)
                if result:
                    lines = [line[1].strip() for line in result if line[1] and line[1].strip()]
                    return "\n".join(lines).strip()
            except Exception as e:
                logger.warning(f"RapidOCR in-memory image extraction error: {e}")

        if self.tesseract_available:
            try:
                text = pytesseract.image_to_string(pil_img)
                return text.strip() if text else ""
            except Exception as e:
                logger.warning(f"Tesseract in-memory image extraction error: {e}")

        return ""

    def extract_text_from_image(self, image_path: str) -> str:
        """Backward compatible alias for extract_text_from_file."""
        return self.extract_text_from_file(image_path)

ocr_service = OCRService()
