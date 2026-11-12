import os
import sys
from datetime import date, datetime, timedelta, timezone
from PIL import Image, ImageDraw, ImageFont

# Add backend and workspace to sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
if os.getcwd() not in sys.path:
    sys.path.insert(0, os.getcwd())

from app.core.database import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.core.config import settings
from app.models.user import User
from app.models.product import Product
from app.models.warranty import Warranty
from app.models.condition_photo import ConditionPhoto
from app.models.repair import Repair
from app.models.notification_log import NotificationLog

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

def create_sample_image(filename: str, title: str, subtitle: str, bg_color: tuple, accent_color: tuple) -> str:
    path = os.path.join(settings.UPLOAD_DIR, filename)
    if os.path.exists(path):
        return f"/uploads/{filename}"

    img = Image.new("RGB", (600, 450), color=bg_color)
    draw = ImageDraw.Draw(img)

    # Decorative border & header
    draw.rectangle([(20, 20), (580, 430)], outline=accent_color, width=3)
    draw.rectangle([(20, 20), (580, 70)], fill=accent_color)
    
    # Text
    draw.text((35, 35), "VAULTORY VERIFIED ASSET RECORD", fill=(255, 255, 255))
    draw.text((40, 110), title, fill=(15, 23, 42))
    draw.text((40, 160), subtitle, fill=(100, 116, 139))
    draw.text((40, 220), f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S UTC')}", fill=(71, 85, 105))
    draw.text((40, 260), "Status: Cryptographically Timestamped & Archived", fill=(37, 99, 235))

    # Grid / target mark
    draw.line([(300, 310), (300, 390)], fill=accent_color, width=2)
    draw.line([(260, 350), (340, 350)], fill=accent_color, width=2)
    draw.ellipse([(275, 325), (325, 375)], outline=accent_color, width=2)

    img.save(path, format="JPEG")
    return f"/uploads/{filename}"

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        # Check if demo user already exists
        user = db.query(User).filter(User.email == "demo@vaultory.io").first()
        if not user:
            user = User(
                email="demo@vaultory.io",
                hashed_password=get_password_hash("Password123!"),
                full_name="Alex Reynolds",
                is_active=True,
                telegram_chat_id="582910482",
                telegram_username="alex_reynolds",
                telegram_notifications_enabled=True,
                notify_30_days=True,
                notify_7_days=True,
                notify_1_day=True,
                created_at=datetime.now(timezone.utc) - timedelta(days=120)
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            print("Created Demo User: demo@vaultory.io / Password123!")
        else:
            print("Demo user already exists.")

        # Create sample images
        receipt1_url = create_sample_image("receipt_sony_xm5.jpg", "Best Buy Official Receipt #1042", "Sony WH-1000XM5 - $399.99", (248, 250, 252), (37, 99, 235))
        orig_sony_url = create_sample_image("sony_xm5_orig.jpg", "Sony WH-1000XM5 Condition Baseline", "Brand new out-of-box condition, pristine earcups", (241, 245, 249), (16, 185, 129))
        curr_sony_url = create_sample_image("sony_xm5_curr.jpg", "Sony WH-1000XM5 6-Month Verification", "Minimal headband scuff, functional condition 100%", (241, 245, 249), (245, 158, 11))

        receipt2_url = create_sample_image("receipt_macbook.jpg", "Apple Store 5th Ave Invoice #APP-9921", "MacBook Pro 16 M3 Max - $3,499.00", (248, 250, 252), (15, 23, 42))
        orig_mbp_url = create_sample_image("macbook_orig.jpg", "MacBook Pro 16 M3 Max Baseline", "Space Black unblemished chassis & screen", (241, 245, 249), (16, 185, 129))

        receipt3_url = create_sample_image("receipt_dyson.jpg", "Dyson Direct Order #DYS-38291", "Dyson V15 Detect Cordless - $749.99", (248, 250, 252), (168, 85, 247))
        orig_dyson_url = create_sample_image("dyson_orig.jpg", "Dyson V15 Detect Baseline", "Pristine roller head & bin", (241, 245, 249), (16, 185, 129))

        # Check existing products
        p1 = db.query(Product).filter(Product.user_id == user.id, Product.name.ilike("%WH-1000XM5%")).first()
        if not p1:
            p1 = Product(
                user_id=user.id,
                name="Sony WH-1000XM5 Wireless Headphones",
                brand="Sony",
                model_number="WH1000XM5/B",
                serial_number="S01-94827103",
                category="Electronics",
                purchase_date=date.today() - timedelta(days=120),
                purchase_price=399.99,
                currency="USD",
                retailer="Best Buy",
                receipt_url=receipt1_url,
                receipt_filename="bestbuy_receipt_xm5.jpg",
                notes="Purchased with 2-year extended warranty package.",
                created_at=datetime.now(timezone.utc) - timedelta(days=120)
            )
            db.add(p1)
            db.commit()
            db.refresh(p1)

            w1 = Warranty(
                product_id=p1.id,
                duration_months=24,
                start_date=p1.purchase_date,
                end_date=p1.purchase_date + timedelta(days=730),
                warranty_type="Manufacturer",
                coverage_details="Full parts and labor for acoustic drivers, ANC sensors, and battery.",
                provider_contact="support.sony.com / 1-800-222-7669",
                status="active"
            )
            db.add(w1)

            ph1 = ConditionPhoto(
                product_id=p1.id,
                photo_url=orig_sony_url,
                photo_type="original",
                caption="Day 1 Baseline Photograph: Zero scratches or headband wear",
                taken_at=datetime.now(timezone.utc) - timedelta(days=120)
            )
            ph2 = ConditionPhoto(
                product_id=p1.id,
                photo_url=curr_sony_url,
                photo_type="current",
                caption="Month 4 Inspection: Normal light desk usage",
                taken_at=datetime.now(timezone.utc) - timedelta(days=5)
            )
            db.add_all([ph1, ph2])

            rep1 = Repair(
                product_id=p1.id,
                service_center="Sony Authorized Service Depot - NYC",
                repair_date=date.today() - timedelta(days=40),
                description="Right swivel hinge realignment and firmware calibration.",
                cost=0.00,
                currency="USD",
                warranty_covered=True,
                status="Completed"
            )
            db.add(rep1)
            db.commit()
            print("Seeded Product 1: Sony WH-1000XM5")

        # Product 2: MacBook Pro (Expiring Soon - 22 days left)
        p2 = db.query(Product).filter(Product.user_id == user.id, Product.name.ilike("%MacBook Pro%")).first()
        if not p2:
            p2 = Product(
                user_id=user.id,
                name="MacBook Pro 16\" (M3 Max, 36GB, 1TB)",
                brand="Apple",
                model_number="A2991",
                serial_number="C02K9872MD6R",
                category="Computing",
                purchase_date=date.today() - timedelta(days=343),
                purchase_price=3499.00,
                currency="USD",
                retailer="Apple Store 5th Ave",
                receipt_url=receipt2_url,
                receipt_filename="apple_invoice_macbook.jpg",
                notes="Space Black finish. Registered to Apple ID.",
                created_at=datetime.now(timezone.utc) - timedelta(days=343)
            )
            db.add(p2)
            db.commit()
            db.refresh(p2)

            # End date in 22 days (Expiring Soon threshold!)
            w2 = Warranty(
                product_id=p2.id,
                duration_months=12,
                start_date=p2.purchase_date,
                end_date=date.today() + timedelta(days=22),
                warranty_type="Manufacturer",
                coverage_details="Apple Limited 1-Year Hardware Warranty.",
                provider_contact="support.apple.com / 1-800-MY-APPLE",
                status="expiring_soon"
            )
            db.add(w2)

            ph_mbp = ConditionPhoto(
                product_id=p2.id,
                photo_url=orig_mbp_url,
                photo_type="original",
                caption="Unboxing baseline: Flawless Liquid Retina XDR display",
                taken_at=datetime.now(timezone.utc) - timedelta(days=343)
            )
            db.add(ph_mbp)
            db.commit()
            print("Seeded Product 2: MacBook Pro (Expiring Soon)")

        # Product 3: Dyson Vacuum (Expired Warranty)
        p3 = db.query(Product).filter(Product.user_id == user.id, Product.name.ilike("%Dyson%")).first()
        if not p3:
            p3 = Product(
                user_id=user.id,
                name="Dyson V15 Detect Absolute Cordless Vacuum",
                brand="Dyson",
                model_number="368340-01",
                serial_number="DYS-829104-NA",
                category="Appliances",
                purchase_date=date.today() - timedelta(days=800),
                purchase_price=749.99,
                currency="USD",
                retailer="Dyson Direct",
                receipt_url=receipt3_url,
                receipt_filename="dyson_order_v15.jpg",
                notes="Registered on MyDyson app.",
                created_at=datetime.now(timezone.utc) - timedelta(days=800)
            )
            db.add(p3)
            db.commit()
            db.refresh(p3)

            w3 = Warranty(
                product_id=p3.id,
                duration_months=24,
                start_date=p3.purchase_date,
                end_date=p3.purchase_date + timedelta(days=730),
                warranty_type="Manufacturer",
                coverage_details="2-year limited warranty against original manufacturing defects.",
                provider_contact="dyson.com/support",
                status="expired"
            )
            db.add(w3)

            ph_dyson = ConditionPhoto(
                product_id=p3.id,
                photo_url=orig_dyson_url,
                photo_type="original",
                caption="Unboxing condition: Brand new with all attachments",
                taken_at=datetime.now(timezone.utc) - timedelta(days=800)
            )
            db.add(ph_dyson)

            rep_dyson = Repair(
                product_id=p3.id,
                service_center="Dyson Service Center - Manhattan",
                repair_date=date.today() - timedelta(days=120),
                description="HEPA exhaust filter assembly replacement and motor deep clean.",
                cost=45.00,
                currency="USD",
                warranty_covered=False,
                status="Completed"
            )
            db.add(rep_dyson)
            db.commit()
            print("Seeded Product 3: Dyson V15 Detect (Expired Warranty)")

        # Seed initial notification log
        log1 = NotificationLog(
            user_id=user.id,
            product_id=p2.id if p2 else None,
            notification_type="30_days",
            channel="telegram",
            status="sent",
            message_preview="⚠️ Warranty Expiration Notice: 30 Days Remaining for MacBook Pro 16\"",
            sent_at=datetime.now(timezone.utc) - timedelta(days=8)
        )
        db.add(log1)
        db.commit()
        print("Database seeded with sample ownership data successfully!")

    except Exception as e:
        print(f"Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()

