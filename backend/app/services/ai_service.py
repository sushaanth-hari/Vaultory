import os
import re
import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime
from app.core.config import settings

logger = logging.getLogger(__name__)

class AIService:
    def __init__(self):
        self.api_key = settings.OPENAI_API_KEY
        self.client = None
        if self.api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=self.api_key)
                logger.info("OpenAI client initialized successfully.")
            except Exception as e:
                logger.warning(f"Could not initialize OpenAI client ({e}).")

    def structure_receipt_text(self, text: str) -> Dict[str, Any]:
        """
        Parses raw text extracted by OCR into structured product & warranty data.
        Uses OpenAI if client is available; otherwise uses heuristic regex extraction.
        """
        if self.client:
            try:
                system_prompt = (
                    "You are an expert AI data extraction assistant for Vaultory, a digital product ownership system.\n"
                    "Extract the product, purchase, and warranty details from the provided OCR receipt text.\n"
                    "Respond with a valid JSON object strictly matching this schema:\n"
                    "{\n"
                    '  "name": "Product Name",\n'
                    '  "brand": "Brand / Manufacturer",\n'
                    '  "model_number": "Model Number if available, else null",\n'
                    '  "serial_number": "Serial Number if available, else null",\n'
                    '  "purchase_date": "YYYY-MM-DD",\n'
                    '  "purchase_price": 0.0,\n'
                    '  "currency": "USD",\n'
                    '  "retailer": "Retailer / Store Name",\n'
                    '  "warranty_duration_months": 12,\n'
                    '  "confidence_notes": "Short summary of extracted items"\n'
                    "}"
                )
                
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Here is the OCR receipt text:\n\n{text}"}
                    ],
                    response_format={"type": "json_object"},
                    temperature=0.1
                )
                
                content = response.choices[0].message.content
                result = json.loads(content)
                result["raw_extracted_text"] = text
                return result
            except Exception as e:
                logger.error(f"OpenAI structuring failed ({e}). Falling back to heuristic parser.")

        # Fallback Heuristic Parser
        return self._heuristic_parse(text)

    def _heuristic_parse(self, text: str) -> Dict[str, Any]:
        result = {
            "name": "Purchased Product",
            "brand": None,
            "model_number": None,
            "serial_number": None,
            "purchase_date": datetime.today().strftime("%Y-%m-%d"),
            "purchase_price": 0.0,
            "currency": "USD",
            "retailer": None,
            "warranty_duration_months": 12,
            "confidence_notes": "Extracted via smart pattern matching heuristic.",
            "raw_extracted_text": text
        }

        lines = [line.strip() for line in text.split("\n") if line.strip()]
        
        # 1. Retailer detection
        retailer_match = re.search(r"(?:Store|Retailer|Merchant|Shop|At):\s*([^\n\r]+)", text, re.I)
        if retailer_match:
            result["retailer"] = retailer_match.group(1).strip()
        elif lines:
            # Often first line is the retailer
            first_line = lines[0]
            if len(first_line) < 40 and not any(kw in first_line.lower() for kw in ["receipt", "invoice", "official"]):
                result["retailer"] = first_line

        # 2. Date detection (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY)
        date_match = re.search(r"(?:Date|Purchased|Time)?\s*[:#]?\s*(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})", text, re.I)
        if date_match:
            raw_date = date_match.group(1).replace(".", "-").replace("/", "-")
            parts = raw_date.split("-")
            try:
                if len(parts[0]) == 4:  # YYYY-MM-DD
                    dt = datetime.strptime(raw_date, "%Y-%m-%d")
                elif len(parts[2]) == 4:  # MM-DD-YYYY or DD-MM-YYYY
                    try:
                        dt = datetime.strptime(raw_date, "%m-%d-%Y")
                    except ValueError:
                        dt = datetime.strptime(raw_date, "%d-%m-%Y")
                else:
                    dt = datetime.today()
                result["purchase_date"] = dt.strftime("%Y-%m-%d")
            except Exception:
                pass

        # 3. Price / Total detection
        price_match = re.search(r"(?:Total Paid|Total Amount|Total|Grand Total|Price|Amount|Balance)\s*[:#]?\s*[\$€£¥]?\s*([\d,]+\.\d{2})", text, re.I)
        if price_match:
            try:
                result["purchase_price"] = float(price_match.group(1).replace(",", ""))
            except Exception:
                pass
        else:
            # Any currency pattern
            any_price = re.search(r"\$\s*([\d,]+\.\d{2})", text)
            if any_price:
                try:
                    result["purchase_price"] = float(any_price.group(1).replace(",", ""))
                except Exception:
                    pass

        # 4. Item / Product Name detection
        item_match = re.search(r"(?:Item|Product|Description|Item Name)\s*[:#]?\s*([^\n\r]+)", text, re.I)
        if item_match:
            result["name"] = item_match.group(1).strip()
        else:
            # Look for lines with popular tech brands
            brands = ["Sony", "Apple", "Samsung", "Dell", "HP", "Lenovo", "Asus", "Bose", "LG", "Logitech", "Microsoft", "Canon", "Nikon", "Dyson", "Philips"]
            for brand in brands:
                for line in lines:
                    if brand.lower() in line.lower():
                        result["brand"] = brand
                        result["name"] = line
                        break
                if result["brand"]:
                    break

        # 5. Model & Serial number
        model_match = re.search(r"(?:Model|M/N|Mod)\s*[:#]?\s*([A-Za-z0-9\-_/]+)", text, re.I)
        if model_match:
            result["model_number"] = model_match.group(1).strip()

        serial_match = re.search(r"(?:Serial|S/N|SN)\s*[:#]?\s*([A-Za-z0-9\-_]+)", text, re.I)
        if serial_match:
            result["serial_number"] = serial_match.group(1).strip()

        # 6. Warranty detection
        warranty_match = re.search(r"(?:Warranty|Guarantee)\s*[:#]?\s*(\d{1,2})\s*(?:Months|Month|Years|Year)", text, re.I)
        if warranty_match:
            num = int(warranty_match.group(1))
            if "year" in warranty_match.group(0).lower():
                num = num * 12
            result["warranty_duration_months"] = num

        return result

ai_service = AIService()

