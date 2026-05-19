from sqlalchemy import Column, Integer, String, Float
from app.db import Base


class JobberToken(Base):
    __tablename__ = "jobber_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    access_token = Column(String, nullable=False)
    refresh_token = Column(String, nullable=False)
    expires_at = Column(Float, nullable=False)
