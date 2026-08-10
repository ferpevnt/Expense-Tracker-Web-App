from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import logic
from config.config import settings

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(logic.router)
