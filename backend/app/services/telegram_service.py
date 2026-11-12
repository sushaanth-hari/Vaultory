import logging
import httpx
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class TelegramService:
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None

    async def send_message(self, chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
        """
        Sends a message via Telegram Bot API.
        If bot token is not set, logs the message and simulates delivery for testing.
        """
        if not chat_id:
            logger.warning("No chat_id provided for Telegram message.")
            return False

        if not self.bot_token:
            logger.info(f"[SIMULATED TELEGRAM MESSAGE to Chat ID: {chat_id}]\n{text}")
            return True

        url = f"{self.base_url}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": text,
            "parse_mode": parse_mode
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, json=payload)
                if res.status_code == 200:
                    logger.info(f"Telegram notification sent successfully to {chat_id}")
                    return True
                else:
                    logger.error(f"Telegram API error {res.status_code}: {res.text}")
                    return False
        except Exception as e:
            logger.error(f"Failed to send Telegram message ({e})")
            return False

    async def send_warranty_reminder(self, user, product, days_remaining: int) -> bool:
        """
        Dispatches structured warranty reminder.
        """
        if not user.telegram_chat_id or not user.telegram_notifications_enabled:
            return False

        emoji = "⏳" if days_remaining > 7 else ("⚠️" if days_remaining > 1 else "🚨")
        urgency = "Reminder" if days_remaining > 7 else ("URGENT" if days_remaining > 1 else "FINAL NOTICE")
        
        w = product.warranty
        end_date_str = str(w.end_date) if w else "N/A"
        
        message = (
            f"<b>{emoji} Vaultory Warranty Alert: {urgency}</b>\n\n"
            f"Hello <b>{user.full_name or 'Vaultory User'}</b>,\n"
            f"The warranty for your registered product is expiring soon:\n\n"
            f"📦 <b>Product:</b> {product.name}\n"
            f"🏷️ <b>Brand/Model:</b> {product.brand or 'N/A'} {product.model_number or ''}\n"
            f"📅 <b>Expiration Date:</b> {end_date_str}\n"
            f"⏱️ <b>Time Remaining:</b> <b>{days_remaining} day(s)</b>\n"
            f"🛡️ <b>Coverage:</b> {w.warranty_type if w else 'Manufacturer'}\n\n"
            f"Need service or a claim? You can generate your digital ownership & warranty evidence report directly in Vaultory."
        )

        return await self.send_message(user.telegram_chat_id, message)

    async def send_test_notification(self, chat_id: str, user_name: str) -> bool:
        """
        Sends a test verification message to verify Telegram bot connectivity.
        """
        message = (
            f"<b>🎉 Vaultory Telegram Bot Connected!</b>\n\n"
            f"Hello <b>{user_name}</b>,\n"
            f"Your Telegram account has been successfully linked to your <b>Vaultory</b> digital product ownership account.\n\n"
            f"You will now receive proactive notifications:\n"
            f"• 30 days before warranty expiration\n"
            f"• 7 days before warranty expiration\n"
            f"• 1 day before final expiration\n\n"
            f"Stay protected and never miss a claim deadline!"
        )
        return await self.send_message(chat_id, message)

telegram_service = TelegramService()

