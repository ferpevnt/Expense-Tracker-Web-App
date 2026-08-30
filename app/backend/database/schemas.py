from pydantic import BaseModel, ConfigDict, model_validator, ValidationError, EmailStr
from typing import Optional
from datetime import datetime
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
    password: str
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
    description: Optional[str]
    summ: Union[int, float]
    transaction_type: bool
    category_id: Optional[int]

class TransactionUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    summ: Optional[Union[int, float]]
    transaction_type: Optional[bool]
    category: Optional[int]

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