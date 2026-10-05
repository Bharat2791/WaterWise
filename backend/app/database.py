from sqlalchemy import create_engine, text
from sqlalchemy import inspect
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from app.models.complaint import Complaint
    from app.models.user import User

    Base.metadata.create_all(bind=engine)
    complaint_columns = {column["name"] for column in inspect(engine).get_columns(Complaint.__tablename__)}
    if "submitted_by_id" not in complaint_columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE complaints ADD COLUMN submitted_by_id INTEGER REFERENCES users(id)"))
    with engine.begin() as conn:
        conn.execute(text("SELECT 1"))
