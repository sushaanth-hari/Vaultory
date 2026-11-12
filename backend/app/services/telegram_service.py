import asyncio
import collections
import logging
import threading
from datetime import date, datetime, timezone
from typing import Optional, Dict, Any, List

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User
from app.models.product import Product
from app.models.warranty import Warranty
from app.models.notification_log import NotificationLog

logger = logging.getLogger("vaultory.telegram")

class TelegramService:
    def __init__(self):
        self.bot_token = settings.TELEGRAM_BOT_TOKEN or ""
        self.bot_username = settings.TELEGRAM_BOT_USERNAME or "VaultoryWarrantyBot"
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None
        
        # Deduplication tracking: keep track of processed update IDs (up to 5,000)
        self._processed_update_ids = set()
        self._update_order = collections.deque(maxlen=5000)
        self._dedup_lock = threading.Lock()
        
        # Polling state
        self._is_polling = False
        self._polling_task: Optional[asyncio.Task] = None
        self._last_offset = 0

    @property
    def is_configured(self) -> bool:
        return bool(self.bot_token and len(self.bot_token.strip()) > 5)

    @property
    def is_polling_active(self) -> bool:
        return self._is_polling and self._polling_task is not None and not self._polling_task.done()

    def reload_config(self):
        """Reload configuration when settings change."""
        self.bot_token = settings.TELEGRAM_BOT_TOKEN or ""
        self.bot_username = settings.TELEGRAM_BOT_USERNAME or "VaultoryWarrantyBot"
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}" if self.bot_token else None

    # ==========================================
    # Deduplication
    # ==========================================
    def is_duplicate_update(self, update_id: int) -> bool:
        """
        Thread-safe check to determine if an update_id has already been processed.
        Prevents duplicate message handling across webhooks and polling.
        """
        with self._dedup_lock:
            if update_id in self._processed_update_ids:
                return True
            self._processed_update_ids.add(update_id)
            self._update_order.append(update_id)
            # Evict old IDs if exceeding capacity
            if len(self._update_order) > 5000:
                oldest = self._update_order.popleft()
                self._processed_update_ids.discard(oldest)
            return False

    # ==========================================
    # Outbound Messaging
    # ==========================================
    async def send_message(self, chat_id: str, text: str, parse_mode: str = "HTML") -> bool:
        """
        Sends a message via Telegram Bot API.
        If bot token is not set, logs the message and simulates delivery for testing.
        """
        if not chat_id:
            logger.warning("No chat_id provided for Telegram message.")
            return False

        if not self.is_configured:
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
            logger.error(f"Failed to send Telegram message to {chat_id}: {e}")
            return False

    async def send_warranty_reminder(self, user: User, product: Product, days_remaining: int) -> bool:
        """
        Dispatches structured warranty reminder message.
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
            f"Need service or a claim? You can generate your digital ownership & warranty evidence report directly in Vaultory.\n"
            f"Type /warranties to review all your active products."
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
            f"<b>You will now receive proactive notifications:</b>\n"
            f"• 30 days before warranty expiration\n"
            f"• 7 days before warranty expiration\n"
            f"• 1 day before final expiration\n\n"
            f"<b>Commands you can try:</b>\n"
            f"• /warranties - View your products & expiration dates\n"
            f"• /status - Check your account connection & alert preferences\n"
            f"• /help - Display the command guide"
        )
        return await self.send_message(chat_id, message)

    # ==========================================
    # Inbound Telegram Message & Command Handlers
    # ==========================================
    def handle_start_command(self, chat_id: str, sender: Dict[str, Any], payload: str, db: Session) -> str:
        """
        Handles the /start command. Supports deep-linking argument: /start <user_id_or_code>.
        """
        sender_username = sender.get("username")
        payload = payload.strip() if payload else ""

        # Case 1: Deep linking payload provided (/start 1 or /start demo@vaultory.io)
        if payload:
            user = None
            if payload.isdigit():
                user = db.query(User).filter(User.id == int(payload)).first()
            if not user:
                user = db.query(User).filter(func.lower(User.email) == payload.lower()).first()

            if user:
                # Link account
                user.telegram_chat_id = str(chat_id)
                if sender_username:
                    user.telegram_username = sender_username
                user.telegram_notifications_enabled = True
                db.commit()

                # Audit log
                log = NotificationLog(
                    user_id=user.id,
                    notification_type="link",
                    channel="telegram",
                    status="sent",
                    message_preview=f"Linked Telegram chat ID {chat_id} via /start",
                    sent_at=datetime.now(timezone.utc)
                )
                db.add(log)
                db.commit()

                return (
                    f"🎉 <b>Welcome to Vaultory, {user.full_name or 'Owner'}!</b>\n\n"
                    f"Your Telegram account has been successfully linked to your Vaultory account (<code>{user.email}</code>).\n\n"
                    f"✅ <b>Proactive Warranty Alerts:</b> ACTIVE\n"
                    f"• 30 days before expiration\n"
                    f"• 7 days before expiration (Urgent)\n"
                    f"• 1 day before deadline (Final notice)\n\n"
                    f"<b>Available Commands:</b>\n"
                    f"📦 /warranties - List your registered products & warranty statuses\n"
                    f"📊 /status - View account status & alert settings\n"
                    f"❓ /help - View command menu\n"
                    f"🔌 /unlink - Disconnect your Telegram account"
                )
            else:
                return (
                    f"⚠️ <b>Vaultory Account Not Found</b>\n\n"
                    f"We could not find an account matching linking token: <code>{payload}</code>.\n\n"
                    f"To connect your account:\n"
                    f"1. Open <b>Vaultory</b> in your browser.\n"
                    f"2. Visit <b>Telegram Alerts</b> and click <b>Connect Telegram Bot</b>.\n"
                    f"<i>Or reply here with:</i> <code>/link your_email@example.com</code>"
                )

        # Case 2: No argument supplied (/start)
        # Check if chat_id is already linked
        existing_user = db.query(User).filter(User.telegram_chat_id == str(chat_id)).first()
        if existing_user:
            return (
                f"👋 <b>Welcome back to Vaultory, {existing_user.full_name or 'Owner'}!</b>\n\n"
                f"Your Telegram account is connected to <code>{existing_user.email}</code>.\n"
                f"Proactive warranty monitoring is active.\n\n"
                f"<b>Commands:</b>\n"
                f"📦 /warranties - View your products & warranty status\n"
                f"📊 /status - Check account connection & settings\n"
                f"❓ /help - Show all available commands"
            )

        return (
            f"👋 <b>Welcome to Vaultory Assistant!</b>\n\n"
            f"I am your automated digital product ownership & warranty alert bot.\n\n"
            f"To connect your Vaultory account:\n"
            f"1️⃣ Go to your <b>Vaultory Dashboard</b> → <b>Telegram Alerts</b>.\n"
            f"2️⃣ Click <b>Connect with Telegram</b>.\n\n"
            f"<i>Or link right now by typing:</i>\n"
            f"<code>/link your_registered_email@example.com</code>"
        )

    def handle_link_command(self, chat_id: str, sender: Dict[str, Any], identifier: str, db: Session) -> str:
        """
        Handles the /link <email_or_user_id> command.
        """
        if not identifier:
            return (
                "ℹ️ <b>How to Link Your Account:</b>\n\n"
                "Please provide your registered Vaultory email or user ID:\n"
                "<code>/link your_email@example.com</code>\n"
                "or\n"
                "<code>/link 1</code>"
            )

        identifier = identifier.strip()
        user = None
        if identifier.isdigit():
            user = db.query(User).filter(User.id == int(identifier)).first()
        if not user:
            user = db.query(User).filter(func.lower(User.email) == identifier.lower()).first()

        if not user:
            return (
                f"⚠️ <b>Account Not Found</b>\n\n"
                f"No Vaultory account matches '<code>{identifier}</code>'.\n"
                f"Please ensure you have registered on Vaultory and check your email address."
            )

        user.telegram_chat_id = str(chat_id)
        if sender.get("username"):
            user.telegram_username = sender.get("username")
        user.telegram_notifications_enabled = True
        db.commit()

        # Audit log
        log = NotificationLog(
            user_id=user.id,
            notification_type="link",
            channel="telegram",
            status="sent",
            message_preview=f"Linked Telegram chat ID {chat_id} via /link",
            sent_at=datetime.now(timezone.utc)
        )
        db.add(log)
        db.commit()

        return (
            f"🎉 <b>Successfully Connected!</b>\n\n"
            f"Your Telegram account is now linked to <b>{user.full_name or user.email}</b> (<code>{user.email}</code>).\n\n"
            f"Automated warranty alerts are now active for all your registered products.\n\n"
            f"Type /warranties to view your active product warranties."
        )

    def handle_warranties_command(self, chat_id: str, db: Session) -> str:
        """
        Handles the /warranties or /products command: lists user's products and warranty status.
        """
        user = db.query(User).filter(User.telegram_chat_id == str(chat_id)).first()
        if not user:
            return (
                "⚠️ <b>Account Not Linked</b>\n\n"
                "This Telegram chat is not connected to a Vaultory account.\n"
                "To link your account, send:\n"
                "<code>/link your_registered_email@example.com</code>"
            )

        products = db.query(Product).filter(Product.user_id == user.id).all()
        if not products:
            return (
                f"📦 <b>No Products Found</b>\n\n"
                f"Hello {user.full_name or 'Owner'}, you don't have any products registered in Vaultory yet.\n\n"
                f"Add your first product by uploading a receipt in the Vaultory web app!"
            )

        today = date.today()
        lines = [f"🛡️ <b>Your Vaultory Products & Warranties</b> ({len(products)} total):\n"]

        for idx, prod in enumerate(products, start=1):
            w = prod.warranty
            if not w:
                lines.append(f"{idx}. 📦 <b>{prod.name}</b> ({prod.brand or 'N/A'})\n   • Warranty: <i>No warranty recorded</i>\n")
                continue

            days_left = (w.end_date - today).days if w.end_date else 0
            if days_left < 0:
                status_badge = f"🔴 Expired ({abs(days_left)} days ago)"
            elif days_left <= 7:
                status_badge = f"🚨 URGENT: Expiring in {days_left} day(s)"
            elif days_left <= 30:
                status_badge = f"🟡 Expiring Soon ({days_left} days left)"
            else:
                status_badge = f"🟢 Active ({days_left} days left)"

            lines.append(
                f"{idx}. 📦 <b>{prod.name}</b>\n"
                f"   🏷️ Brand: {prod.brand or 'N/A'} {prod.model_number or ''}\n"
                f"   📅 Expires: <b>{w.end_date}</b>\n"
                f"   ⏱️ Status: {status_badge}\n"
                f"   🛡️ Type: {w.warranty_type}\n"
            )

        lines.append("<i>Visit your Vaultory web app to generate Evidence PDFs or log repairs.</i>")
        return "\n".join(lines)

    def handle_status_command(self, chat_id: str, db: Session) -> str:
        """
        Handles the /status command: returns connection and alert configuration.
        """
        user = db.query(User).filter(User.telegram_chat_id == str(chat_id)).first()
        if not user:
            return (
                "⚠️ <b>Account Not Linked</b>\n\n"
                "This Telegram chat is not connected to any Vaultory account.\n"
                "To link, send: <code>/link your_registered_email@example.com</code>"
            )

        product_count = db.query(Product).filter(Product.user_id == user.id).count()
        today = date.today()
        active_warranties = (
            db.query(Warranty)
            .join(Product, Warranty.product_id == Product.id)
            .filter(Product.user_id == user.id, Warranty.end_date >= today)
            .count()
        )

        return (
            f"📊 <b>Vaultory Account Status</b>\n\n"
            f"👤 <b>Account:</b> {user.full_name or 'N/A'} (<code>{user.email}</code>)\n"
            f"💬 <b>Telegram Chat ID:</b> <code>{user.telegram_chat_id}</code>\n"
            f"🔔 <b>Notifications:</b> {'✅ Enabled' if user.telegram_notifications_enabled else '❌ Disabled'}\n\n"
            f"<b>Reminder Thresholds:</b>\n"
            f"• 30 Days before expiration: {'✅ Active' if user.notify_30_days else '❌ Inactive'}\n"
            f"• 7 Days before expiration: {'✅ Active' if user.notify_7_days else '❌ Inactive'}\n"
            f"• 1 Day before expiration: {'✅ Active' if user.notify_1_day else '❌ Inactive'}\n\n"
            f"<b>Inventory Summary:</b>\n"
            f"📦 Total Products: <b>{product_count}</b>\n"
            f"🛡️ Active Warranties: <b>{active_warranties}</b>\n\n"
            f"<i>Manage your preferences anytime in the Vaultory web dashboard.</i>"
        )

    def handle_unlink_command(self, chat_id: str, db: Session) -> str:
        """
        Handles the /unlink command: disconnects Telegram from Vaultory.
        """
        user = db.query(User).filter(User.telegram_chat_id == str(chat_id)).first()
        if not user:
            return "ℹ️ This Telegram chat is not currently linked to any Vaultory account."

        user_email = user.email
        user.telegram_chat_id = None
        user.telegram_notifications_enabled = False
        db.commit()

        # Audit log
        log = NotificationLog(
            user_id=user.id,
            notification_type="unlink",
            channel="telegram",
            status="sent",
            message_preview=f"Unlinked Telegram chat ID {chat_id}",
            sent_at=datetime.now(timezone.utc)
        )
        db.add(log)
        db.commit()

        return (
            f"🔌 <b>Vaultory Disconnected</b>\n\n"
            f"Your Telegram account has been unlinked from <code>{user_email}</code>.\n"
            f"You will no longer receive warranty expiration alerts here.\n\n"
            f"You can re-link anytime with: <code>/link {user_email}</code>"
        )

    def handle_help_command(self) -> str:
        """
        Handles the /help command.
        """
        return (
            "🤖 <b>Vaultory Telegram Bot Help & Commands:</b>\n\n"
            "• <b>/start</b> - Start bot or connect using your Vaultory link\n"
            "• <b>/link &lt;email&gt;</b> - Link your Vaultory account using email\n"
            "• <b>/warranties</b> - View all your registered products & warranty statuses\n"
            "• <b>/status</b> - View your account connection & alert preferences\n"
            "• <b>/unlink</b> - Disconnect this Telegram chat from Vaultory\n"
            "• <b>/help</b> - Show this help menu\n\n"
            "💡 <i>Tip: Vaultory will automatically alert you 30 days, 7 days, and 1 day before any warranty expires!</i>"
        )

    def handle_unknown_message(self, text: str) -> str:
        """
        Fallback response for unrecognized commands or unexpected messages.
        """
        cmd_preview = text.strip()[:30] if text else "your message"
        return (
            f"❓ <b>Unrecognized Command:</b> '<code>{cmd_preview}</code>'\n\n"
            f"I didn't quite catch that. Here are the commands I understand:\n\n"
            f"• <b>/warranties</b> - View your registered products\n"
            f"• <b>/status</b> - Check connection & reminder settings\n"
            f"• <b>/link &lt;email&gt;</b> - Connect your Vaultory account\n"
            f"• <b>/help</b> - View full command list"
        )

    # ==========================================
    # Unified Telegram Update Processor
    # ==========================================
    async def process_telegram_update(self, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Processes any incoming Telegram update (from Webhook, Polling, or Simulator).
        Includes duplicate message prevention, command routing, and automated reply dispatch.
        """
        update_id = update_data.get("update_id")
        if update_id is not None:
            if self.is_duplicate_update(update_id):
                logger.info(f"Duplicate Telegram update {update_id} skipped.")
                return {
                    "status": "skipped",
                    "reason": "duplicate",
                    "update_id": update_id
                }

        # Extract message object
        message = (
            update_data.get("message")
            or update_data.get("edited_message")
            or update_data.get("channel_post")
        )
        if not message:
            return {"status": "ignored", "reason": "no_message"}

        chat = message.get("chat", {})
        chat_id = str(chat.get("id", ""))
        sender = message.get("from", {})
        text = (message.get("text") or "").strip()

        if not chat_id:
            return {"status": "ignored", "reason": "no_chat_id"}

        # Route command
        db = SessionLocal()
        reply_text = ""
        command = ""

        try:
            if text.startswith("/"):
                parts = text.split(maxsplit=1)
                cmd_part = parts[0].lower()
                # Handle bots in groups (e.g. /start@VaultoryWarrantyBot)
                cmd_name = cmd_part.split("@")[0].lstrip("/")
                arg_part = parts[1].strip() if len(parts) > 1 else ""
                command = cmd_name

                if cmd_name == "start":
                    reply_text = self.handle_start_command(chat_id, sender, arg_part, db)
                elif cmd_name == "link":
                    reply_text = self.handle_link_command(chat_id, sender, arg_part, db)
                elif cmd_name in ("warranties", "products"):
                    reply_text = self.handle_warranties_command(chat_id, db)
                elif cmd_name == "status":
                    reply_text = self.handle_status_command(chat_id, db)
                elif cmd_name == "unlink":
                    reply_text = self.handle_unlink_command(chat_id, db)
                elif cmd_name == "help":
                    reply_text = self.handle_help_command()
                else:
                    reply_text = self.handle_unknown_message(text)
            else:
                # Plain text message
                reply_text = self.handle_unknown_message(text)

        except Exception as e:
            logger.error(f"Error processing Telegram message '{text}': {e}", exc_info=True)
            reply_text = (
                "⚠️ <b>An error occurred while processing your request.</b>\n"
                "Please try again or contact support."
            )
        finally:
            db.close()

        # Send reply back via Telegram API if configured
        dispatched = False
        if reply_text:
            dispatched = await self.send_message(chat_id, reply_text)

        return {
            "status": "processed",
            "update_id": update_id,
            "chat_id": chat_id,
            "command": command or "text",
            "input_text": text,
            "reply_text": reply_text,
            "dispatched": dispatched
        }

    # ==========================================
    # Background Long-Polling Runner
    # ==========================================
    async def _polling_loop(self):
        """
        Background task that performs Telegram long-polling (getUpdates).
        Maintains offset, runs continuously, and handles errors with exponential backoff.
        """
        logger.info("Telegram Bot long-polling loop initiated.")
        backoff_seconds = 2

        while self._is_polling:
            if not self.is_configured:
                await asyncio.sleep(5)
                continue

            try:
                url = f"{self.base_url}/getUpdates"
                params = {"timeout": 20, "allowed_updates": ["message"]}
                if self._last_offset > 0:
                    params["offset"] = self._last_offset

                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.get(url, params=params)

                if response.status_code == 200:
                    backoff_seconds = 2  # Reset backoff on success
                    data = response.json()
                    updates: List[Dict[str, Any]] = data.get("result", [])

                    for upd in updates:
                        upd_id = upd.get("update_id")
                        if upd_id:
                            self._last_offset = upd_id + 1
                        await self.process_telegram_update(upd)

                elif response.status_code == 409:
                    # Conflict: another instance or webhook is active
                    logger.warning("Telegram Bot getUpdates conflict (409): Another webhook or instance is running. Waiting 15s...")
                    await asyncio.sleep(15)
                elif response.status_code == 401:
                    logger.error("Telegram Bot Token is invalid (401 Unauthorized). Please check TELEGRAM_BOT_TOKEN in backend/.env.")
                    await asyncio.sleep(60)
                else:
                    logger.warning(f"Telegram Bot getUpdates status {response.status_code}: {response.text}")
                    await asyncio.sleep(backoff_seconds)
                    backoff_seconds = min(backoff_seconds * 2, 60)

            except asyncio.CancelledError:
                logger.info("Telegram Bot long-polling loop received cancellation.")
                break
            except Exception as e:
                logger.warning(f"Telegram polling network issue ({e}). Retrying in {backoff_seconds}s...")
                await asyncio.sleep(backoff_seconds)
                backoff_seconds = min(backoff_seconds * 2, 60)

        logger.info("Telegram Bot long-polling loop terminated.")

    async def start_polling(self):
        """
        Starts the background long-polling loop if a token is configured.
        """
        if self._is_polling:
            return

        self.reload_config()
        if not self.is_configured:
            logger.info("Telegram Bot Token is not set. Bot polling will remain inactive until configured.")
            return

        self._is_polling = True
        self._polling_task = asyncio.create_task(self._polling_loop())
        logger.info(f"Telegram Bot polling runner started for @{self.bot_username}.")

    async def stop_polling(self):
        """
        Stops the background long-polling loop gracefully.
        """
        self._is_polling = False
        if self._polling_task and not self._polling_task.done():
            self._polling_task.cancel()
            try:
                await self._polling_task
            except asyncio.CancelledError:
                pass
            self._polling_task = None
        logger.info("Telegram Bot polling stopped.")

telegram_service = TelegramService()
