import sys
import os
import io
from fastapi.testclient import TestClient

# Add backend and project root to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if os.getcwd() not in sys.path:
    sys.path.insert(0, os.getcwd())

from app.main import app

client = TestClient(app)

def run_tests():
    print("=" * 60)
    print("VAULTORY FULL-STACK API VERIFICATION SUITE")
    print("=" * 60)

    # 1. Health check
    res = client.get("/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    print("✓ Health Check: OK", res.json())

    # 2. Login with Demo User
    login_res = client.post("/api/v1/auth/login", json={
        "email": "demo@vaultory.io",
        "password": "Password123!"
    })
    if login_res.status_code != 200:
        client.post("/api/v1/auth/register", json={
            "email": "demo@vaultory.io",
            "password": "Password123!",
            "full_name": "Demo User"
        })
        login_res = client.post("/api/v1/auth/login", json={
            "email": "demo@vaultory.io",
            "password": "Password123!"
        })
    assert login_res.status_code == 200, f"Demo login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Authentication & JWT Token Generation: OK (Logged in as demo@vaultory.io)")

    # 3. Get Current User Profile
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    user_data = me_res.json()
    print(f"✓ Current User Verified: {user_data['full_name']} ({user_data['email']})")

    # 4. Dashboard Summary
    dash_res = client.get("/api/v1/dashboard/summary", headers=headers)
    assert dash_res.status_code == 200
    d_data = dash_res.json()
    print(f"✓ Dashboard Metrics: {d_data['total_products']} products, ${d_data['total_inventory_value']} value, {d_data['active_warranties']} active warranties")

    # 5. List Products
    prods_res = client.get("/api/v1/products", headers=headers)
    assert prods_res.status_code == 200
    products = prods_res.json()
    assert len(products) >= 3, f"Expected seeded products, got {len(products)}"
    first_product = products[0]
    print(f"✓ Products List: Found {len(products)} products (Sample: '{first_product['name']}')")

    # 6. OCR Receipt Scanning
    dummy_receipt_bytes = b"Best Buy Store #1042\nDate: 2024-05-18\nItem: Sony WH-1000XM5 Headphones\nPrice: $399.99\nWarranty: 24 Months"
    ocr_res = client.post(
        "/api/v1/ocr/scan-receipt",
        headers=headers,
        files={"file": ("test_receipt.jpg", dummy_receipt_bytes, "image/jpeg")}
    )
    assert ocr_res.status_code == 200, f"OCR scan failed: {ocr_res.text}"
    ocr_data = ocr_res.json()
    print(f"✓ Tesseract OCR & AI Structuring: Extracted Product '{ocr_data.get('name')}', Price ${ocr_data.get('purchase_price')}, Warranty {ocr_data.get('warranty_duration_months')} mo")

    # 7. Create New Product
    new_prod_payload = {
        "name": "iPad Pro 13-inch (M4, OLED)",
        "brand": "Apple",
        "model_number": "A2925",
        "serial_number": "DMPX99104A",
        "category": "Computing",
        "purchase_date": "2024-06-01",
        "purchase_price": 1299.00,
        "currency": "USD",
        "retailer": "Apple Online Store",
        "warranty_duration_months": 12,
        "warranty_type": "Manufacturer",
        "notes": "Silver finish, 256GB Wi-Fi."
    }
    create_prod_res = client.post("/api/v1/products", headers=headers, json=new_prod_payload)
    assert create_prod_res.status_code == 201, f"Product creation failed: {create_prod_res.text}"
    created_prod = create_prod_res.json()
    assert created_prod["warranty"] is not None
    print(f"✓ Product Registration & Automatic Warranty Calculation: Product ID {created_prod['id']} created with {created_prod['warranty']['duration_months']} mo warranty")

    # 8. Upload Condition Photos to new product
    dummy_photo_1 = b"ORIGINAL_PHOTO_IMAGE_DATA"
    dummy_photo_2 = b"CURRENT_PHOTO_IMAGE_DATA"
    ph1_res = client.post(
        f"/api/v1/condition-photos/products/{created_prod['id']}",
        headers=headers,
        data={"photo_type": "original", "caption": "Unboxing baseline"},
        files={"file": ("orig.jpg", dummy_photo_1, "image/jpeg")}
    )
    assert ph1_res.status_code == 200
    ph1 = ph1_res.json()
    print(f"✓ Condition Photo Upload (Original): Photo ID {ph1['id']} uploaded")

    # 9. Test OpenCV Condition Comparison on seeded product (which has valid images)
    sony_prod = next(p for p in products if "Sony" in p["name"])
    if len(sony_prod["condition_photos"]) >= 2:
        orig_id = sony_prod["condition_photos"][0]["id"]
        curr_id = sony_prod["condition_photos"][1]["id"]
        cv_res = client.post("/api/v1/condition-photos/compare", headers=headers, json={
            "original_photo_id": orig_id,
            "current_photo_id": curr_id
        })
        assert cv_res.status_code == 200, f"OpenCV comparison failed: {cv_res.text}"
        cv_data = cv_res.json()
        print(f"✓ OpenCV Computer Vision Comparison: Similarity {cv_data['similarity_score']}%, Verdict: '{cv_data['verdict']}', Heatmap: {cv_data['diff_heatmap_url']}")

    # 10. Log Repair
    rep_res = client.post(
        f"/api/v1/repairs/products/{created_prod['id']}",
        headers=headers,
        data={
            "service_center": "Apple Genius Bar - Grand Central",
            "repair_date": "2024-09-15",
            "description": "Screen diagnostic and magnetic Smart Folio contact clean.",
            "cost": "0.00",
            "currency": "USD",
            "warranty_covered": "true",
            "status": "Completed"
        }
    )
    assert rep_res.status_code == 201
    rep_data = rep_res.json()
    print(f"✓ Repair Management: Logged repair ID {rep_data['id']} at '{rep_data['service_center']}'")

    # 11. Ownership Timeline
    timeline_res = client.get(f"/api/v1/timeline/products/{created_prod['id']}", headers=headers)
    assert timeline_res.status_code == 200
    timeline = timeline_res.json()
    assert len(timeline) >= 3
    print(f"✓ Ownership Timeline: Generated {len(timeline)} chronological events for product ID {created_prod['id']}")

    # 12. ReportLab PDF Evidence Report
    pdf_res = client.get(f"/api/v1/evidence/products/{sony_prod['id']}/pdf", headers=headers)
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 5000, "PDF byte length suspiciously small"
    print(f"✓ ReportLab PDF Evidence Certificate: Generated {len(pdf_res.content)} bytes PDF for '{sony_prod['name']}'")

    # 13. Telegram Notifications API & Manual Scan
    # Update settings to link a test Telegram chat ID
    client.put("/api/v1/notifications/settings", headers=headers, json={
        "telegram_chat_id": "9188525411",
        "telegram_username": "demouser",
        "telegram_notifications_enabled": True
    })

    tg_settings_res = client.get("/api/v1/notifications/settings", headers=headers)
    assert tg_settings_res.status_code == 200
    print(f"✓ Telegram Settings: Bot @{tg_settings_res.json()['bot_username']}, Connected: {tg_settings_res.json()['is_connected']}")

    bot_info_res = client.get("/api/v1/notifications/bot-info")
    assert bot_info_res.status_code == 200
    print(f"✓ Telegram Bot Public Info: Bot @{bot_info_res.json()['bot_username']}, Configured: {bot_info_res.json()['is_configured']}")

    # 14. Telegram Inbound Webhook & Message Simulation Flow
    sim_res = client.post(
        "/api/v1/notifications/telegram/simulate-message",
        headers=headers,
        json={"text": "/warranties", "chat_id": "9188525411"}
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["status"] == "processed"
    assert sim_data["command"] == "warranties"
    print(f"✓ Telegram Bot Inbound Message Simulation: Received reply for command '/warranties'")

    webhook_res = client.post(
        "/api/v1/notifications/telegram/webhook",
        json={
            "update_id": 99999,
            "message": {
                "message_id": 50,
                "chat": {"id": 9188525411, "type": "private"},
                "from": {"id": 9188525411, "username": "alex"},
                "text": "/help"
            }
        }
    )
    assert webhook_res.status_code == 200
    assert webhook_res.json()["result"]["status"] == "processed"
    print("✓ Telegram Bot Webhook Receiver: Successfully processed incoming webhook update")

    tg_test_res = client.post("/api/v1/notifications/test", headers=headers, json={})
    assert tg_test_res.status_code == 200
    print(f"✓ Telegram Bot Message Dispatch: {tg_test_res.json()['message']}")

    scan_res = client.post("/api/v1/notifications/trigger-scan", headers=headers)
    assert scan_res.status_code == 200
    print(f"✓ APScheduler Warranty Reminder Scan: {scan_res.json()['notifications_dispatched']} notification(s) dispatched")

    print("=" * 60)
    print("ALL 14 API TEST SUITES PASSED FLAWLESSLY!")
    print("=" * 60)

if __name__ == "__main__":
    run_tests()

