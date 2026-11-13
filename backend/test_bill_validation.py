import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.services.ocr_service import ocr_service
from app.services.ai_service import ai_service

def run_bill_tests():
    print("=" * 65)
    print("RUNNING BILL EXTRACTION, REJECTION & ANTI-HALLUCINATION TESTS")
    print("=" * 65)

    # ---------------------------------------------------------
    # TEST 1: Reject Invalid Files (Non-bill text, blank, condition photo)
    # ---------------------------------------------------------
    print("\n--- Test 1: Invalid Bill Rejection ---")
    
    # 1A. Blank / Too short text
    is_valid, reason = ai_service.validate_receipt_text("")
    assert not is_valid, "Blank text must be rejected"
    print("✓ Blank text rejected:", reason)

    # 1B. Random non-bill text (e.g. essay, meeting notes)
    random_doc = "Meeting notes from Monday. We discussed the Q3 product roadmap and sprint goals with the design team."
    is_valid, reason = ai_service.validate_receipt_text(random_doc)
    assert not is_valid, "Random non-bill text must be rejected"
    print("✓ Non-bill document rejected:", reason)

    # 1C. Condition photo text (baseline asset record, not a receipt)
    condition_text = (
        "VAULTORYVERIFIEDASSETRECORD\n"
        "SonyWH-1000XM5Condition Baseline\n"
        "Brandnewoutof-boxcondition.pristineearcups\n"
        "Timestamp2026-11-1212:00:28UTC\n"
        "Status.CryptographicallyTimestamped&Archived"
    )
    is_valid, reason = ai_service.validate_receipt_text(condition_text)
    assert not is_valid, "Condition baseline photo must be rejected as bill"
    print("✓ Condition baseline photo text rejected:", reason)

    # 1D. Real condition image file (backend/uploads/dyson_orig.jpg)
    dyson_orig_path = os.path.join(backend_dir, "uploads", "dyson_orig.jpg")
    if os.path.exists(dyson_orig_path):
        ocr_text = ocr_service.extract_text_from_file(dyson_orig_path)
        is_valid, reason = ai_service.validate_receipt_text(ocr_text)
        assert not is_valid, "dyson_orig.jpg must be rejected as an invalid bill"
        print("✓ Actual condition photo image (dyson_orig.jpg) rejected:", reason)

    # ---------------------------------------------------------
    # TEST 2: Extract Exact Content from Valid Bills
    # ---------------------------------------------------------
    print("\n--- Test 2: Exact Content Extraction from Valid Bills ---")

    # 2A. Real receipt image: receipt_sony_xm5.jpg
    sony_receipt_path = os.path.join(backend_dir, "uploads", "receipt_sony_xm5.jpg")
    if os.path.exists(sony_receipt_path):
        ocr_text = ocr_service.extract_text_from_file(sony_receipt_path)
        assert ocr_text, "OCR text must not be empty"
        data = ai_service.structure_receipt_text(ocr_text)
        assert data["is_valid_receipt"] is True, f"receipt_sony_xm5.jpg must be valid, got: {data}"
        assert data["purchase_price"] == 399.99, f"Expected 399.99, got {data['purchase_price']}"
        assert "Sony" in (data["brand"] or data["name"]), "Expected Sony brand"
        assert data["purchase_date"] == "2026-11-12", f"Expected 2026-11-12, got {data['purchase_date']}"
        print(f"✓ Extracted receipt_sony_xm5.jpg: Item='{data['name']}', Price=${data['purchase_price']}, Date={data['purchase_date']}, Retailer='{data['retailer']}'")

    # 2B. Real receipt image: receipt_macbook.jpg
    macbook_receipt_path = os.path.join(backend_dir, "uploads", "receipt_macbook.jpg")
    if os.path.exists(macbook_receipt_path):
        ocr_text = ocr_service.extract_text_from_file(macbook_receipt_path)
        data = ai_service.structure_receipt_text(ocr_text)
        assert data["is_valid_receipt"] is True
        assert data["purchase_price"] == 3499.00, f"Expected 3499.00, got {data['purchase_price']}"
        assert "Apple" in (data["brand"] or data["retailer"]), "Expected Apple retailer/brand"
        print(f"✓ Extracted receipt_macbook.jpg: Item='{data['name']}', Price=${data['purchase_price']}, Date={data['purchase_date']}, Retailer='{data['retailer']}'")

    # 2C. Real receipt image: receipt_dyson.jpg
    dyson_receipt_path = os.path.join(backend_dir, "uploads", "receipt_dyson.jpg")
    if os.path.exists(dyson_receipt_path):
        ocr_text = ocr_service.extract_text_from_file(dyson_receipt_path)
        data = ai_service.structure_receipt_text(ocr_text)
        assert data["is_valid_receipt"] is True
        assert data["purchase_price"] == 749.99, f"Expected 749.99, got {data['purchase_price']}"
        assert data["brand"] == "Dyson"
        print(f"✓ Extracted receipt_dyson.jpg: Item='{data['name']}', Price=${data['purchase_price']}, Date={data['purchase_date']}, Retailer='{data['retailer']}'")

    # ---------------------------------------------------------
    # TEST 3: Anti-Hallucination: Must NOT Create Details on Its Own
    # ---------------------------------------------------------
    print("\n--- Test 3: Anti-Hallucination & No Fabricated Defaults ---")

    # 3A. Valid bill with NO warranty mentioned -> must NOT default to 12 months!
    bill_without_warranty = (
        "WALMART SUPERCENTER #3210\n"
        "Order #492819\n"
        "Date: 2024-10-22\n"
        "Item: Samsung 55-Inch 4K UHD Smart TV\n"
        "Price: $378.00\n"
        "Total Paid: $378.00\n"
        "Payment: Master Card ending in 4102"
    )
    res_no_warranty = ai_service.structure_receipt_text(bill_without_warranty)
    assert res_no_warranty["is_valid_receipt"] is True
    assert res_no_warranty["warranty_duration_months"] is None, (
        f"Must NOT invent 12 months warranty when none is stated on bill! Got: {res_no_warranty['warranty_duration_months']}"
    )
    assert res_no_warranty["purchase_price"] == 378.00
    assert res_no_warranty["purchase_date"] == "2024-10-22"
    assert res_no_warranty["name"] == "Samsung 55-Inch 4K UHD Smart TV"
    print("✓ Bill without warranty duration: warranty_duration_months is None (NOT fabricated!)")

    # 3B. Valid bill with explicit warranty mentioned -> must extract exact stated duration
    bill_with_warranty = (
        "TARGET STORE #1042\n"
        "Receipt #TG-9481\n"
        "Date: 2024-05-18\n"
        "Item: Sony WH-1000XM5 Wireless Headphones\n"
        "Price: $399.99\n"
        "Total Paid: $399.99\n"
        "Warranty: 24 Months Manufacturer Warranty"
    )
    res_with_warranty = ai_service.structure_receipt_text(bill_with_warranty)
    assert res_with_warranty["is_valid_receipt"] is True
    assert res_with_warranty["warranty_duration_months"] == 24, (
        f"Expected exact 24 months warranty from bill, got {res_with_warranty['warranty_duration_months']}"
    )
    assert res_with_warranty["purchase_price"] == 399.99
    assert res_with_warranty["purchase_date"] == "2024-05-18"
    assert res_with_warranty["retailer"] == "TARGET STORE #1042"
    print("✓ Bill with 24 months warranty: extracted exact 24 months!")

    # 3C. Valid bill without date -> must NOT default to today's date!
    bill_no_date = (
        "BEST BUY RETAIL STORE\n"
        "Receipt #BB-20391\n"
        "Item: Nintendo Switch OLED\n"
        "Total: $349.99\n"
        "Cash Paid: $350.00\n"
        "Change: $0.01"
    )
    res_no_date = ai_service.structure_receipt_text(bill_no_date)
    assert res_no_date["is_valid_receipt"] is True
    assert res_no_date["purchase_date"] is None, (
        f"Must NOT invent today's date when not on bill! Got: {res_no_date['purchase_date']}"
    )
    print("✓ Bill without date: purchase_date is None (NOT defaulted to today!)")

    print("\n" + "=" * 65)
    print("ALL BILL EXTRACTION & VALIDATION TESTS PASSED PERFECTLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_bill_tests()

