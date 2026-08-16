from database.database import Base
from sqlalchemy import Column, Integer, String, ARRAY, TIMESTAMP, text, ForeignKey
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer, primary_key=True
    )
    name = Column(
        String, nullable=False
    )
    email = Column(
        String, nullable=False, unique=True
    )
    hashed_password = Column(
        String, nullable=False
    )
    created_date = Column(
        TIMESTAMP(timezone=True), nullable=False, server_default=text("now()")
    )

    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    categories = relationship("Category", cascade="all, delete-orphan")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(
        Integer, primary_key=True,
    )
    title = Column(
        String, nullable=False,
    )
    description = Column(
        String, nullable=True,
    )
    category_id = Column(
            Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    
    user = relationship("User", back_populates="transactions")
    category = relationship("Category", back_populates="category_transactions")


class Category(Base):
    __tablename__ = "categories"

    id = Column(
        Integer, primary_key=True
    )
    category = Column(
        String, nullable=False
    )
    emoji = Column(
        String, nullable=False
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )

    category_transactions = relationship("Transaction", back_populates="category")
    