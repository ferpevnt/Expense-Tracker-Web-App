from pydantic import BaseModel, ConfigDict, model_validator, ValidationError, EmailStr, Field
from typing import Optional
from datetime import datetime, date
from typing import List, Union

# ===== AUTHORIZATION =====
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    id: int

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=56)
    confirm_password: str

    @model_validator(mode="after")
    def password_same_check(self):
        if self.password != self.confirm_password:
            raise ValueError("Passwords don't match!")
        return self

# ===== CATEGORIES =====
class CategoryCreate(BaseModel):
    category: str
    emoji: str

class CategoryUpdate(BaseModel):
    category: Optional[str] = None
    emoji: Optional[str] = None

    @model_validator(mode="after")
    def validate_null(self):
        if self.category is None and self.emoji is None:
            raise ValueError("Both fields can not be empty")
        return self

class Category(BaseModel):
    id: int
    category: str
    emoji: str
    transaction_count: int

class CategoryGraph(BaseModel):
    id: int
    emoji: str
    transaction_count: int

class Categories(BaseModel):
    id: int
    category: str
    emoji: str

# ===== TRANSACTIONS =====
class TransactionCreate(BaseModel):
    title: str
    description: Optional[str] = None
    summ: Union[int, float]
    transaction_type: bool
    category_id: Optional[int] = None

class TransactionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    summ: Optional[Union[int, float]] = None
    transaction_type: Optional[bool] = None
    category: Optional[int] = None

    @model_validator(mode='after')
    def validate_null(self):
        if all(value is None for value in self.model_dump().values()):
            raise ValueError("At least one field should be not empty")
        return self

class TransactionOut(BaseModel):
    id: int
    title: str
    description: Union[str, None]
    summ: Union[int, float]
    transaction_type: bool
    created_date: datetime
    category_id: Union[int, None]
    category: Union[str, None] 
    emoji: Union[str, None]

# ===== PROFILE =====
class NameUpdate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)

class PasswordUpdate(BaseModel):
    password: str 
    new_password: str = Field(..., min_length=8, max_length=56)

    @model_validator(mode='after')
    def same_passwords(self):
        if self.password == self.new_password:
            raise ValueError("New password should differ from the old one")
        return self 
