from fastapi.testclient import TestClient
import sys
from pathlib import Path
import time
import pytest
from sqlalchemy import text
sys.path.append(str(Path(__file__).parent.parent))
from main import app
from wordfreq import random_words

client = TestClient(app)

# ===== CLEARING DATABASE  =====
@pytest.fixture(autouse=True)
def clean_db():
    from database.database import engine
    
    with engine.connect() as conn:
        conn.execute(text("TRUNCATE TABLE transactions, categories CASCADE;"))
        conn.commit()
    yield
    with engine.connect() as conn:
        conn.execute(text("TRUNCATE TABLE transactions, categories CASCADE;"))
        conn.commit()

# ===== SUPPORT FUNCTIONS =====
def support_login():
    unique_email = f"test_{int(time.time())}@example.com"
    register_data = {
        "name": "Test User",
        "email": unique_email,
        "password": "Vava12345!",
        "confirm_password": "Vava12345!"
    }
    client.post("/auth/signup", json=register_data)
    
    login_data = {
        "email": unique_email,
        "password": "Vava12345!"
    }
    response = client.post("/auth/login", json=login_data)

    data = response.json()
    token = {
        "token": data["access_token"],
        "token_type": data["token_type"]}

    headers = {
        "Authorization": f"{token['token_type']} {token['token']}"
    }

    return headers

def support_category(headers):
    word = random_words("en", wordlist="best")
    category = {
        "category": word,
        "emoji": "emoji"
    }
    response = client.post("/categories/category", json=category, headers=headers)
    return response.json()["id"]

# ===== CREATE TESTS =====
def test_create_transaction():
    headers = support_login()
    category_id = support_category(headers)

    word = random_words("en", wordlist="best")

    transaction = {
        "title": "title",
        "description": word,
        "summ": 100,
        "transaction_type": False,
        "category_id": category_id
    }

    response = client.post("/transactions/transaction", json=transaction, headers=headers)
    assert response.status_code == 201

    data = response.json()
    assert data["id"] is not None
    assert isinstance(data["id"], int)
    assert data["title"] == "title"
    assert data["description"] == word
    assert data["summ"] == 100
    assert data["transaction_type"] == False
    assert data["category"] is not None
    assert data["emoji"] == "emoji"
    
    return data, headers

# ===== UPDATE TESTS =====
def test_update_transaction():
    data, headers = test_create_transaction()

    transaction_data = {
        "title": "new_title",
        "description": "new description",
        "summ": 200,
        "transaction_type": True
    }

    response = client.put(f"/transactions/transaction/{data['id']}", json=transaction_data, headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data["id"] is not None
    assert data["title"] == "new_title"
    assert data["description"] == "new description"
    assert data["summ"] == 200
    assert data["transaction_type"] == True

def test_update_transaction_null():
    data, headers = test_create_transaction()

    response = client.put(f"/transactions/transaction/{data['id']}", json={}, headers=headers)
    assert response.status_code == 422

def test_update_transaction_wrong_id():
    headers = support_login()

    transaction_data = {
        "title": "new_title",
        "description": "new description",
        "summ": 200,
        "transaction_type": True
    }

    response = client.put(f"/transactions/transaction/{0}", json=transaction_data, headers=headers)
    assert response.status_code == 404

# ===== DELETE TESTS =====
def test_delete_transaction():
    data, headers = test_create_transaction()

    response = client.delete(f"/transactions/transaction/{data['id']}", headers=headers)
    assert response.status_code == 204

def test_delete_transaction_wrong_id():
    headers = support_login()

    response = client.delete(f"/transactions/transaction/{0}", headers=headers)
    assert response.status_code == 404

# ===== LOAD TESTS =====
def test_load_transactions():
    headers = support_login()
    category_id = support_category(headers)

    for i in range(20):
        word = random_words("en", wordlist="best")
        transaction = {
            "title": f"title_{i}",
            "description": word,
            "summ": 100 + i * 50,
            "transaction_type": False if i % 2 == 0 else True,
            "category_id": category_id
        }
        client.post("/transactions/transaction", json=transaction, headers=headers)

    response = client.get("/transactions/filtered?page=1", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) == 15
    assert data["total"] == 20
    assert data["page"] == 1
    assert "pages" in data
    assert data["pages"] == 2

def test_load_transactions_page_2():
    headers = support_login()
    category_id = support_category(headers)

    for i in range(20):
        word = random_words("en", wordlist="best")
        transaction = {
            "title": f"title_{i}",
            "description": word,
            "summ": 100 + i * 50,
            "transaction_type": False if i % 2 == 0 else True,
            "category_id": category_id
        }
        client.post("/transactions/transaction", json=transaction, headers=headers)

    response = client.get("/transactions/filtered?page=2", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert len(data["items"]) == 5

def test_load_transactions_filters():
    headers = support_login()
    category_id = support_category(headers)

    titles = ["title_0", "title_1", "title_2"]
    for i, title in enumerate(titles):
        word = random_words("en", wordlist="best")
        transaction = {
            "title": title,
            "description": word,
            "summ": 100 + i * 50,
            "transaction_type": False if i % 2 == 0 else True,
            "category_id": category_id
        }
        client.post("/transactions/transaction", json=transaction, headers=headers)

    #search filter
    response = client.get("/transactions/filtered?page=1&search=title_1", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["title"] == "title_1"

    #type filter
    response = client.get("/transactions/filtered?page=1&t_type=True", headers=headers)
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["transaction_type"] == True

    #category filter
    response = client.get(f"/transactions/filtered?page=1&category={category_id}", headers=headers)
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["category_id"] == category_id

    #sum sort
    response = client.get("/transactions/filtered?page=1&min_sum=150&max_sum=200", headers=headers)
    assert response.status_code == 200
    data = response.json()
    for item in data["items"]:
        assert item["summ"] >= 150 and item["summ"] <= 200

def test_load_transactions_sort():
    headers = support_login()
    category_id = support_category(headers)

    for i in range(3):
        word = random_words("en", wordlist="best")
        transaction = {
            "title": f"title_{i}",
            "description": word,
            "summ": 100 + i * 50,
            "transaction_type": False,
            "category_id": category_id
        }
        client.post("/transactions/transaction", json=transaction, headers=headers)

    #sum sort (max to min)
    response = client.get("/transactions/filtered?page=1&sort=amount_high", headers=headers)
    assert response.status_code == 200
    data = response.json()
    items = data["items"]
    assert items[0]["summ"] >= items[-1]["summ"]

    #(A-Z) sort
    response = client.get("/transactions/filtered?page=1&sort=A-Z", headers=headers)
    assert response.status_code == 200
    data = response.json()
    items = data["items"]
    titles = [item["title"] for item in items]
    assert titles == sorted(titles)

def test_load_transactions_wrong_filter():
    headers = support_login()

    response = client.get("/transactions/filtered?page=1&sort=nivea_men", headers=headers)
    assert response.status_code == 400

    data = response.json()
    assert data["detail"] == "Wrong sorting filter"

def test_load_transactions_invalid_page():
    headers = support_login()

    response = client.get("/transactions/filtered?page=0", headers=headers)
    assert response.status_code == 400

    data = response.json()
    assert data["detail"] == "Page must be greater than 0"