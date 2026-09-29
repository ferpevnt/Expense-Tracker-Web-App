from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from database import database, schemas, models
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from security import auth_token, security
from sqlalchemy import join, outerjoin, func, Float, case, cast
from typing import Optional, List
from datetime import datetime, timedelta, date as date_type, timezone
from dateutil.relativedelta import relativedelta

router = APIRouter(tags=["Dashboard"], prefix="/dashboard")

def filter_period_transactions(filtering, target_date, user_id, db):
    transactions = db.query(
        models.Transaction.title,
        models.Transaction.description,
        models.Transaction.summ,
        models.Transaction.transaction_type,
        models.Transaction.created_date,
        models.Category.id,
        models.Category.category,
        models.Category.emoji
    ).outerjoin(
        models.Category, models.Category.id == models.Transaction.category_id
    ).filter(
        models.Transaction.user_id == user_id
    )
    
    today = datetime.now(timezone.utc).date()

    if filtering == "today":
        transactions = transactions.filter(
            func.date(models.Transaction.created_date) == today
        )
    elif filtering == "yesterday":
        yesterday = today - relativedelta(days=1)
        transactions = transactions.filter(
            func.date(models.Transaction.created_date) == yesterday
        )
    elif filtering == "week":
        week = today - relativedelta(days=today.weekday())
        transactions = transactions.filter(
            func.date(models.Transaction.created_date) >= week
        )
    elif filtering == "month":
        month = today.replace(day=1)
        transactions = transactions.filter(
            func.date(models.Transaction.created_date) >= month
        )
    elif filtering == "date" and target_date is not None:
        transactions = transactions.filter(
            func.date(models.Transaction.created_date) == target_date
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong filter"
        )
    return transactions

@router.get("/transactions", status_code=200, response_model=List[schemas.DashboardTransactionsOut])
def TransactionsLoad(user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    transactions = db.query(
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
        models.Transaction.user_id == user.id
    ).order_by(
        models.Transaction.created_date.desc()   
    ).limit(
        10
        ).all()

    return transactions

@router.get("/finances", status_code=200)
def FinancesStatistics(filtering: str, target_date: Optional[str] = None, user: models.User = Depends(auth_token.get_current_user), db: Session = Depends(database.get_db)):
    
    parsed_date = None
    if target_date:
        parsed_date = date_type.fromisoformat(target_date)

    days_map = {"today": 1, "yesterday": 1, "week": 7, "month": 30, "date": 1}
    if filtering not in days_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong filter"
        )
    days = days_map[filtering]

    user_id = user.id
    transactions = filter_period_transactions(filtering, parsed_date, user_id, db)

    transactions = transactions.filter(
        models.Transaction.transaction_type == False
    )

    total = func.sum(models.Transaction.summ)
    row = transactions.with_entities(
        func.avg(models.Transaction.summ).label("avg_summ"),
        func.max(models.Transaction.summ).label("max_summ"),
        func.count(models.Transaction.summ).label("transaction_amount"),
        total.label("transaction_whole_summ"),
    ).one()

    whole_summ = row.transaction_whole_summ or 0
    avg_summ = row.avg_summ or 0
    max_summ = row.max_summ or 0
    count = row.transaction_amount or 0
    avg_per_day = (whole_summ / days) if days else 0

    expenses_info = {
        "avg_summ": avg_summ,
        "max_summ": max_summ,
        "transaction_amount": count,
        "transaction_whole_summ": whole_summ,
        "avg_per_day": avg_per_day,
    }
    categories_total = func.sum(models.Transaction.summ).label("total")
    
    rows = transactions.with_entities(
        models.Category.id,
        models.Category.category,
        models.Category.emoji,
        categories_total,
    ).group_by(
        models.Category.id
    ).order_by(
        categories_total.desc()
    ).all()
    
    categories_info = []
    for r in rows:
        total_val = float(r.total) if r.total is not None else 0.0
        percent = (total_val * 100 / float(whole_summ)) if whole_summ > 0 else 0.0
        categories_info.append({
            "id": r.id,
            "category": r.category,
            "emoji": r.emoji,
            "total": total_val,
            "percent": percent,
        })
    
    categories_top_3 = categories_info[:3]

    return {
        "expenses_info": expenses_info,
        "categories_top_3": categories_top_3,
        "categories_expense_percent": categories_info,
    }

@router.get("/graphs", status_code=200,response_model=schemas.GraphsData)
def GraphsData(
    date_start: date_type,
    date_end: Optional[date_type] = None,
    previous_date_start: Optional[date_type] = None,
    previous_date_end: Optional[date_type] = None,
    user: models.User=Depends(auth_token.get_current_user),
    db: Session=Depends(database.get_db)):

    user_id = user.id

    def expenses_days_weekdays(date_start, date_end, user_id, db):
        if date_end:

            transactions_more_4 = db.query(
                models.Transaction.title,
                func.count(models.Transaction.title)
            ).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.created_date >= date_start,
                models.Transaction.created_date <= date_end,
                models.Transaction.transaction_type == False
                ).group_by(
                models.Transaction.title
            ).having(
                func.count(models.Transaction.title) >= 4
            ).all()

            expenses_days = db.query(
                models.Transaction.created_date,
                func.sum(models.Transaction.summ).label("day_expenses")
            ).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.created_date >= date_start,
                models.Transaction.created_date <= date_end,
                models.Transaction.transaction_type == False
            ).group_by(
                models.Transaction.created_date
            ).all()

            expenses_week_days = db.query(
                func.to_char(models.Transaction.created_date, 'Day').label("week_day"),
                func.sum(models.Transaction.summ).label("weekday_expenses")
            ).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.created_date >= date_start,
                models.Transaction.created_date <= date_end,
                models.Transaction.transaction_type == False
            ).group_by(
                func.to_char(models.Transaction.created_date, 'Day').label("week_day")
            ).all()

        else:
            expenses_days = db.query(
                models.Transaction.created_date,
                func.sum(models.Transaction.summ).label("day_expenses")
            ).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.created_date >= date_start,
                models.Transaction.transaction_type == False
            ).group_by(
                models.Transaction.created_date
            ).all()

            expenses_week_days = db.query(
                func.to_char(models.Transaction.created_date, 'Day').label("week_day"),
                func.sum(models.Transaction.summ).label("weekday_expenses")
            ).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.created_date >= date_start,
                models.Transaction.transaction_type == False
            ).group_by(
                func.to_char(models.Transaction.created_date, 'Day').label("week_day")
            ).all()

            transactions_more_4 = db.query(
                models.Transaction.title,
                func.count(models.Transaction.title)
            ).filter(
                models.Transaction.user_id == user_id,
                models.Transaction.created_date >= date_start,
                models.Transaction.transaction_type == False
                ).group_by(
                models.Transaction.title
            ).having(
                func.count(models.Transaction.title) >= 4
            ).all()

        titles_list = [t.title for t in transactions_more_4]
        repeating_transactions = db.query(
                models.Transaction.title,
                models.Transaction.summ,
                models.Category.category,
                models.Category.emoji
            ).outerjoin(
                models.Category, 
                models.Category.id == models.Transaction.category_id
            ).filter(
                models.Transaction.transaction_type == False,
                models.Transaction.user_id == user_id,
                models.Transaction.title.in_(titles_list)
            ).all()

        return expenses_days, expenses_week_days, repeating_transactions

    expenses_days, expenses_week_days, repeating_transactions = expenses_days_weekdays(date_start, date_end, user_id, db)

    if previous_date_start and previous_date_end:
        previous_expenses_days, previous_expenses_week_days, previous_repeating_transactions = expenses_days_weekdays(previous_date_start, previous_date_end, user_id, db)
        
        return {
            "current": {
                "days": expenses_days,
                "week_days": expenses_week_days,
                "repeat_transactions": repeating_transactions
            },
            "previous": {
                "days": previous_expenses_days,
                "week_days": previous_expenses_week_days,
                "repeat_transactions": previous_repeating_transactions
            }
        }

    elif previous_date_start or previous_date_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail= "Both fields must be either empty or not")
    
    return {
        "current": {
            "days": expenses_days,
            "week_days": expenses_week_days,
            "repeat_transactions": repeating_transactions
        }
    }

@router.get("/total", status_code=200)
def BalanceExpenses(user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    user_id = user.id

    total = db.query(
        func.coalesce(func.sum(models.Transaction.summ), 0)        
    ).filter(
        models.Transaction.user_id == user_id
    )

    def total_count(total, t_type):
        total = total.filter(
            models.Transaction.transaction_type == t_type
        ).scalar()
        return total
    
    total_income = total_count(total, True)
    total_expense = total_count(total, False)

    total_transaction = db.query(
        func.count(models.Transaction.id)
    ).filter(
        models.Transaction.user_id == user_id
    ).scalar()

    return {
        "balance": total_income - total_expense,
        "total_income": total_income,
        "total_expense": total_expense,
        "total_transaction": total_transaction
    }
    