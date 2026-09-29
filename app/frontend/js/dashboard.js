// ===== STATE =====
let currentPeriod = "week";
let customDate = null; // YYYY-MM-DD
let daysChart = null;
let weekdayChart = null;
let categoryChart = null;

// ===== HELPERS =====
function formatMoney(n) {
  const num = parseFloat(n) || 0;
  return num.toFixed(2);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ===== PERIOD → DATE RANGE =====
function getDateRange(period, customDateValue) {
  const today = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);

  let start, end;

  if (period === "today") {
    start = end = iso(today);
  } else if (period === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    start = end = iso(y);
  } else if (period === "week") {
    const monday = new Date(today);
    const day = (today.getDay() + 6) % 7; // 0=Mon ... 6=Sun
    monday.setDate(today.getDate() - day);
    start = iso(monday);
    end = iso(today);
  } else if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    start = iso(first);
    end = iso(today);
  } else if (period === "custom" && customDateValue) {
    start = end = customDateValue;
  } else {
    // fallback
    start = end = iso(today);
  }

  return { start, end };
}

// ===== PREVIOUS PERIOD (для порівняння) =====
function getPreviousRange(period, start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const daysDiff = Math.max(
    1,
    Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1,
  );

  let prevEnd, prevStart;

  if (period === "today") {
    prevEnd = prevStart = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd);
  } else if (period === "yesterday") {
    prevEnd = prevStart = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd);
  } else if (period === "week") {
    prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (daysDiff - 1));
  } else if (period === "month") {
    const firstThisMonth = new Date(startDate);
    const firstPrevMonth = new Date(
      firstThisMonth.getFullYear(),
      firstThisMonth.getMonth() - 1,
      1,
    );
    const lastPrevMonth = new Date(
      firstThisMonth.getFullYear(),
      firstThisMonth.getMonth(),
      0,
    );
    prevStart = firstPrevMonth;
    prevEnd = lastPrevMonth;
  } else {
    // custom — попередній такого ж розміру
    prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (daysDiff - 1));
  }

  return {
    start: prevStart.toISOString().slice(0, 10),
    end: prevEnd.toISOString().slice(0, 10),
  };
}

// ===== LOAD TOTAL =====
async function loadTotal() {
  const { response, data } = await apiRequest("/dashboard/total");

  if (response.status === 200) {
    document.getElementById("total-balance").textContent = formatMoney(
      data.balance,
    );
    document.getElementById("total-income").textContent = formatMoney(
      data.total_income,
    );
    document.getElementById("total-expense").textContent = formatMoney(
      data.total_expense,
    );
    document.getElementById("total-count").textContent = data.total_transaction;
  } else if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
  } else {
    showMessage("message", "Failed to load totals", "error");
  }
}

// ===== LOAD FINANCES (period) =====
async function loadFinances() {
  const params = new URLSearchParams();
  params.append("filtering", currentPeriod);

  if (currentPeriod === "custom" && customDate) {
    // бекенд хоче filtering=date + target_date
    params.set("filtering", "date");
    params.append("target_date", customDate);
  }

  const { response, data } = await apiRequest(
    `/dashboard/finances?${params.toString()}`,
  );

  if (response.status === 200) {
    const info = data.expenses_info;
    document.getElementById("period-total").textContent = formatMoney(
      info.transaction_whole_summ,
    );
    document.getElementById("period-avg").textContent = formatMoney(
      info.avg_summ,
    );
    document.getElementById("period-max").textContent = formatMoney(
      info.max_summ,
    );
    document.getElementById("period-count").textContent =
      info.transaction_amount;
    document.getElementById("period-avg-day").textContent = formatMoney(
      info.avg_per_day,
    );

    renderTopCategories(data.categories_top_3 || []);
    renderCategoryChart(data.categories_expense_percent || []);
  } else if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
  } else if (response.status === 400) {
    showMessage("message", data?.detail || "Wrong filter", "error");
  } else {
    showMessage("message", "Failed to load statistics", "error");
  }
}

// ===== LOAD COMPARE (порівняння з попереднім періодом) =====
async function loadCompare() {
  const badge = document.getElementById("period-compare");

  if (currentPeriod === "custom") {
    badge.classList.remove("show");
    return;
  }

  const { start, end } = getDateRange(currentPeriod);
  const prev = getPreviousRange(currentPeriod, start, end);

  // поточний
  const paramsCurrent = new URLSearchParams({
    filtering: currentPeriod,
  });

  // попередній — використовуємо filtering=date + target_date
  // але нам треба діапазон, тому викликаємо /graphs для обох
  const graphParams = new URLSearchParams({
    date_start: start,
    date_end: end,
    previous_date_start: prev.start,
    previous_date_end: prev.end,
  });

  const { response, data } = await apiRequest(
    `/dashboard/graphs?${graphParams.toString()}`,
  );

  if (response.status !== 200) {
    badge.classList.remove("show");
    return;
  }

  // рахуємо суми з days
  const sumCurrent = (data.current?.days || []).reduce(
    (acc, d) => acc + (parseFloat(d.day_expenses) || 0),
    0,
  );
  const sumPrev = (data.previous?.days || []).reduce(
    (acc, d) => acc + (parseFloat(d.day_expenses) || 0),
    0,
  );

  if (sumPrev === 0 && sumCurrent === 0) {
    badge.classList.remove("show");
    return;
  }

  if (sumPrev === 0) {
    badge.textContent = "no data to compare";
    badge.className = "period-compare show neutral";
    return;
  }

  const diff = ((sumCurrent - sumPrev) / sumPrev) * 100;
  const arrow = diff > 0 ? "↑" : diff < 0 ? "↓" : "→";
  const sign = diff > 0 ? "+" : "";

  badge.textContent = `${arrow} ${sign}${diff.toFixed(1)}% vs previous`;
  badge.className =
    "period-compare show " + (diff > 0 ? "up" : diff < 0 ? "down" : "neutral");
}

// ===== RENDER TOP CATEGORIES =====
function renderTopCategories(cats) {
  const wrap = document.getElementById("top-categories");
  wrap.innerHTML = "";

  if (!cats.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 30px;">
        <div class="emoji">📊</div>
        <h3>No expenses yet</h3>
        <p>Add transactions to see top categories</p>
      </div>
    `;
    return;
  }

  cats.forEach((c) => {
    const card = document.createElement("div");
    card.className = "top-cat-card";
    const percent =
      c.percent !== null && c.percent !== undefined
        ? `${parseFloat(c.percent).toFixed(1)}%`
        : "—";
    card.innerHTML = `
      <div class="top-cat-emoji">${c.emoji || "📁"}</div>
      <div class="top-cat-info">
        <div class="top-cat-name">${escapeHtml(c.category || "No category")}</div>
        <div class="top-cat-amount">${formatMoney(c.total)}</div>
      </div>
      <div class="top-cat-percent">${percent}</div>
    `;
    wrap.appendChild(card);
  });
}

// ===== LOAD RECENT TRANSACTIONS =====
async function loadRecent() {
  const { response, data } = await apiRequest("/dashboard/transactions");

  if (response.status !== 200) {
    if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    }
    return;
  }

  const list = document.getElementById("recent-list");
  list.innerHTML = "";

  if (!data.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="emoji">📭</div>
        <h3>No transactions yet</h3>
        <p>Add your first transaction to see it here</p>
      </div>
    `;
    return;
  }

  data.forEach((t) => {
    const isIncome = !!t.transaction_type;
    const sign = isIncome ? "+" : "−";
    const item = document.createElement("div");
    item.className = "recent-item";
    item.innerHTML = `
      <div class="recent-emoji">${t.emoji || (isIncome ? "💰" : "💸")}</div>
      <div class="recent-main">
        <div class="recent-title">${escapeHtml(t.title)}</div>
        <div class="recent-meta">
          ${t.category ? escapeHtml(t.category) + " • " : ""}
          ${formatDate(t.created_date)}
        </div>
      </div>
      <div class="recent-amount ${isIncome ? "income" : "expense"}">
        ${sign}${formatMoney(t.summ)}
      </div>
    `;
    list.appendChild(item);
  });
}

// ===== LOAD GRAPHS =====
async function loadGraphs() {
  const { start, end } = getDateRange(currentPeriod, customDate);
  const params = new URLSearchParams();
  params.append("date_start", start);
  params.append("date_end", end);

  const { response, data } = await apiRequest(
    `/dashboard/graphs?${params.toString()}`,
  );

  if (response.status === 200) {
    renderDaysChart(data.current?.days || []);
    renderWeekdayChart(data.current?.week_days || []);
    renderRepeatList(data.current?.repeat_transactions || []);
  } else if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
  } else if (response.status === 400) {
    showMessage("message", data?.detail || "Wrong date range", "error");
  } else {
    showMessage("message", "Failed to load charts", "error");
  }
}

// ===== CHART: DAYS =====
function renderDaysChart(days) {
  const ctx = document.getElementById("days-chart").getContext("2d");

  if (daysChart) daysChart.destroy();

  if (!days.length) {
    daysChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["No data"],
        datasets: [{ data: [0], backgroundColor: "#e0e6ed" }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return;
  }

  // групуємо по днях (на випадок timestamp)
  const map = new Map();
  days.forEach((d) => {
    const key = formatDate(d.created_date);
    const val = parseFloat(d.day_expenses) || 0;
    map.set(key, (map.get(key) || 0) + val);
  });

  const labels = Array.from(map.keys());
  const values = Array.from(map.values());

  daysChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data: values,
          backgroundColor: "rgba(102, 126, 234, 0.7)",
          borderColor: "#667eea",
          borderWidth: 2,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: "#7f8c8d" } },
        x: { ticks: { color: "#7f8c8d" } },
      },
    },
  });
}

// ===== CHART: WEEKDAYS =====
function renderWeekdayChart(weekdays) {
  const ctx = document.getElementById("weekday-chart").getContext("2d");

  if (weekdayChart) weekdayChart.destroy();

  if (!weekdays.length) {
    weekdayChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["No data"],
        datasets: [{ data: [1], backgroundColor: ["#e0e6ed"] }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
    return;
  }

  const order = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const map = new Map();
  weekdays.forEach((d) => {
    const key = (d.week_day || "").trim();
    const val = parseFloat(d.weekday_expenses) || 0;
    map.set(key, (map.get(key) || 0) + val);
  });

  const labels = order.filter((d) => map.has(d));
  const values = labels.map((d) => map.get(d));

  const palette = [
    "#667eea",
    "#764ba2",
    "#27ae60",
    "#e74c3c",
    "#f39c12",
    "#3498db",
    "#9b59b6",
  ];

  weekdayChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#34495e", padding: 12 },
        },
      },
    },
  });
}

// ===== CHART: CATEGORIES (Doughnut) =====
function renderCategoryChart(categories) {
  const ctx = document.getElementById("category-chart").getContext("2d");

  if (categoryChart) categoryChart.destroy();

  // фільтруємо ті, де total > 0 (інакше шум)
  const filtered = (categories || []).filter(
    (c) => (parseFloat(c.total) || 0) > 0,
  );

  if (!filtered.length) {
    categoryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["No data"],
        datasets: [{ data: [1], backgroundColor: ["#e0e6ed"] }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
    return;
  }

  // сортуємо по спаданню
  filtered.sort(
    (a, b) => (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0),
  );

  const labels = filtered.map((c) => c.category || "No category");
  const values = filtered.map((c) => parseFloat(c.total) || 0);

  const palette = [
    "#667eea",
    "#764ba2",
    "#27ae60",
    "#e74c3c",
    "#f39c12",
    "#3498db",
    "#9b59b6",
    "#1abc9c",
    "#e67e22",
    "#95a5a6",
  ];

  categoryChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: labels.map((_, i) => palette[i % palette.length]),
          borderWidth: 2,
          borderColor: "#fff",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#34495e", padding: 12, boxWidth: 12 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = values.reduce((a, b) => a + b, 0);
              const val = ctx.parsed;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : "0";
              return ` ${ctx.label}: ${val.toFixed(2)} (${pct}%)`;
            },
          },
        },
      },
    },
  });
}

// ===== RENDER REPEATING TRANSACTIONS =====
function renderRepeatList(repeats) {
  const wrap = document.getElementById("repeat-list");
  wrap.innerHTML = "";

  if (!repeats || !repeats.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 30px;">
        <div class="emoji">🔁</div>
        <h3>No repeating expenses yet</h3>
        <p>Titles you buy 4+ times in the period will appear here</p>
      </div>
    `;
    return;
  }

  // групуємо по title (щоб уникнути дублів з різними сумами)
  const map = new Map();
  repeats.forEach((r) => {
    const key = r.title;
    if (!map.has(key)) {
      map.set(key, {
        title: r.title,
        category: r.category,
        emoji: r.emoji,
        total: 0,
        count: 0,
      });
    }
    const entry = map.get(key);
    entry.total += parseFloat(r.summ) || 0;
    entry.count += 1;
  });

  const items = Array.from(map.values()).sort((a, b) => b.count - a.count);

  items.forEach((r) => {
    const card = document.createElement("div");
    card.className = "repeat-card";
    card.innerHTML = `
      <div class="repeat-emoji">${r.emoji || "🔁"}</div>
      <div class="repeat-info">
        <div class="repeat-name">${escapeHtml(r.title)}</div>
        <div class="repeat-meta">
          ${r.count}× ${r.category ? "• " + escapeHtml(r.category) : ""}
        </div>
      </div>
      <div class="repeat-amount">${formatMoney(r.total)}</div>
    `;
    wrap.appendChild(card);
  });
}

// ===== RELOAD ALL =====
async function reloadAll() {
  hideMessage("message");
  await Promise.all([
    loadTotal(),
    loadFinances(),
    loadRecent(),
    loadGraphs(),
    loadCompare(),
  ]);
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("user-name").textContent =
    localStorage.getItem("user_name") || "User";

  const periodSelect = document.getElementById("period-select");
  const customDateInput = document.getElementById("custom-date");

  periodSelect.addEventListener("change", (e) => {
    currentPeriod = e.target.value;

    if (currentPeriod === "custom") {
      customDateInput.style.display = "inline-block";
      // ставимо дефолт — сьогодні
      if (!customDateInput.value) {
        customDateInput.value = new Date().toISOString().slice(0, 10);
      }
      customDate = customDateInput.value;
    } else {
      customDateInput.style.display = "none";
      customDate = null;
    }

    reloadAll();
  });

  customDateInput.addEventListener("change", (e) => {
    customDate = e.target.value;
    if (customDate) reloadAll();
  });

  reloadAll();
});
