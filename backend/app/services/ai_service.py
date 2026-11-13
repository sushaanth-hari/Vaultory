import os
import re
import json
import logging
from typing import Dict, Any, Optional, Tuple
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

    def validate_receipt_text(self, text: str) -> Tuple[bool, Optional[str]]:
        """
        Validates whether the extracted text represents a genuine purchase receipt,
        bill, or commercial invoice. Rejects invalid documents, condition photos,
        blank scans, and non-financial content.
        """
        if not text or not text.strip():
            return False, "Invalid bill: No readable text detected in the uploaded file. Please upload a clear and legible purchase receipt or invoice."

        clean = text.strip()
        words = [w for w in re.split(r'\s+', clean) if len(w) > 1]
        if len(clean) < 15 or len(words) < 3:
            return False, "Invalid bill: The document does not contain sufficient text to be a valid purchase receipt. Please provide a clear, full document."

        # Bill / Transaction keywords
        bill_keywords = [
            r'receipt', r'invoice', r'bill', r'order', r'store', r'shop', r'merchant',
            r'retailer', r'cashier', r'purchas', r'total', r'subtotal', r'amount',
            r'price', r'paid', r'payment', r'tax', r'gst', r'vat', r'qty', r'quantity',
            r'item', r'visa', r'mastercard', r'amex', r'checkout', r'balance', r'sale',
            r'warranty', r'guarantee', r'pos\b', r'terminal', r'sold\s*by'
        ]
        matched_kws = [kw for kw in bill_keywords if re.search(r'(?i)' + kw, clean)]

        # Financial / price check: e.g. $XX.XX, currency symbols, or price/total patterns
        has_price = bool(re.search(
            r'([$€£₹¥]\s*[\d,]+(?:\.\d{1,2})?)|((?:total|price|amount|paid|balance|subtotal|amt|cost)[\s:#]*[$€£₹¥]?\s*[\d,]+(?:\.\d{1,2})?)',
            clean,
            re.I
        ))

        # Explicit receipt / invoice ID check
        has_receipt_id = bool(re.search(
            r'(?i)(receipt|invoice|tax\s*invoice|bill\b|order\s*#|order#|order\s*id|inv\s*#|inv#|bill\s*#)',
            clean
        ))

        # Check for asset condition / verification baseline photos (which are NOT purchase bills)
        is_condition = bool(re.search(
            r'(?i)(condition\s*baseline|baseline\s*photo|verification\s*photo|photographic\s*evidence|unboxing\s*baseline|baseline\s*pristine)',
            clean
        ))

        if is_condition and not has_price and not has_receipt_id:
            return False, "Invalid bill: The uploaded image appears to be an asset condition photo or verification record, not a purchase receipt."

        # Must have valid transaction indicators
        if has_receipt_id or (has_price and len(matched_kws) >= 1) or len(matched_kws) >= 3:
            return True, None

        return False, "Invalid bill: The uploaded document does not appear to be a valid purchase receipt or bill. No purchase transaction, pricing, or retailer details could be verified."

    def structure_receipt_text(self, text: str) -> Dict[str, Any]:
        """
        Parses raw text extracted by OCR into structured product & warranty data.
        Enforces strict validation to reject invalid bills and strictly forbids
        hallucinating or fabricating details not present in the document.
        """
        # 1. Pre-validation check
        is_valid, rejection_reason = self.validate_receipt_text(text)
        if not is_valid:
            return {
                "is_valid_receipt": False,
                "rejection_reason": rejection_reason,
                "name": None,
                "brand": None,
                "model_number": None,
                "serial_number": None,
                "purchase_date": None,
                "purchase_price": None,
                "currency": None,
                "retailer": None,
                "warranty_duration_months": None,
                "confidence_notes": rejection_reason,
                "raw_extracted_text": text
            }

        # 2. Use OpenAI if client is configured
        if self.client:
            try:
                system_prompt = (
                    "You are an expert AI data extraction assistant for Vaultory, a digital product ownership system.\n"
                    "Your objective:\n"
                    "1. Strictly determine if the provided OCR text is a genuine purchase receipt, retail bill, store receipt, or commercial invoice.\n"
                    "2. If the text is NOT a valid receipt or bill (for example, if it is a random document, general photograph text, condition log, resume, or lacks purchase/transaction details), you MUST set 'is_valid_receipt': false and provide an explicit 'rejection_reason'.\n"
                    "3. If it IS a valid bill or receipt, set 'is_valid_receipt': true and extract ONLY the exact content explicitly present in the text.\n"
                    "CRITICAL ANTI-HALLUCINATION RULES:\n"
                    "- DO NOT invent, guess, hallucinate, or fabricate ANY details.\n"
                    "- If a field (name, brand, model_number, serial_number, purchase_date, purchase_price, currency, retailer, warranty_duration_months) is not explicitly present or cannot be determined with complete certainty, return null for that field.\n"
                    "- DO NOT default warranty to 12 months unless explicitly stated in the receipt.\n"
                    "- DO NOT default purchase date to today's date unless that date is printed on the receipt.\n"
                    "- DO NOT default purchase price to 0.0 unless stated on the receipt.\n"
                    "Respond with a valid JSON object strictly matching this schema:\n"
                    "{\n"
                    '  "is_valid_receipt": true,\n'
                    '  "rejection_reason": null,\n'
                    '  "name": "Exact Product Name or null",\n'
                    '  "brand": "Brand / Manufacturer or null",\n'
                    '  "model_number": "Model Number or null",\n'
                    '  "serial_number": "Serial Number or null",\n'
                    '  "purchase_date": "YYYY-MM-DD or null",\n'
                    '  "purchase_price": null or number,\n'
                    '  "currency": "USD or other currency code or null",\n'
                    '  "retailer": "Retailer / Store Name or null",\n'
                    '  "warranty_duration_months": null or integer,\n'
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
                    temperature=0.0
                )
                
                content = response.choices[0].message.content
                result = json.loads(content)
                result["raw_extracted_text"] = text

                # If OpenAI classified it as invalid, return rejection
                if not result.get("is_valid_receipt", True):
                    return result

                return result
            except Exception as e:
                logger.error(f"OpenAI structuring failed ({e}). Falling back to heuristic parser.")

        # 3. Fallback Heuristic Parser
        return self._heuristic_parse(text)

    def _heuristic_parse(self, text: str) -> Dict[str, Any]:
        """
        Strict heuristic parser that extracts exact patterns from verified receipt text.
        Never defaults fields to synthetic or fabricated values.
        """
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        
        result = {
            "is_valid_receipt": True,
            "rejection_reason": None,
            "name": None,
            "brand": None,
            "model_number": None,
            "serial_number": None,
            "purchase_date": None,
            "purchase_price": None,
            "currency": None,
            "retailer": None,
            "warranty_duration_months": None,
            "confidence_notes": "Exact content extracted via verified bill pattern matching.",
            "raw_extracted_text": text
        }

        # 1. Currency Detection
        if "$" in text or re.search(r"\bUSD\b", text):
            result["currency"] = "USD"
        elif "€" in text or re.search(r"\bEUR\b", text):
            result["currency"] = "EUR"
        elif "£" in text or re.search(r"\bGBP\b", text):
            result["currency"] = "GBP"
        elif "₹" in text or re.search(r"\bINR\b", text):
            result["currency"] = "INR"
        elif re.search(r"\bCAD\b", text):
            result["currency"] = "CAD"
        elif re.search(r"\bAUD\b", text):
            result["currency"] = "AUD"

        # 2. Price / Total Detection (Total Paid > Grand Total > Total > Price > Item Price)
        price_patterns = [
            r"(?:Total Paid|Total Amount|Grand Total|Balance Due|Net Amount)[\s:#]*[$€£₹¥]?\s*([\d,]+\.?\d*)",
            r"(?:Total|Price|Amount|Amt)[\s:#]+[$€£₹¥]?\s*([\d,]+\.?\d*)",
            r"[-–]\s*[$€£₹¥]\s*([\d,]+\.?\d*)",  # e.g., "Sony WH-1000XM5 - $399.99"
            r"[$€£₹¥]\s*([\d,]+\.\d{2})"
        ]
        for pat in price_patterns:
            m = re.search(pat, text, re.I)
            if m:
                try:
                    val = float(m.group(1).replace(",", ""))
                    result["purchase_price"] = val
                    break
                except Exception:
                    pass

        # 3. Retailer / Merchant Detection
        # Case A: Labeled store/merchant (e.g. "Store: Best Buy Store #1042")
        m_store = re.search(r"(?:^|[\n\r])\s*(?:Store|Retailer|Merchant|Shop|Sold By|Vendor)\s*:\s*([^\n\r]+)", text, re.I)
        if m_store:
            cand = m_store.group(1).strip()
            cand = re.sub(r"\s*(?:Official\s+)?(?:Receipt|Invoice|Order|Bill).*$", "", cand, flags=re.I).strip()
            if cand:
                result["retailer"] = cand

        # Case B: Prefix before Receipt#/Invoice#/Order# (e.g. "Apple Store 5th Ave Invoice#APP-9921", "Best Buy Official Receipt #1042")
        if not result["retailer"]:
            for line in lines:
                m = re.search(r"^([A-Za-z0-9\s&'.-]+?)\s*(?:Official\s+)?(?:Receipt|Invoice|Order|Bill)\s*#", line, re.I)
                if m:
                    cand = m.group(1).strip()
                    cand = re.sub(r"([a-z])([A-Z])", r"\1 \2", cand).strip()
                    if "vaultory" not in cand.lower() and len(cand) > 2:
                        result["retailer"] = cand
                        break

        # Case C: Store line header (e.g. "TARGET STORE #1920", "WALMART SUPERCENTER")
        if not result["retailer"]:
            for line in lines[:3]:
                clean_l = line.strip()
                if "vaultory" in clean_l.lower():
                    continue
                if any(w in clean_l.lower() for w in ["store", "mart", "shop", "supercenter", "retail", "direct", "best buy", "target", "walmart", "apple store"]):
                    clean_l = re.sub(r"\s*(?:Official\s+)?(?:Receipt|Invoice|Order|Bill).*$", "", clean_l, flags=re.I).strip()
                    result["retailer"] = clean_l
                    break

        # 4. Purchase Date Detection (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY)
        date_patterns = [
            r"(?:Date|Purchased|Time|Timestamp)[\s:#]+(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})",
            r"(?:Date|Purchased|Time|Timestamp)[\s:#]+(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})",
            r"\b(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})\b",
            r"\b(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})\b"
        ]
        for pat in date_patterns:
            m = re.search(pat, text, re.I)
            if m:
                raw_d = m.group(1).replace(".", "-").replace("/", "-")
                parts = raw_d.split("-")
                try:
                    if len(parts[0]) == 4:
                        dt = datetime.strptime(raw_d, "%Y-%m-%d")
                        result["purchase_date"] = dt.strftime("%Y-%m-%d")
                        break
                    elif len(parts[2]) == 4:
                        try:
                            dt = datetime.strptime(raw_d, "%m-%d-%Y")
                        except ValueError:
                            dt = datetime.strptime(raw_d, "%d-%m-%Y")
                        result["purchase_date"] = dt.strftime("%Y-%m-%d")
                        break
                except Exception:
                    pass

        # 5. Product / Item Name Detection
        item_match = re.search(r"(?:Item|Product|Description|Item Name)[\s:#]+([^\n\r]+)", text, re.I)
        if item_match:
            result["name"] = item_match.group(1).strip()
        else:
            # Check line items with price, e.g. "DysonV15DetectCordless-$749.99", "MacBookPro16M3Max-$3499.00"
            for line in lines:
                m = re.search(r"^([A-Za-z0-9\s&'./_-]+?)\s*[-–]\s*[$€£₹¥]", line)
                if m:
                    cand = m.group(1).strip()
                    cand = re.sub(r"([a-z])([A-Z])", r"\1 \2", cand)
                    result["name"] = cand.strip()
                    break

        # If not matched by label, scan lines for popular consumer brands
        brands_list = [
            ("Apple", ["apple", "macbook", "iphone", "ipad", "airpods"]),
            ("Sony", ["sony", "playstation", "wh-1000xm", "bravia"]),
            ("Samsung", ["samsung", "galaxy"]),
            ("Dyson", ["dyson"]),
            ("Dell", ["dell", "alienware", "xps"]),
            ("HP", ["hp", "spectre", "envy", "pavilion"]),
            ("Lenovo", ["lenovo", "thinkpad", "legion"]),
            ("Asus", ["asus", "rog", "zenbook"]),
            ("Bose", ["bose", "quietcomfort"]),
            ("LG", ["lg", "oled"]),
            ("Logitech", ["logitech"]),
            ("Microsoft", ["microsoft", "surface", "xbox"]),
            ("Google", ["google", "pixel"]),
            ("Canon", ["canon"]),
            ("Nikon", ["nikon"]),
            ("Philips", ["philips"]),
            ("Nintendo", ["nintendo", "switch"])
        ]

        if not result["name"]:
            for brand_name, kws in brands_list:
                for line in lines:
                    low = line.lower()
                    if any(kw in low for kw in kws) and not any(ign in low for kw in kws for ign in ["receipt", "invoice", "record", "store", "total"]):
                        cand = re.sub(r"([a-z])([A-Z])", r"\1 \2", line)
                        result["name"] = cand.strip()
                        break
                if result["name"]:
                    break

        # 6. Brand Identification (only from detected name or text)
        if result["name"]:
            for brand_name, kws in brands_list:
                if any(kw in result["name"].lower() for kw in kws):
                    result["brand"] = brand_name
                    break

        # 7. Model & Serial Number (only if explicitly matched)
        model_match = re.search(r"(?:Model|M/N|Mod|Model No)[\s:#]+([A-Za-z0-9\-_/]+)", text, re.I)
        if model_match:
            result["model_number"] = model_match.group(1).strip()

        serial_match = re.search(r"(?:Serial|S/N|SN|Serial No)[\s:#]+([A-Za-z0-9\-_]+)", text, re.I)
        if serial_match:
            result["serial_number"] = serial_match.group(1).strip()

        # 8. Warranty Detection (ONLY if explicitly stated in text - NEVER defaulted)
        warranty_match = re.search(r"(?:Warranty|Guarantee)[\s:#]+(\d{1,2})\s*(?:Months|Month|Years|Year)", text, re.I)
        if warranty_match:
            num = int(warranty_match.group(1))
            if "year" in warranty_match.group(0).lower():
                num = num * 12
            result["warranty_duration_months"] = num

        return result

ai_service = AIService()
