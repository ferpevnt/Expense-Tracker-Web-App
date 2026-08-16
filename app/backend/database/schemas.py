from pydantic import BaseModel, ConfigDict, model_validator, ValidationError, EmailStr
from typing import Optional
from datetime import datetime
from typing import List

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

