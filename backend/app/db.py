from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, scoped_session, sessionmaker

APP_DIR = Path(__file__).resolve().parent
load_dotenv(APP_DIR / ".env")


class Base(DeclarativeBase):
    pass


def _engine():
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set.")
    # Force psycopg2 dialect so SQLAlchemy 2.x doesn't try psycopg3
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            url = "postgresql+psycopg2://" + url[len(prefix):]
            break
    return create_engine(url, pool_pre_ping=True, future=True)


engine = _engine()
SessionLocal = scoped_session(
    sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
)
