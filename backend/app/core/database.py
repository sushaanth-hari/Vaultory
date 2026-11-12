import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

engine = None
SessionLocal = None
Base = declarative_base()

def initialize_engine():
    global engine, SessionLocal
    # Try PostgreSQL first
    pg_url = settings.DATABASE_URL
    try:
        logger.info(f"Attempting connection to PostgreSQL database at {pg_url.split('@')[-1] if '@' in pg_url else pg_url}...")
        test_engine = create_engine(pg_url, pool_pre_ping=True, connect_args={"connect_timeout": 1})
        with test_engine.connect() as conn:
            pass
        engine = test_engine
        logger.info("Successfully connected to PostgreSQL database!")
    except Exception as e:
        logger.warning(f"Could not connect to PostgreSQL ({e}). Falling back to local SQLite database: {settings.FALLBACK_SQLITE_URL}")
        engine = create_engine(
            settings.FALLBACK_SQLITE_URL,
            connect_args={"check_same_thread": False}
        )
    
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return engine

initialize_engine()

def get_db():
    global SessionLocal
    if SessionLocal is None:
        initialize_engine()
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

