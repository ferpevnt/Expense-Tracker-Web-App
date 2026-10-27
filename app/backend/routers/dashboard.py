from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from database import database, schemas, models
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))
from security import auth_token, security
from sqlalchemy import join, outerjoin, func, Float, case, cast
from typing import Optional, List
from datetime import datetime, timedelta, date, timezone
from dateutil.relativedelta import relativedelta

router = APIRouter(tags=["Dashboard"], prefix="/dashboard")

@router.get("/total", status_code=200)
def InfoTotal(user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    user_id = user.id

    total = db.query(
        func.coalesce(
            func.sum(models.Transaction.summ
            ).filter(models.Transaction.transaction_type == True), 0
            ).label("total_income"),

        func.coalesce(
            func.sum(models.Transaction.summ
            ).filter(models.Transaction.transaction_type == False), 0
            ).label("total_expense"),

        func.count(models.Transaction.id
        ).label("total_transaction")

        ).filter(
            models.Transaction.user_id == user_id
        ).one()
            
    
    total_income = float(total.total_income)
    total_expense = float(total.total_expense)
    total_transaction = int(total.total_transaction)
    balance = total_income - total_expense

    return {
        "total_income": total_income,
        "total_expense": total_expense,
        "total_transaction": total_transaction,
        "balance": balance
    }

@router.get("/transactions", status_code=200, response_model=List[schemas.TransactionOutTen])
def TransactionsTen(user: models.User=Depends(auth_token.get_current_user), db: Session=Depends(database.get_db)):

    user_id = user.id

    transactions_10 = db.query(
        models.Transaction.title,
        models.Transaction.description,
        models.Transaction.summ,
        models.Transaction.transaction_type,
        models.Transaction.created_date,
        models.Transaction.category_id,
        models.Category.category,
        models.Category.emoji
    ).outerjoin(
        models.Category, models.Transaction.category_id == models.Category.id
    ).filter(
        models.Transaction.user_id == user_id
    ).order_by(
        models.Transaction.created_date.desc()
    ).limit(10
    ).all()

    return transactions_10

@router.get("/finances", status_code=200)
def FinancesStatistics(
    filtering: str,
    target_date: Optional[datetime.date] = None,
    
    user: models.User=Depends(auth_token.get_current_user),
    db: Session=Depends(database.get_db)):

    user_id = user.id

    def filter_period(filtering, target_date, user_id, db):
        
        today = datetime.today().date()

        if filtering == "date" and target_date:
            filter_apply = func.date(models.Transaction.created_date) == target_date
        elif filtering == "today":
            filter_apply = func.date(models.Transaction.created_date) == today
        elif filtering == "yesterday":
            filter_apply = func.date(models.Transaction.created_date) == today - relativedelta(days=1)
        elif filtering == "week":
            filter_apply = func.date(models.Transaction.created_date) >= today - relativedelta(days=today.weekday())
        elif filtering == "month":
            filter_apply = func.date(models.Transaction.created_date) >= today.replace(day=1)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Wrong filter"
            )
        
        transactions_filtered = db.query(
            models.Transaction
        ).filter(
            filter_apply,
            models.Transaction.user_id == user_id
        )

        return transactions_filtered

    transactions = filter_period(filtering, target_date, user_id, db)
    transactions = transactions.filter(
        models.Transaction.transaction_type == False
    )

    expenses_info = transactions.with_entities(
        func.coalesce(
            func.sum(models.Transaction.summ), 0
            ).label("transaction_whole_sum"),

        func.coalesce(
            func.avg(models.Transaction.summ), 0
            ).label("avg_sum"),

        func.coalesce(
            func.max(models.Transaction.summ), 0
            ).label("max_sum"),

        func.count(
            models.Transaction.id
            ).label("transaction_amount"),        
    ).one()

    today = datetime.today().date()
    if filtering in ("today", "yesterday", "date"):
        days = 1
    elif filtering == "week":
        days = today.weekday() + 1
    elif filtering == "month":
        days = today.day
    else:
        days = 1   

    total_sum = float(expenses_info.transaction_whole_sum)
    avg_per_day = total_sum / days if days else 0.0
    
    categories_expense = transactions.with_entities(
        models.Category.id,
        models.Category.category,
        models.Category.emoji,
        func.coalesce(
            func.sum(models.Transaction.summ), 0
            ).label("total")
        ).outerjoin(
            models.Category, models.Transaction.category_id == models.Category.id,
        ).group_by(
            models.Category.id
        ).order_by(
            text("total DESC")
        ).all()

    categories_expense_percent = []
    for c in categories_expense:
        categorie_total = float(c.total)
        percent = (categorie_total * 100 / total_sum) if total_sum > 0 else 0.0
        categories_expense_percent.append({
            "id": c.id,
            "category": c.category,
            "emoji": c.emoji,
            "total": categorie_total,
            "percent": round(percent, 2),
        })

    categories_top_3 = categories_expense_percent[:3]

    max_transaction = transactions.with_entities(
        models.Transaction.title,
        models.Transaction.description,
        models.Transaction.summ,   
        models.Category.category,
        models.Category.emoji
    ).outerjoin(
        models.Category, models.Category.id == models.Transaction.category_id
    ).order_by(
        models.Transaction.summ.desc()
    ).first()

    forecast_month = avg_per_day * 30

    most_expensive_day = transactions.with_entities(
        func.date(models.Transaction.created_date
        ).label("day"),
        func.coalesce(
            func.sum(models.Transaction.summ), 0
        ).label("total_day_sum")
    ).group_by(
        func.date(models.Transaction.created_date)
    ).order_by(
        text("total_day_sum DESC")
    ).first()

    return {
    "expenses_info": {
        "transaction_whole_sum": total_sum,
        "avg_sum": float(expenses_info.avg_sum),
        "max_sum": float(expenses_info.max_sum),
        "transaction_amount": int(expenses_info.transaction_amount),
        "avg_per_day": round(avg_per_day, 2),
    },
    "forecast_month": round(forecast_month, 2),
    "max_transaction": {
        "title": max_transaction.title,
        "description": max_transaction.description,
        "summ": float(max_transaction.summ),
        "category": max_transaction.category,
        "emoji": max_transaction.emoji,
    } if max_transaction else None,
    "most_expensive_day": {
        "date": str(most_expensive_day.day),
        "total": float(most_expensive_day.total_day_sum),
    } if most_expensive_day else None,
    "categories_top_3": categories_top_3,
    "categories_expense_percent": categories_expense_percent,
    }

@router.get("/graphs", status_code=200, response_model=schemas.GraphsData)
def GraphsData(
    date_start: date,
    date_end: Optional[date] = None,
    previous_date_start: Optional[date] = None,
    previous_date_end: Optional[date] = None,
    user: models.User=Depends(auth_token.get_current_user),
    db: Session=Depends(database.get_db)):

    user_id = user.id

    def date_check(date_start, date_end, user_id, db):
        
        filters = [
            models.Transaction.user_id == user_id,
            models.Transaction.transaction_type == False,  
            models.Transaction.created_date >= date_start]   

        if date_end:        
            filters.append(models.Transaction.created_date <= date_end)
        
        transactions_filtered = db.query(
            models.Transaction
        ).filter(
            *filters
        )
        return transactions_filtered

    def expenses_days(transactions_filtered, days):
        if days == "days":
            filtering = func.date(models.Transaction.created_date).label("created_date")
            sum_label = "day_expenses"            
        elif days == "weekdays":
            filtering = func.trim(
                func.to_char(models.Transaction.created_date, 'Day')
            ).label("week_day")
            sum_label = "weekday_expenses"        
        else:
            raise ValueError(f"Unknown period: {days}")

        return transactions_filtered.with_entities(
            filtering,
            func.sum(models.Transaction.summ).label(sum_label),
        ).group_by(
            filtering,
        ).all()

        return transactions_days_weekdays

    def repeat_transactions(transactions_filtered):

        transactions_repeated = transactions_filtered.with_entities(
            models.Transaction.title,
            func.avg(models.Transaction.summ).label("summ"),
            models.Category.category,
            models.Category.emoji
        ).outerjoin(
            models.Category,
            models.Transaction.category_id == models.Category.id
        ).group_by(
            models.Transaction.title,
            models.Category.category,
            models.Category.emoji
        ).having(
            func.count(models.Transaction.title) >= 4
        ).all()

        return transactions_repeated

    transactions_current = date_check(date_start, date_end, user_id, db)
    transactions_expenses_days = expenses_days(transactions_current, "days")
    transactions_expenses_week_days = expenses_days(transactions_current, "weekdays") 
    transactions_repeated = repeat_transactions(transactions_current)

    if previous_date_start and previous_date_end:
        transactions_previous = date_check(previous_date_start, previous_date_end, user_id, db)
        transactions_previous_expenses_days = expenses_days(transactions_previous, "days")
        transactions_previous_expenses_week_days = expenses_days(transactions_previous, "weekdays")
        transactions_previous_repeated = repeat_transactions(transactions_previous)

    elif previous_date_start or previous_date_end:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wrong filter"
        )            
    result = {
        "current": {
            "days": transactions_expenses_days,
            "week_days": transactions_expenses_week_days,
            "repeat_transactions": transactions_repeated,
        }
    }

    if previous_date_start and previous_date_end:
        result["previous"] = {
            "days": transactions_previous_expenses_days,
            "week_days": transactions_previous_expenses_week_days,
            "repeat_transactions": transactions_previous_repeated,
        }

    return result