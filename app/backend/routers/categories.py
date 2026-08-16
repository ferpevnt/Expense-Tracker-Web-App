from fastapi import APIRouter, Depends, status, HTTPException, Response
from sqlalchemy.orm import Session
from database import database, schemas, models
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from security import auth_token

router = APIRouter(prefix="/categories", tags=["Categories"])

def find_category(id: int, user_id: int, db: Session):
    category = db.query(models.Category).filter(models.Category.user_id == user_id,models.Category.id == id).first()
    
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found")
    return category


@router.post("/category", status_code=201)
def CreateCategory(category_data: schemas.CategoryCreate, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    existing_category = db.query(models.Category).filter(models.Category.user_id == user.id,models.Category.category == category_data.category).first()
    
    if existing_category is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category with such name already exists!"
        )

    new_category = models.Category(
        category = category_data.category,
        emoji = category_data.emoji,
        user_id = user.id
    )

    db.add(new_category)
    db.commit()
    db.refresh(new_category)

    return {
        "id": new_category.id,
        "category": new_category.category,
        "emoji": new_category.emoji}

@router.put("/category/{id}", status_code=200)
def CategoryUpdate(id: int,category_data: schemas.CategoryUpdate, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):
    
    category = find_category(id, user.id, db)

    if category_data.category is not None:
        existing_category = db.query(models.Category).filter(models.Category.user_id == user.id,models.Category.category == category_data.category).first()
    
        if existing_category is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Category with such name already exists!"
            )
        category.category = category_data.category

    if category_data.emoji is not None:
        category.emoji = category_data.emoji

    db.commit()
    db.refresh(category)

    return {
        "category": category.category,
        "emoji": category.emoji}

@router.delete("/category/{id}", status_code=204)
def CategoryDelete(id: int, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):
    
    category = find_category(id, user.id, db)

    db.delete(category)
    db.commit()
    return

