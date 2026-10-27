# 💸 Expense Tracker

A full-stack web application for tracking personal income and expenses.

> **Note:** This is my first full-stack project. It was built as a learning exercise — to understand how the frontend, backend, database, and infrastructure work together in a real application.

---

## 📖 What is this?

**Expense Tracker** helps you keep track of where your money goes.

You can add transactions (income or expense), assign categories, and see clear statistics on a dashboard: totals, averages, top spending categories, charts, and patterns in your habits (e.g., "you buy coffee 15 times a week").

The goal is to give you a **visual, data-driven picture of your finances** without spreadsheets.

---

## ✨ Interesting features

### 📊 Dashboard

- **Summary cards** — current balance, total income, total expenses, transaction count (all-time).
- **Period statistics** — for today / yesterday / this week / this month / custom date:
  - Total spent, average, maximum, count, average per day.
  - **Forecast** for the full month (based on avg/day).
- **Top 3 categories** with percentages.
- **3 interactive charts** (Chart.js):
  - Daily expenses (bar chart).
  - Expenses by weekday (doughnut chart).
  - Expenses by category (doughnut chart with % tooltips).
- **"Compare with previous period"** toggle:
  - When enabled, charts show current period vs previous period side-by-side.
  - A badge shows the % difference (↑ +12.5% / ↓ −8.3%).
- **Highlights** — biggest single expense, most expensive day.
- **"You often buy"** — repeating transactions (titles you use 4+ times in a period).
- **Recent transactions** — last 10.

### 💳 Transactions

- Create, edit, and delete transactions.
- Income / expense toggle.
- Optional category and description.
- **Filters:**
  - Search by title or description.
  - Filter by type, category, min/max amount, date range.
- **Sorting:** newest, oldest, amount high/low, title A–Z/Z–A.
- **Pagination:** 15 per page.

### 🏷️ Categories

- Create, edit, delete categories.
- Assign an emoji to each category (emoji picker + free input).
- Search and sort (A–Z, Z–A, newest, oldest, most used, least used).
- See how many transactions each category has.

### 👤 Profile

- View and change your name.
- Change your password (with client-side validation).
- Delete your account (double confirmation with typed "DELETE").

### 🔐 Authentication & Security

- JWT-based authentication.
- Passwords are hashed with bcrypt.
- **Rate limiting** on all endpoints (slowapi + Redis).
- Per-user data isolation (you only see your own data).

---

## 🛠️ Tech stack

### Backend

- **FastAPI** — web framework.
- **SQLAlchemy** — ORM.
- **PostgreSQL** — database.
- **Redis** — rate limiting storage and caching.
- **Pydantic** — request/response validation.
- **python-jose** — JWT tokens.
- **passlib[bcrypt]** — password hashing.
- **slowapi** — rate limiting.

### Frontend

- **Vanilla HTML / CSS / JavaScript** — no frameworks.
- **Chart.js** — charts.
- Modular CSS (theme variables + components) and modular JS.

### Infrastructure

- **Docker** and **Docker Compose** — one command starts the whole backend stack.
- **Redis** — shared storage for rate limits and cache (works with multiple workers).
- **Named volumes** — for PostgreSQL and Redis persistence.

---

## 🚀 How to run

### Prerequisites

- **Docker** and **Docker Compose** installed.
- (Optional, for frontend during development) **Python 3.10+** to run a static file server, or **VS Code Live Server** extension.

> You **do not** need to install PostgreSQL or Redis — they run inside Docker containers.

### 1. Clone the repository

```bash
git clone <https://github.com/ferpevnt/Expense-Tracker-Web-App.git>

cd "Expense Tracker Web App"
```

### 2. Create environment files

There are **two** `.env` files (each has a `.env.example` next to it).

**Root `.env`** (used by Docker Compose):

```bash
cp .env.example .env
```

Fill in:

```env
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_DB=your_database
```

**`app/config/.env`** (used by the Python backend):

```bash
cp app/config/.env.example app/config/.env
```

Fill in:

```env
DATABASE_URL=postgresql://your_user:your_password@localhost:5432/your_database
REDIS_STORAGE_URI=redis://localhost:6379
SECRET_KEY=some_long_random_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
ALLOWED_ORIGINS=http://localhost:5500,http://127.0.0.1:5500


> ⚠️ Make sure `POSTGRES_PASSWORD` in the root `.env` matches the password in `DATABASE_URL` inside `app/config/.env`.

### 3. Start the backend stack

```bash
docker compose up --build -d
```

This starts:

- `expense-db` — PostgreSQL.
- `expense-redis` — Redis.
- `expense-backend` — FastAPI on `http://localhost:8000`.

Check that everything is running:

```bash
docker compose ps
docker compose logs -f backend
```

You should see `Application startup complete` in the logs.

### 4. Start the frontend (development mode)

In a separate terminal:

```bash
cd app/frontend
python -m http.server 5500
```

Then open:

- `http://127.0.0.1:5500/login.html`
- `http://127.0.0.1:5500/signup.html`

Or use **VS Code Live Server** on the `app/frontend` folder.

### 5. API docs

FastAPI auto-generates Swagger docs:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### 6. Stop everything

```bash
docker compose stop     # stop containers (data is preserved)
docker compose down     # stop and remove containers (data is preserved)
docker compose down -v  # stop, remove containers, and delete volumes (data is lost!)
```

---

## 🔮 Planned features

- 💰 **Monthly budgets per category** — set a budget and see how much is left.
- 📧 **Email verification** — verify your account after signup (infrastructure for sending emails is already prepared).
- 🗂️ **Transaction attachments** — attach a receipt photo (optional).
- 🔔 **Notifications** — "you're approaching your budget for Food".
- 🌍 **Multiple currencies** — support more than one currency.

---

## 📁 Project structure

```
Expense Tracker Web App/
├── docker-compose.yml
├── .env.example
├── app/
│   ├── backend/
│   │   ├── main.py
│   │   ├── database/        # models, schemas, DB connection
│   │   ├── routers/         # auth, categories, transactions, dashboard, profile
│   │   ├── security/        # JWT, hashing, limiter, redis_client
│   │   ├── testing/         # pytest tests
│   │   └── Dockerfile
│   ├── config/
│   │   ├── config.py
│   │   ├── requirements.txt
│   │   └── .env.example
│   └── frontend/
│       ├── css/             # theme, base, components, layout, per-page
│       ├── js/              # config, auth, dashboard, transactions, categories, profile
│       ├── login.html
│       ├── signup.html
│       ├── index.html
│       ├── transactions.html
│       ├── categories.html
│       └── profile.html
└── README.md
```

---

## 🧪 Testing

Run backend tests (pytest):

```bash
cd app/backend
pytest -v
```

Rate limiting tests require Redis to be running (Docker Compose handles this).

---

## 🙏 Acknowledgements

Built as a learning project.

---

## 📌 A note about this project

The **frontend** was initially implemented with AI assistance. It works, but it should be **rewritten manually** in the future for learning purposes — reading and writing every line by hand is the best way to truly understand what's happening.

The **backend** was written by hand, and it's the part of the project I'm most proud of.
