import os
import sys

# Ensure both backend directory and project root are in sys.path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
root_dir = os.path.dirname(backend_dir)
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.database import Base, engine
# Import all models so metadata knows about all tables
import app.models
from app.services.scheduler_service import warranty_scheduler
from app.services.telegram_service import telegram_service

# Routers
from app.api.routers import (
    auth,
    products,
    warranties,
    condition_photos,
    repairs,
    timeline,
    evidence,
    notifications,
    dashboard,
    ocr
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("vaultory")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing Vaultory Backend Services...")
    # Create DB tables
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database schemas verified and initialized successfully.")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")

    # Ensure upload directory exists
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    # Start APScheduler for automatic warranty alerts
    try:
        warranty_scheduler.start()
    except Exception as e:
        logger.error(f"Could not start APScheduler: {e}")

    # Start Telegram Bot polling service if token is configured
    try:
        await telegram_service.start_polling()
    except Exception as e:
        logger.error(f"Could not start Telegram Bot polling: {e}")

    yield

    # Shutdown
    logger.info("Shutting down Vaultory...")
    try:
        await telegram_service.stop_polling()
    except Exception:
        pass
    try:
        warranty_scheduler.shutdown()
    except Exception:
        pass

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="AI-Powered Digital Product Ownership & Warranty Management System",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount local upload directory for receipts, condition photos, and OpenCV diffs
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include API Routers
v1_prefix = settings.API_V1_STR
app.include_router(auth.router, prefix=v1_prefix)
app.include_router(products.router, prefix=v1_prefix)
app.include_router(warranties.router, prefix=v1_prefix)
app.include_router(condition_photos.router, prefix=v1_prefix)
app.include_router(repairs.router, prefix=v1_prefix)
app.include_router(timeline.router, prefix=v1_prefix)
app.include_router(evidence.router, prefix=v1_prefix)
app.include_router(notifications.router, prefix=v1_prefix)
app.include_router(dashboard.router, prefix=v1_prefix)
app.include_router(ocr.router, prefix=v1_prefix)

@app.get("/")
def root():
    return {
        "app": settings.PROJECT_NAME,
        "version": "1.0.0",
        "status": "online",
        "api_docs": "/docs"
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "database": "connected",
        "scheduler_running": warranty_scheduler.is_running
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

