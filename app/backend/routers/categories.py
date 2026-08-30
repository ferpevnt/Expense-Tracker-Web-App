from fastapi import APIRouter, Depends, status, HTTPException, Response
from sqlalchemy.orm import Session
from database import database, schemas, models
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from security import auth_token
from sqlalchemy import join, outerjoin, func, text
from typing import Optional, List
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta


router = APIRouter(prefix="/categories", tags=["Categories"])

def find_category(id: int, user_id: int, db: Session):
    category = db.query(models.Category).filter(models.Category.user_id == user_id,models.Category.id == id).first()
    
    if category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found")
    return category


@router.post("/category", status_code=201)
def CategoryCreate(category_data: schemas.CategoryCreate, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

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
def CategoryUpdate(id: int, category_data: schemas.CategoryUpdate, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):
    
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
        "id": category.id,
        "category": category.category,
        "emoji": category.emoji}

@router.delete("/category/{id}", status_code=204)
def CategoryDelete(id: int, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):
    
    category = find_category(id, user.id, db)

    db.delete(category)
    db.commit()
    return

# load transactions list on the page
@router.get("/filtered", status_code=200, response_model=List[schemas.Category])
def CategoriesLoad(search: Optional[str] = None, sort: Optional[str] = None, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    #user categories
    query = db.query(
        models.Category.id,
        models.Category.category,
        models.Category.emoji,
        func.coalesce(func.count(models.Transaction.category_id), 0).label("transaction_count")
        ).filter(models.Category.user_id == user.id)

    categories_filtered = query

    #search filter on user categories
    if search is not None:
        categories_filtered = categories_filtered.filter(models.Category.category.ilike(f"%{search}%"))

    categories_filtered = categories_filtered.outerjoin(
        models.Transaction,
        models.Transaction.category_id == models.Category.id
    ).group_by(
        models.Category.id
    )

    #sorting by specific values(400 error if wrong value)
    if sort is not None:
        if sort == "A-Z":
            categories_filtered = categories_filtered.order_by(models.Category.category.asc())
        elif sort == "Z-A":
            categories_filtered = categories_filtered.order_by(models.Category.category.desc())
        elif sort == "date_created_new":
            categories_filtered = categories_filtered.order_by(models.Category.created_date.desc())
        elif sort == "date_created_old":
            categories_filtered = categories_filtered.order_by(models.Category.created_date.asc())
        elif sort == "transaction_count_high":
            categories_filtered = categories_filtered.order_by(text("transaction_count DESC"))
        elif sort == "transaction_count_low":
            categories_filtered = categories_filtered.order_by(text("transaction_count ASC"))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wrong filter"
            )

    categories_filtered = categories_filtered.all()

    return categories_filtered

#data for graph
@router.get("/graph", status_code=200, response_model=List[schemas.CategoryGraph])
def GraphData(filtering: Optional[str] = None, user: models.User = Depends(auth_token.get_current_user),db: Session=Depends(database.get_db)):

    #user categories + transaction count for each category
    categories = db.query(
        models.Category.id,
        models.Category.emoji,
        func.coalesce(func.count(models.Transaction.category_id), 0).label("transaction_count"),
        models.Category.created_date
        ).filter(models.Category.user_id == user.id)
        
    categories = categories.outerjoin(
        models.Transaction,
        models.Transaction.category_id == models.Category.id).group_by(models.Category.id)

    #filtering by specific values(400 error if wrong value)
    if filtering is not None:
        if filtering == "today":
            categories = categories.filter(func.date(models.Category.created_date) == datetime.today().date())
        
        elif filtering == "yesterday":
            yesterday = datetime.today().date() - timedelta(days=1)
            categories = categories.filter(func.date(models.Category.created_date) == yesterday)
        
        elif filtering == "week":
            week = datetime.today().date() - timedelta(days=7)
            categories = categories.filter(func.date(models.Category.created_date) >= week)
        
        elif filtering == "month":
            month = datetime.today().date() - relativedelta(months=1)
            categories = categories.filter(func.date(models.Category.created_date) >= month)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wrong filter"
            )

    categories = categories.group_by(models.Category.id).all()

    return categories

# load categories for select menu when creating transaction
@router.get("/", status_code=200,response_model=List[schemas.Categories])
def Categories(user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    categories = db.query(
        models.Category.id,
        models.Category.category,
        models.Category.emoji
    ).filter(
        models.Category.user_id == user.id
    ).all()

    return categories