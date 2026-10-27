// ===== STATE =====
let currentPeriod = "week";
let customDate = null;
let compareEnabled = false;
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

function formatDateShort(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
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

  if (period === "today") return { start: iso(today), end: iso(today) };

  if (period === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { start: iso(y), end: iso(y) };
  }

  if (period === "week") {
    const monday = new Date(today);
    const day = (today.getDay() + 6) % 7;
    monday.setDate(today.getDate() - day);
    return { start: iso(monday), end: iso(today) };
  }

  if (period === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    return { start: iso(first), end: iso(today) };
  }

  if (period === "custom" && customDateValue) {
    return { start: customDateValue, end: customDateValue };
  }

  return { start: iso(today), end: iso(today) };
}

// ===== PREVIOUS PERIOD =====
function getPreviousRange(period, start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const daysDiff = Math.max(
    1,
    Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1,
  );

  let prevStart, prevEnd;

  if (period === "today" || period === "yesterday") {
    const d = new Date(startDate);
    d.setDate(d.getDate() - 1);
    prevStart = prevEnd = d;
  } else if (period === "week") {
    prevEnd = new Date(startDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (daysDiff - 1));
  } else if (period === "month") {
    prevStart = new Date(startDate.getFullYear(), startDate.getMonth() - 1, 1);
    prevEnd = new Date(startDate.getFullYear(), startDate.getMonth(), 0);
  } else {
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
  try {
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
      document.getElementById("total-count").textContent =
        data.total_transaction;
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    }
  } catch (error) {
    showMessage("message", "Failed to load totals", "error");
  }
}

// ===== LOAD FINANCES =====
async function loadFinances() {
  const params = new URLSearchParams();
  params.append("filtering", currentPeriod);
  if (currentPeriod === "custom" && customDate) {
    params.set("filtering", "date");
    params.append("target_date", customDate);
  }

  try {
    const { response, data } = await apiRequest(
      `/dashboard/finances?${params.toString()}`,
    );

    if (response.status === 200) {
      const info = data.expenses_info;
      document.getElementById("period-total").textContent = formatMoney(
        info.transaction_whole_sum,
      );
      document.getElementById("period-avg").textContent = formatMoney(
        info.avg_sum,
      );
      document.getElementById("period-max").textContent = formatMoney(
        info.max_sum,
      );
      document.getElementById("period-count").textContent =
        info.transaction_amount;
      document.getElementById("period-avg-day").textContent = formatMoney(
        info.avg_per_day,
      );
      document.getElementById("forecast-month").textContent = formatMoney(
        data.forecast_month,
      );

      renderTopCategories(data.categories_top_3 || []);
      renderCategoryChart(data.categories_expense_percent || []);
      renderHighlights(data.max_transaction, data.most_expensive_day);
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else if (response.status === 400) {
      showMessage("message", data?.detail || "Wrong filter", "error");
    }
  } catch (error) {
    showMessage("message", "Failed to load statistics", "error");
  }
}

// ===== RENDER TOP CATEGORIES =====
function renderTopCategories(cats) {
  const wrap = document.getElementById("top-categories");
  wrap.innerHTML = "";

  if (!cats.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 30px;">
        <div class="emoji">📊</div>
        <h3>No expenses</h3>
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

// ===== RENDER HIGHLIGHTS =====
function renderHighlights(maxTx, mostExpensiveDay) {
  const maxWrap = document.getElementById("max-transaction-content");
  if (maxTx) {
    maxWrap.innerHTML = `
      <div class="highlight-title">${escapeHtml(maxTx.title)}</div>
      <div class="highlight-meta">
        ${maxTx.category ? `${maxTx.emoji || "📁"} ${escapeHtml(maxTx.category)}` : "No category"}
      </div>
      <div class="highlight-value">−${formatMoney(maxTx.summ)}</div>
      ${maxTx.description ? `<div class="highlight-date">${escapeHtml(maxTx.description)}</div>` : ""}
    `;
  } else {
    maxWrap.innerHTML = '<span class="highlight-empty">No data</span>';
  }

  const dayWrap = document.getElementById("most-expensive-day-content");
  if (mostExpensiveDay) {
    dayWrap.innerHTML = `
      <div class="highlight-title">${formatDate(mostExpensiveDay.date)}</div>
      <div class="highlight-value">−${formatMoney(mostExpensiveDay.total)}</div>
    `;
  } else {
    dayWrap.innerHTML = '<span class="highlight-empty">No data</span>';
  }
}

// ===== LOAD RECENT =====
async function loadRecent() {
  try {
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
          <p>Add your first transaction</p>
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
  } catch (error) {
    console.error(error);
  }
}

// ===== LOAD GRAPHS =====
async function loadGraphs() {
  const { start, end } = getDateRange(currentPeriod, customDate);
  const params = new URLSearchParams({ date_start: start, date_end: end });

  let previousRange = null;
  if (compareEnabled && currentPeriod !== "custom") {
    previousRange = getPreviousRange(currentPeriod, start, end);
    params.append("previous_date_start", previousRange.start);
    params.append("previous_date_end", previousRange.end);
  }

  try {
    const { response, data } = await apiRequest(
      `/dashboard/graphs?${params.toString()}`,
    );

    if (response.status === 200) {
      const current = data.current || {
        days: [],
        week_days: [],
        repeat_transactions: [],
      };
      const previous = data.previous || null;

      renderDaysChart(current.days || [], previous?.days || null, !!previous);
      renderWeekdayChart(
        current.week_days || [],
        previous?.week_days || null,
        !!previous,
      );
      renderRepeatList(current.repeat_transactions || []);
      renderCompareBadge(current, previous);
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else if (response.status === 400) {
      showMessage("message", data?.detail || "Wrong date range", "error");
    }
  } catch (error) {
    showMessage("message", "Failed to load charts", "error");
  }
}

// ===== COMPARE BADGE =====
function renderCompareBadge(current, previous) {
  const badge = document.getElementById("period-compare");

  if (!previous) {
    badge.classList.remove("show");
    return;
  }

  const sum = (arr) =>
    (arr || []).reduce((acc, d) => acc + (parseFloat(d.day_expenses) || 0), 0);

  const sumCurrent = sum(current?.days);
  const sumPrev = sum(previous?.days);

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

// ===== CHART: DAYS =====
function renderDaysChart(currentDays, previousDays, showCompare) {
  const ctx = document.getElementById("days-chart").getContext("2d");
  if (daysChart) daysChart.destroy();

  const hasData =
    (currentDays && currentDays.length > 0) ||
    (showCompare && previousDays && previousDays.length > 0);

  if (!hasData) {
    daysChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["No data"],
        datasets: [{ data: [0], backgroundColor: "rgba(139,92,246,0.2)" }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return;
  }

  // Збираємо всі унікальні дати (current + previous)
  const allLabels = new Set();
  currentDays?.forEach((d) => allLabels.add(d.created_date));
  if (showCompare) previousDays?.forEach((d) => allLabels.add(d.created_date));

  const sortedDates = [...allLabels].sort((a, b) => new Date(a) - new Date(b));

  // Якщо compare вимкнено — тільки current
  let labels, datasets;

  if (showCompare) {
    // Для порівняння: вирівнюємо по індексу (день 1, день 2, ...)
    // Беремо довжину більшого масиву
    const maxLen = Math.max(
      currentDays?.length || 0,
      previousDays?.length || 0,
    );
    labels = Array.from({ length: maxLen }, (_, i) => `Day ${i + 1}`);

    const currentValues = [];
    const previousValues = [];
    for (let i = 0; i < maxLen; i++) {
      currentValues.push(parseFloat(currentDays?.[i]?.day_expenses) || null);
      previousValues.push(parseFloat(previousDays?.[i]?.day_expenses) || null);
    }

    datasets = [
      {
        label: "Current period",
        data: currentValues,
        backgroundColor: "rgba(139, 92, 246, 0.7)",
        borderColor: "#8b5cf6",
        borderWidth: 2,
        borderRadius: 6,
      },
      {
        label: "Previous period",
        data: previousValues,
        backgroundColor: "rgba(6, 182, 212, 0.4)",
        borderColor: "#06b6d4",
        borderWidth: 2,
        borderRadius: 6,
      },
    ];
  } else {
    // Без compare: звичайний графік по датах
    labels = currentDays.map((d) => formatDateShort(d.created_date));
    const values = currentDays.map((d) => parseFloat(d.day_expenses) || 0);

    datasets = [
      {
        label: "Expenses",
        data: values,
        backgroundColor: "rgba(139, 92, 246, 0.7)",
        borderColor: "#8b5cf6",
        borderWidth: 2,
        borderRadius: 6,
      },
    ];
  }

  daysChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: showCompare,
          labels: { color: "#e2e8f0", padding: 12 },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: "#94a3b8" },
          grid: { color: "rgba(139,92,246,0.1)" },
        },
        x: {
          ticks: { color: "#94a3b8" },
          grid: { display: false },
        },
      },
    },
  });
}

// ===== CHART: WEEKDAYS =====
function renderWeekdayChart(currentWeekdays, previousWeekdays, showCompare) {
  const ctx = document.getElementById("weekday-chart").getContext("2d");
  if (weekdayChart) weekdayChart.destroy();

  const order = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const mapCurrent = new Map();
  const mapPrevious = new Map();

  currentWeekdays?.forEach((d) => {
    const key = (d.week_day || "").trim();
    const val = parseFloat(d.weekday_expenses) || 0;
    mapCurrent.set(key, (mapCurrent.get(key) || 0) + val);
  });

  if (showCompare) {
    previousWeekdays?.forEach((d) => {
      const key = (d.week_day || "").trim();
      const val = parseFloat(d.weekday_expenses) || 0;
      mapPrevious.set(key, (mapPrevious.get(key) || 0) + val);
    });
  }

  const labels = order.filter((d) => mapCurrent.has(d) || mapPrevious.has(d));

  if (!labels.length) {
    weekdayChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["No data"],
        datasets: [{ data: [0], backgroundColor: "rgba(139,92,246,0.2)" }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } },
      },
    });
    return;
  }

  const currentValues = labels.map((d) => mapCurrent.get(d) || 0);

  if (showCompare) {
    const previousValues = labels.map((d) => mapPrevious.get(d) || 0);

    weekdayChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Current",
            data: currentValues,
            backgroundColor: "rgba(139, 92, 246, 0.7)",
            borderColor: "#8b5cf6",
            borderWidth: 2,
            borderRadius: 6,
          },
          {
            label: "Previous",
            data: previousValues,
            backgroundColor: "rgba(6, 182, 212, 0.4)",
            borderColor: "#06b6d4",
            borderWidth: 2,
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { color: "#e2e8f0", padding: 12, boxWidth: 12 },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { color: "#94a3b8" },
            grid: { color: "rgba(139,92,246,0.1)" },
          },
          x: {
            ticks: { color: "#94a3b8" },
            grid: { display: false },
          },
        },
      },
    });
  } else {
    // Без compare — doughnut як раніше
    const palette = [
      "#8b5cf6",
      "#a78bfa",
      "#06b6d4",
      "#22d3ee",
      "#10b981",
      "#f59e0b",
      "#f43f5e",
    ];

    weekdayChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: currentValues,
            backgroundColor: labels.map((_, i) => palette[i % palette.length]),
            borderWidth: 2,
            borderColor: "#1a0f2e",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#e2e8f0", padding: 12, boxWidth: 12 },
          },
        },
      },
    });
  }
}

// ===== CHART: CATEGORY =====
function renderCategoryChart(categories) {
  const ctx = document.getElementById("category-chart").getContext("2d");
  if (categoryChart) categoryChart.destroy();

  const filtered = (categories || []).filter(
    (c) => (parseFloat(c.total) || 0) > 0,
  );

  if (!filtered.length) {
    categoryChart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: ["No data"],
        datasets: [{ data: [1], backgroundColor: ["rgba(139,92,246,0.2)"] }],
      },
      options: { responsive: true, plugins: { legend: { display: false } } },
    });
    return;
  }

  filtered.sort(
    (a, b) => (parseFloat(b.total) || 0) - (parseFloat(a.total) || 0),
  );

  const labels = filtered.map((c) => c.category || "No category");
  const values = filtered.map((c) => parseFloat(c.total) || 0);
  const palette = [
    "#8b5cf6",
    "#a78bfa",
    "#06b6d4",
    "#22d3ee",
    "#10b981",
    "#f59e0b",
    "#f43f5e",
    "#ec4899",
    "#84cc16",
    "#64748b",
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
          borderColor: "#1a0f2e",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: "#e2e8f0", padding: 12, boxWidth: 12 },
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

// ===== REPEAT LIST =====
function renderRepeatList(repeats) {
  const wrap = document.getElementById("repeat-list");
  wrap.innerHTML = "";

  if (!repeats || !repeats.length) {
    wrap.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 30px;">
        <div class="emoji">🔁</div>
        <h3>No repeating expenses</h3>
        <p>Titles bought 4+ times will appear here</p>
      </div>
    `;
    return;
  }

  const map = new Map();
  repeats.forEach((r) => {
    if (!map.has(r.title)) {
      map.set(r.title, {
        title: r.title,
        category: r.category,
        emoji: r.emoji,
        total: 0,
        count: 0,
      });
    }
    const e = map.get(r.title);
    e.total += parseFloat(r.summ) || 0;
    e.count += 1;
  });

  const items = [...map.values()].sort((a, b) => b.count - a.count);

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
  await Promise.all([loadTotal(), loadFinances(), loadRecent(), loadGraphs()]);
}

// ===== LOGOUT =====
function handleLogout() {
  clearToken();
  window.location.href = "login.html";
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("nav-user-name").textContent =
    localStorage.getItem("user_name") || "User";

  const periodSelect = document.getElementById("period-select");
  const customDateInput = document.getElementById("custom-date");
  const compareToggle = document.getElementById("compare-toggle");
  const compareWrap = document.getElementById("compare-toggle-wrap");

  periodSelect.addEventListener("change", (e) => {
    currentPeriod = e.target.value;

    if (currentPeriod === "custom") {
      customDateInput.style.display = "inline-block";
      if (!customDateInput.value) {
        customDateInput.value = new Date().toISOString().slice(0, 10);
      }
      customDate = customDateInput.value;
      compareWrap.style.display = "none";
      compareEnabled = false;
      compareToggle.checked = false;
    } else {
      customDateInput.style.display = "none";
      customDate = null;
      compareWrap.style.display = "inline-flex";
    }

    reloadAll();
  });

  customDateInput.addEventListener("change", (e) => {
    customDate = e.target.value;
    if (customDate) reloadAll();
  });

  compareToggle.addEventListener("change", (e) => {
    compareEnabled = e.target.checked;
    reloadAll();
  });

  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  reloadAll();
});
