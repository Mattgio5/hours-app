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
    import re
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL is not set.")
    # Normalize to psycopg3 dialect (psycopg[binary]) — SQLAlchemy 2.x default on Python 3.14
    url = re.sub(r"^postgres(?:ql)?(?:\+\w+)?://", "postgresql+psycopg://", url)
    return create_engine(url, pool_pre_ping=True, future=True)


engine = _engine()
SessionLocal = scoped_session(
    sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
)
