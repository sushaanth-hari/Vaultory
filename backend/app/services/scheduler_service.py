import asyncio
import logging
from datetime import date, datetime, timezone
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.database import SessionLocal
from app.models.warranty import Warranty
from app.models.product import Product
from app.models.user import User
from app.models.notification_log import NotificationLog
from app.services.telegram_service import telegram_service

logger = logging.getLogger(__name__)

class WarrantyScheduler:
    def __init__(self):
        self.scheduler = BackgroundScheduler()
        self.is_running = False

    def start(self):
        if not self.is_running:
            # Check daily at 09:00 UTC, or every 6 hours
            self.scheduler.add_job(
                self.check_and_send_warranty_reminders,
                'interval',
                hours=6,
                id='warranty_check_job',
                replace_existing=True
            )
            self.scheduler.start()
            self.is_running = True
            logger.info("Warranty reminder APScheduler started successfully.")

    def shutdown(self):
        if self.is_running:
            self.scheduler.shutdown()
            self.is_running = False
            logger.info("Warranty reminder APScheduler stopped.")

    def check_and_send_warranty_reminders(self):
        """
        Scans all warranties and dispatches notifications at 30 days, 7 days, and 1 day remaining.
        Ensures NO duplicate notifications are sent.
        """
        logger.info("Running automatic warranty reminder scan...")
        db = SessionLocal()
        today = date.today()
        sent_count = 0

        try:
            # Find all products with active warranties
            warranties = db.query(Warranty).all()
            
            for w in warranties:
                if not w.end_date:
                    continue
                
                days_left = (w.end_date - today).days
                
                # Update status if expired
                if days_left < 0 and w.status != "expired":
                    w.status = "expired"
                    db.commit()
                    continue
                elif days_left <= 30 and days_left >= 0 and w.status != "expiring_soon":
                    w.status = "expiring_soon"
                    db.commit()

                # Check if this matches one of the alert thresholds: 30, 7, 1
                if days_left not in [30, 7, 1]:
                    continue

                notif_type = f"{days_left}_days"
                product = w.product
                if not product or not product.user:
                    continue

                user = product.user
                
                # Verify user telegram settings
                if not user.telegram_chat_id or not user.telegram_notifications_enabled:
                    continue

                # Verify threshold preference
                if days_left == 30 and not user.notify_30_days:
                    continue
                if days_left == 7 and not user.notify_7_days:
                    continue
                if days_left == 1 and not user.notify_1_day:
                    continue

                # Prevent duplicates: Check if notification already logged for this product and threshold
                already_sent = db.query(NotificationLog).filter(
                    NotificationLog.user_id == user.id,
                    NotificationLog.product_id == product.id,
                    NotificationLog.notification_type == notif_type
                ).first()

                if already_sent:
                    continue

                # Send telegram message asynchronously
                try:
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    success = loop.run_until_complete(
                        telegram_service.send_warranty_reminder(user, product, days_left)
                    )
                    loop.close()
                except Exception as e:
                    logger.error(f"Error sending telegram reminder: {e}")
                    success = False

                # Record in NotificationLog
                log_entry = NotificationLog(
                    user_id=user.id,
                    product_id=product.id,
                    notification_type=notif_type,
                    channel="telegram",
                    status="sent" if success else "failed",
                    message_preview=f"Warranty expiration alert ({days_left} days left) for {product.name}",
                    sent_at=datetime.now(timezone.utc)
                )
                db.add(log_entry)
                db.commit()
                sent_count += 1
                logger.info(f"Dispatched {notif_type} warranty notification for product {product.id} to user {user.id}")

        except Exception as e:
            logger.error(f"Error during warranty reminder scan: {e}")
        finally:
            db.close()
            
        logger.info(f"Warranty reminder scan complete. Dispatched {sent_count} notification(s).")
        return sent_count

warranty_scheduler = WarrantyScheduler()

