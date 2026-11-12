from typing import List, Dict, Any
from datetime import datetime, timezone
import time
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.notification_log import NotificationLog
from app.schemas.notification import (
    TelegramSettingsUpdate, 
    SendTestNotificationRequest, 
    NotificationLogResponse,
    TelegramSimulateMessageRequest
)
from app.services.telegram_service import telegram_service
from app.services.scheduler_service import warranty_scheduler
from app.core.config import settings
from app.api.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["Telegram Notifications & Settings"])

@router.get("/settings")
def get_telegram_settings(current_user: User = Depends(get_current_user)):
    bot_username = settings.TELEGRAM_BOT_USERNAME or "VaultoryWarrantyBot"
    # Deep link to start bot with user ID
    connect_link = f"https://t.me/{bot_username}?start={current_user.id}"
    
    return {
        "bot_username": bot_username,
        "connect_link": connect_link,
        "telegram_chat_id": current_user.telegram_chat_id,
        "telegram_username": current_user.telegram_username,
        "telegram_notifications_enabled": current_user.telegram_notifications_enabled,
        "notify_30_days": current_user.notify_30_days,
        "notify_7_days": current_user.notify_7_days,
        "notify_1_day": current_user.notify_1_day,
        "is_connected": bool(current_user.telegram_chat_id),
        "is_configured": telegram_service.is_configured
    }

@router.put("/settings")
def update_telegram_settings(
    settings_in: TelegramSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.telegram_chat_id = settings_in.telegram_chat_id.strip() if settings_in.telegram_chat_id else None
    current_user.telegram_username = settings_in.telegram_username.strip().replace("@", "") if settings_in.telegram_username else None
    current_user.telegram_notifications_enabled = settings_in.telegram_notifications_enabled
    current_user.notify_30_days = settings_in.notify_30_days
    current_user.notify_7_days = settings_in.notify_7_days
    current_user.notify_1_day = settings_in.notify_1_day

    db.commit()
    db.refresh(current_user)

    return get_telegram_settings(current_user)

@router.get("/bot-info")
def get_bot_info():
    """
    Returns public metadata on the Telegram Bot integration.
    """
    return {
        "bot_username": settings.TELEGRAM_BOT_USERNAME or "VaultoryWarrantyBot",
        "is_configured": telegram_service.is_configured,
        "is_polling_active": telegram_service.is_polling_active,
        "webhook_url": settings.TELEGRAM_WEBHOOK_URL or None
    }

@router.post("/test")
async def send_test_notification(
    req: SendTestNotificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Sends a test notification to verify the Telegram bot connection.
    """
    if not current_user.telegram_chat_id:
        raise HTTPException(
            status_code=400,
            detail="No Telegram Chat ID is linked to your account. Connect via the Telegram bot or enter your Chat ID."
        )

    user_display = current_user.full_name or current_user.email
    success = await telegram_service.send_test_notification(
        chat_id=current_user.telegram_chat_id,
        user_name=user_display
    )

    # Record log
    log = NotificationLog(
        user_id=current_user.id,
        notification_type="test",
        channel="telegram",
        status="sent" if success else "failed",
        message_preview="Test Telegram connectivity verification message",
        sent_at=datetime.now(timezone.utc)
    )
    db.add(log)
    db.commit()

    if not success and telegram_service.is_configured:
        raise HTTPException(
            status_code=500, 
            detail="Telegram delivery failed. Please verify your Chat ID and Bot Token in backend/.env."
        )

    return {
        "status": "success",
        "message": f"Test notification sent to Telegram Chat ID: {current_user.telegram_chat_id}"
    }

@router.post("/telegram/webhook")
async def telegram_webhook(request: Request):
    """
    Receives incoming Telegram updates sent by Telegram Bot API webhook.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    result = await telegram_service.process_telegram_update(payload)
    return {"status": "ok", "result": result}

@router.post("/telegram/simulate-message")
async def simulate_telegram_message(
    req: TelegramSimulateMessageRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Simulates an incoming Telegram message to verify the bot command processing
    and automated reply logic end-to-end without requiring an external webhook.
    """
    simulated_chat_id = req.chat_id or (current_user.telegram_chat_id if current_user.telegram_chat_id else str(current_user.id + 100000))
    simulated_update = {
        "update_id": req.update_id or int(time.time() * 1000) % 1000000000,
        "message": {
            "message_id": int(time.time()) % 100000,
            "from": {
                "id": int(simulated_chat_id) if simulated_chat_id.isdigit() else 99999999,
                "is_bot": False,
                "first_name": current_user.full_name or "Test User",
                "username": req.username or current_user.telegram_username or "vaultory_user"
            },
            "chat": {
                "id": int(simulated_chat_id) if simulated_chat_id.isdigit() else 99999999,
                "type": "private",
                "first_name": current_user.full_name or "Test User",
                "username": req.username or current_user.telegram_username or "vaultory_user"
            },
            "date": int(time.time()),
            "text": req.text
        }
    }
    result = await telegram_service.process_telegram_update(simulated_update)
    return result

@router.get("/logs", response_model=List[NotificationLogResponse])
def get_notification_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logs = (
        db.query(NotificationLog)
        .filter(NotificationLog.user_id == current_user.id)
        .order_by(NotificationLog.sent_at.desc())
        .limit(50)
        .all()
    )
    return logs

@router.post("/trigger-scan")
def trigger_manual_scheduler_scan(
    current_user: User = Depends(get_current_user)
):
    """
    Manually triggers the APScheduler warranty notification check.
    Useful for testing and verification without waiting for the 6-hour interval.
    """
    sent_count = warranty_scheduler.check_and_send_warranty_reminders()
    return {
        "status": "completed",
        "notifications_dispatched": sent_count,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
