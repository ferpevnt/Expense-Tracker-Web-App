
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import time
sys.path.append(str(Path(__file__).parent.parent))
from main import app

client = TestClient(app)

def test_register_user():

    unique_email = f"test_{int(time.time())}@example.com"
    user_data = {
        "name": "Test User",
        "email": unique_email,
        "password": "Vava12345!",
        "confirm_password": "Vava12345!"
    }
    
    response = client.post("/auth/signup", json=user_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["name"] == "Test User"
    assert data["email"] == unique_email
    assert "hashed_password" not in data
    assert "id" in data

def test_login():
    
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
    assert response.status_code == 200
    
    data = response.json()
    assert data["access_token"] is not None
    assert data["token_type"] == "bearer"
    assert data["id"] is not None
    assert data["name"] == "Test User"
    assert data["email"] == unique_email