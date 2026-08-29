from fastapi.testclient import TestClient
import sys
from pathlib import Path
import time
sys.path.append(str(Path(__file__).parent.parent))
from main import app
from wordfreq import random_words

client = TestClient(app)

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

def test_create_category():

    headers = support_login()

    word = random_words("en", wordlist="best")

    category = {
        "category": word,
        "emoji": "emoji"
    }

    response = client.post("/categories/category", json=category, headers=headers)

    assert response.status_code == 201

    data = response.json()
    assert data["id"] is not None
    assert isinstance(data["id"], int)

    assert data["category"] == word

    assert data["emoji"] == "emoji" 
    
    return data, headers

# ===== UPDATE TESTS =====
def test_update_category_full():

    category_data, headers = test_create_category()

    word = random_words("en", wordlist="best")

    update_data_full = {
        "category": word,
        "emoji": "emoji2"
    }

    response = client.put(f"/categories/category/{category_data["id"]}", json=update_data_full, headers=headers)
    
    assert response.status_code == 200

    data = response.json()
    assert data["id"] is not None
    assert data["id"] == category_data["id"]
    assert data["category"] == word
    assert data["emoji"] == "emoji2"

def test_update_category_null():

    category_data, headers = test_create_category()

    word = random_words("en", wordlist="best")

    update_data_null = {}

    response = client.put(f"/categories/category/{category_data["id"]}", json=update_data_null, headers=headers)

    assert response.status_code == 422

    data = response.json()
    assert data["detail"][0]["msg"] == "Value error, Both fields can not be empty"


def test_update_category_name_exists():

    category_data, headers = test_create_category()

    word = random_words("en", wordlist="best")

    update_data_exists = {
        "category": category_data["category"],
        "emoji": "emoji2"
    }

    response = client.put(f"/categories/category/{category_data["id"]}", json=update_data_exists, headers=headers)
    assert response.status_code == 409
    
    data = response.json()
    print(data)
    assert data["detail"] == "Category with such name already exists!"

def test_update_category_wrong_id():

    category_data, headers = test_create_category()

    word = random_words("en", wordlist="best")

    update_data_wrong_id = {
        "category": word,
        "emoji": "emoji2"
    }

    response = client.put(f"/categories/category/{0}", json=update_data_wrong_id, headers=headers)
    assert response.status_code == 404

    data = response.json()
    assert data["detail"] == "Category not found"

# ===== DELETE TESTS =====
def test_delete_category():

    category_data, headers = test_create_category()

    response = client.delete(f"/categories/category/{category_data["id"]}", headers=headers)
    assert response.status_code == 204

def test_delete_category_wrong_id():

    category_data, headers = test_create_category()

    response = client.delete(f"/categories/category/{0}", headers=headers)
    assert response.status_code == 404

    data = response.json()
    assert data["detail"] == "Category not found"

# ===== LOAD TESTS =====
def test_load_categories():

    headers = support_login()

    for i in range(5):
        word = random_words("en", wordlist="best")

        category_data = {
            "category": word,
            "emoji": "emoji"
        }
        client.post("/categories/category", json=category_data, headers=headers)

    response = client.get(f"/categories/filtered?sort=A-Z", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data is not None

def test_load_categories_wrong_filter():

    headers = support_login()

    response = client.get("/categories/filtered?sort=nivea_men", headers=headers)
    assert response.status_code == 400

    data = response.json()
    assert data["detail"] == "Wrong filter"

def test_load_categories_no_sort():

    headers = support_login()
    
    response = client.get("/categories/filtered", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)

# ==== GRAPH TEST =====
def test_categories_graph():

    headers = support_login()

    for i in range(5):
            word = random_words("en", wordlist="best")

            category_data = {
                "category": word,
                "emoji": "emoji"
            }
            client.post("/categories/category", json=category_data, headers=headers)

    response = client.get("/categories/graph?filtering=today", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert data is not None
    print(data)

def test_categories_graph_wrong_filter():

    headers = support_login()

    response = client.get("/categories/graph?filtering=zinc", headers=headers)
    assert response.status_code == 400

    data = response.json()
    assert data["detail"] == "Wrong filter"

def test_categories_graph_no_filter():

    headers = support_login()
    
    response = client.get("/categories/graph", headers=headers)
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)

def test_categories():

    headers = support_login()

    for i in range(5):
            word = random_words("en", wordlist="best")

            category_data = {
                "category": word,
                "emoji": "emoji"
            }
            client.post("/categories/category", json=category_data, headers=headers)

    response = client.get("/categories", headers=headers)
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)
