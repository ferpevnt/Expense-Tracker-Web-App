from fastapi import APIRouter, Depends, status, HTTPException, Response
from sqlalchemy.orm import Session, joinedload
from database import database, schemas, models
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from security import auth_token
from sqlalchemy import join, outerjoin, func, text
from typing import Optional, List, Union
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

router = APIRouter(prefix="/transactions", tags=["Transactions"])

def find_transaction(id, user_id, db):
    
    transaction = db.query(models.Transaction).filter(models.Transaction.user_id == user.id, models.Transaction.id == id).first()

    if transaction == None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found")
    
    return transaction

@router.post("/transaction", status_code=201, response_model=schemas.TransactionOut)
def TransactionCreate(transaction_data: schemas.TransactionCreate, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):
    
    new_transaction = models.Transaction(
        title = transaction_data.title,
        description = transaction_data.description,
        summ = transaction_data.summ,
        transaction_type = transaction_data.transaction_type,
        category_id = transaction_data.category_id,
        user_id = user.id
    )

    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)

    transaction = db.query(
        models.Transaction.id,
        models.Transaction.title,
        models.Transaction.description,
        models.Transaction.summ,
        models.Transaction.transaction_type,
        models.Transaction.created_date,
        models.Category.category,
        models.Category.emoji
    ).outerjoin(
        models.Category, models.Category.id == models.Transaction.category_id
    ).filter(
        models.Transaction.id == new_transaction.id
    ).first()

    return transaction

@router.put("/transaction/{id}", status_code=200, response_model=schemas.TransactionOut)
def TransactionUpdate(id: int, transaction_data: schemas.TransactionUpdate, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):
    
    transaction = find_transaction(id, user.id, db)

    if transaction_data.title is not None:
        transaction.title = transaction_data.title
    
    if transaction_data.description is not None:
        transaction.description = transaction_data.description
    
    if transaction_data.summ is not None:
        transaction.summ = transaction_data.summ
    
    if transaction_data.transaction_type is not None:
        transaction.transaction_type = transaction_data.transaction_type
    
    if transaction_data.category is not None and transaction_data.category == 0:
        transaction.category_id = None
    
    if transaction_data.category is not None:
        transaction.category_id = transaction_data.category
    
    db.commit()

    transaction = db.query(
        models.Transaction.id,
        models.Transaction.title,
        models.Transaction.description,
        models.Transaction.summ,
        models.Transaction.transaction_type,
        models.Transaction.created_date,
        models.Transaction.category_id,
        models.Category.category,
        models.Category.emoji
    ).outerjoin(
        models.Category, models.Category.id == models.Transaction.category_id
    ).filter(
        models.Transaction.id == transaction.id
    ).first()

    return transaction

@router.delete("/transaction/{id}", status_code=204)
def TransactionDelete(id: int, user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    transaction = find_transaction(id, user.id, db)

    db.delete(transaction)
    db.commit()
    return

@router.get("/filtered", status_code=200, response_model=List[schemas.TransactionOut])
def TransactionsLoad(page: int,
                    
                    search: Optional[str],
                    t_type: Optional[bool] = None,
                    category: Optional[int] = None,
                    
                    min_sum: Optional[int] = None,
                    max_sum: Optional[int] = None,

                    start: Optional[date] = None,
                    end: Optional[date] = None,

                    sort: Optional[str] = None,

                    user: models.User = Depends(auth_token.get_current_user),
                    db: Session=Depends(database.get_db)):
    
    if page < 1:
        raise HTTPException(
            status_code=400,
            detail="Page must be greater than 0")

    transactions = db.query(
        models.Transaction.id,
        models.Transaction.title,
        models.Transaction.description,
        models.Transaction.summ,
        models.Transaction.transaction_type,
        models.Transaction.created_date,
        models.Transaction.category_id,
        models.Category.category,
        models.Category.emoji
    ).outerjoin(
        models.Category, models.Category.id == models.Transaction.category_id
    ).filter(
        models.Transaction.user_id == user.id
    )

    if search is not None:
        transactions = transactions.filter(
            models.Transaction.title.ilike(f"%{search}%") |
            models.Transaction.description.ilike(f"%{search}%")
        )
    
    if t_type is not None:
        if t_type == True:
            transactions = transactions.filter(
                models.Transaction.transaction_type == True
            )
        elif t_type == False:
            transactions = transactions.filter(
                models.Transaction.transaction_type == False
            )
    
    if category is not None:
        transactions = transactions.filter(
            models.Transaction.category_id == category
        )

    if min_sum is not None and max_sum is not None:
        transactions = transactions.filter(
            models.Transaction.summ >= min_sum,
            models.Transaction.summ <= max_sum
        )
    if min_sum is not None and max_sum is None:
        transactions = transactions.filter(
            models.Transaction.summ >= min_sum
        )
    if max_sum is not None and min_sum is None:
        transactions = transactions.filter(
            models.Transaction.summ <= max_sum
        )
        
    if start is not None and end is not None:
        transactions = transactions.filter(
            func.date(models.Transaction.created_date) >= start,
            func.date(models.Transaction.created_date) <= end
        )
    if start is not None and end is None:
        transactions = transactions.filter(
            func.date(models.Transaction.created_date) >= start
        )
    if end is not None and start is None:
        transactions = transactions.filter(
            func.date(models.Transaction.created_date) <= end
        )
    
    if sort is not None:
        if sort == "date_created_new":
            transactions = transactions.order_by(
                models.Transaction.created_date.desc()
            )
        elif sort == "date_created_old":
            transactions = transactions.order_by(
                models.Transaction.created_date.asc()
            )
        elif sort == "amount_high":
            transactions = transactions.order_by(
                models.Transaction.summ.desc()
            )
        elif sort == "amount_low":
            transactions = transactions.order_by(
                models.Transaction.summ.asc()
            )
        elif sort == "A-Z":
            transactions = transactions.order_by(
                models.Transaction.title.asc()
            )
        elif sort == "Z-A":
            transactions = transactions.order_by(
                models.Transaction.title.desc()
            )
        else:
            raise HTTPException(status_code=400,
            detail="Wrong sorting filter")

    else:
        transactions = transactions.order_by(
            models.Transaction.created_date.desc()
        )

    skip = (page - 1) * 15

    transactions = transactions.offset(skip).limit(15).all()

    return transactions

