from fastapi import APIRouter, Depends, status, HTTPException, Response
from sqlalchemy.orm import Session
from database import database, schemas, models
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from security import auth_token, security
from sqlalchemy import join, outerjoin, func, text
from typing import Optional, List
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

router = APIRouter(prefix="/profile", tags=["Profile"])

def find_user(user_id, db):
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    return user

@router.get("/", status_code=200)
def NameEmail(username: Optional[bool] = False, email: Optional[bool] = False, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):
    
    user_id = user.id

    user = find_user(user_id, db)

    if username == True and email == True:
        return {
            "name": user.name,
            "email": user.email
        }
    
    if username == True and email == False:
        return {
            "name": user.name
        }

    if email == True and username == False:
        return {
            "email": user.email
        }
    
    if username == False and email == False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="At least one field should be not empty")

@router.put("/name", status_code=200)
def NameUpdate(name: schemas.NameUpdate, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    user_id = user.id
    user = find_user(user_id, db)

    user.name = name.name
    db.commit()
    db.refresh(user)

    return {"name": user.name}
    
@router.put("/password", status_code=200)
def PasswordUpdate(data: schemas.PasswordUpdate, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    user_id = user.id

    user_check = find_user(user_id, db)

    password_check = security.verify_password(data.password, user_check.hashed_password)
    
    if not password_check:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Wrong password")

    user_check.hashed_password = security.hash_password(data.new_password)
    db.commit()

@router.delete("/user", status_code=204)
def UserDelete(user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    user_id = user.id

    user = find_user(user_id, db)

    db.delete(user)
    db.commit()
