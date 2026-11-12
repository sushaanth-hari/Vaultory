from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_username: Optional[str] = None
    telegram_notifications_enabled: Optional[bool] = None
    notify_30_days: Optional[bool] = None
    notify_7_days: Optional[bool] = None
    notify_1_day: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    is_active: bool
    telegram_chat_id: Optional[str] = None
    telegram_username: Optional[str] = None
    telegram_notifications_enabled: bool = False
    notify_30_days: bool = True
    notify_7_days: bool = True
    notify_1_day: bool = True
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

