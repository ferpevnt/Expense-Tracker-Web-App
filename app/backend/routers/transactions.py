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

