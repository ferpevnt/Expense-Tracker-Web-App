from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, categories
from config.config import settings
from database.database import engine, Base

app = FastAPI()

Base.metadata.create_all(engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(categories.router)