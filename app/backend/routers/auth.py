from fastapi import APIRouter, Depends, status, HTTPException, Response
from fastapi.security.oauth2 import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import database, schemas, models
from security import security, auth_token

router = APIRouter(tags=["Authentification"])

def find_user(email, db):
    user = db.query(models.User).filter(models.User.email == email).first()
    return user

@router.post("/auth/login", status_code=200)
def Login(user: schemas.UserLogin, db: Session=Depends(database.get_db)):

    user_check = find_user(user.email, db)

    if not user_check:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong Credentials"
        )
    
    password_check = security.verify_password(user.password, user_check.hashed_password)

    if not password_check:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong Credentials"
        )

    access_token = auth_token.create_auth_token(data={"user_id": user_check.id})

    return {"access_token": access_token,
            "token_type": "bearer",
            "id": user_check.id,
            "name": user_check.name,
            "email": user_check.email}

@router.post("/auth/signup", status_code=201)
def Create(user: schemas.UserCreate, db: Session=Depends(database.get_db)):

    existing_user = find_user(user.email, db)

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists"
        )

    hashed_password = security.hash_password(user.password)

    new_user = models.User(
        name = user.name,
        email = user.email,
        hashed_password = hashed_password,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {
        "id": new_user.id,
        "name": new_user.name,
        "email": new_user.email
        }