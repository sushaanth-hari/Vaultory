from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TelegramSettingsUpdate(BaseModel):
    telegram_chat_id: Optional[str] = None
    telegram_username: Optional[str] = None
    telegram_notifications_enabled: bool = False
    notify_30_days: bool = True
    notify_7_days: bool = True
    notify_1_day: bool = True

class SendTestNotificationRequest(BaseModel):
    message: Optional[str] = None

class TelegramSimulateMessageRequest(BaseModel):
    text: str
    chat_id: Optional[str] = "987654321"
    username: Optional[str] = "vaultory_user"
    update_id: Optional[int] = None

class NotificationLogResponse(BaseModel):
    id: int
    user_id: int
    product_id: Optional[int] = None
    notification_type: str
    channel: str
    status: str
    message_preview: Optional[str] = None
    sent_at: datetime

    class Config:
        from_attributes = True

