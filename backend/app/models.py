from sqlalchemy import Column, Integer, String, Date, DateTime, Text
from sqlalchemy.sql import func
from app.db import Base


class Worker(Base):
    __tablename__ = "hours_workers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    jobber_user_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TimeEntry(Base):
    __tablename__ = "hours_time_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    worker_id = Column(Integer, nullable=False, index=True)
    worker_name = Column(String(100), nullable=False)
    entry_date = Column(Date, nullable=False)
    start_time = Column(String(10), nullable=False)  # HH:MM
    end_time = Column(String(10), nullable=False)    # HH:MM
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TimeOffRequest(Base):
    __tablename__ = "hours_time_off_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    worker_id = Column(Integer, nullable=False, index=True)
    worker_name = Column(String(100), nullable=False)
    # full_day | late_arrival | early_departure
    request_type = Column(String(20), nullable=False)
    request_date = Column(Date, nullable=False)
    # only set for late_arrival / early_departure
    time_from = Column(String(10), nullable=True)
    time_to = Column(String(10), nullable=True)
    notes = Column(Text, nullable=True)
    # only set for multi-day full_day requests
    request_date_to = Column(Date, nullable=True)
    # pending | approved | denied
    status = Column(String(20), nullable=False, default="pending")
    jobber_task_id = Column(String(100), nullable=True)
    admin_note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
