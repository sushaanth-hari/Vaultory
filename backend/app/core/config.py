import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "Vaultory - AI Product Ownership & Warranty Management"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg://postgres:postgres@localhost:5432/vaultory")
    FALLBACK_SQLITE_URL: str = "sqlite:///./vaultory.db"
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "vaultory_super_secret_jwt_key_2026_production_grade_change_in_env")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # External Services
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", "")
    
    CLOUDINARY_CLOUD_NAME: Optional[str] = os.getenv("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY: Optional[str] = os.getenv("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET: Optional[str] = os.getenv("CLOUDINARY_API_SECRET", "")
    
    TELEGRAM_BOT_TOKEN: Optional[str] = os.getenv("TELEGRAM_BOT_TOKEN", "")
    TELEGRAM_BOT_USERNAME: Optional[str] = os.getenv("TELEGRAM_BOT_USERNAME", "VaultoryWarrantyBot")
    
    TESSERACT_CMD: Optional[str] = os.getenv("TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe")
    UPLOAD_DIR: str = os.path.join(os.getcwd(), "backend", "uploads")
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

