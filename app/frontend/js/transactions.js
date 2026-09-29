// ===== STATE =====
let currentPage = 1;
let currentEditId = null;
let currentType = false; // false = expense, true = income
let categoriesCache = [];
let transactionsCache = {};
const PER_PAGE = 15;

// ===== HELPERS =====
function formatSumm(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return "0.00";
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

// ===== RENDER =====
function renderTransactions(transactions) {
  const list = document.getElementById("transactions-list");
  list.innerHTML = "";

  if (!transactions || transactions.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="emoji">💸</div>
        <h3>No transactions found</h3>
        <p>Try adjusting filters or add your first transaction</p>
      </div>
    `;
    return;
  }

  transactions.forEach((t) => {
    const card = document.createElement("div");
    card.className =
      "transaction-item " + (t.transaction_type ? "income" : "expense");

    const sign = t.transaction_type ? "+" : "−";
    const dateStr = formatDate(t.created_date);

    const catDisplay = t.category
      ? `${t.emoji || "📁"} ${escapeHtml(t.category)}`
      : `<span class="no-category">No category</span>`;

    const emojiDisplay = t.emoji || (t.transaction_type ? "💰" : "💸");

    card.innerHTML = `
      <div class="transaction-emoji">${emojiDisplay}</div>
      <div class="transaction-main">
        <div class="transaction-title">${escapeHtml(t.title)}</div>
        <div class="transaction-meta">
          <span>${catDisplay}</span>
          <span>•</span>
          <span>${dateStr}</span>
        </div>
        ${t.description ? `<div class="transaction-desc">${escapeHtml(t.description)}</div>` : ""}
      </div>
      <div class="transaction-amount ${t.transaction_type ? "income" : "expense"}">
        ${sign}${formatSumm(t.summ)}
      </div>
      <div class="transaction-actions">
        <button class="btn-icon" data-action="edit" data-id="${t.id}" title="Edit">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${t.id}" title="Delete">🗑️</button>
      </div>
    `;
    list.appendChild(card);
  });

  // Event delegation for edit/delete
  list.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () =>
      openEditModal(parseInt(btn.dataset.id, 10)),
    );
  });
  list.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () =>
      confirmDelete(parseInt(btn.dataset.id, 10)),
    );
  });
}

// ===== PAGINATION =====
function renderPagination(count) {
  const pag = document.getElementById("pagination");
  pag.innerHTML = "";

  const prevBtn = document.createElement("button");
  prevBtn.textContent = "← Prev";
  prevBtn.disabled = currentPage === 1;
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      loadTransactions();
    }
  });

  const info = document.createElement("span");
  info.className = "page-info";
  info.textContent = `Page ${currentPage}`;

  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next →";
  nextBtn.disabled = count < PER_PAGE;
  nextBtn.addEventListener("click", () => {
    currentPage++;
    loadTransactions();
  });

  pag.appendChild(prevBtn);
  pag.appendChild(info);
  pag.appendChild(nextBtn);
}

// ===== LOAD CATEGORIES (для select у фільтрі та модалці) =====
async function loadCategoriesForSelect() {
  const { response, data } = await apiRequest("/categories/");

  if (response.status === 200) {
    categoriesCache = data;

    const filterSelect = document.getElementById("category-filter");
    const modalSelect = document.getElementById("category-input");

    // зберігаємо перші опції ("All categories" / "No category")
    filterSelect.innerHTML = '<option value="">All categories</option>';
    modalSelect.innerHTML = '<option value="">— No category —</option>';

    data.forEach((cat) => {
      const opt1 = document.createElement("option");
      opt1.value = cat.id;
      opt1.textContent = `${cat.emoji} ${cat.category}`;
      filterSelect.appendChild(opt1);

      const opt2 = document.createElement("option");
      opt2.value = cat.id;
      opt2.textContent = `${cat.emoji} ${cat.category}`;
      modalSelect.appendChild(opt2);
    });
  } else if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
  }
}

// ===== LOAD TRANSACTIONS =====
async function loadTransactions() {
  hideMessage("message");

  const params = new URLSearchParams();
  params.append("page", currentPage);

  const search = document.getElementById("search-input").value.trim();
  if (search) params.append("search", search);

  const type = document.getElementById("type-filter").value;
  if (type === "income") params.append("t_type", "true");
  else if (type === "expense") params.append("t_type", "false");

  const category = document.getElementById("category-filter").value;
  if (category) params.append("category", category);

  const minSum = document.getElementById("min-sum").value;
  if (minSum !== "") params.append("min_sum", minSum);

  const maxSum = document.getElementById("max-sum").value;
  if (maxSum !== "") params.append("max_sum", maxSum);

  const start = document.getElementById("start-date").value;
  if (start) params.append("start", start);

  const end = document.getElementById("end-date").value;
  if (end) params.append("end", end);

  const sort = document.getElementById("sort-select").value;
  if (sort) params.append("sort", sort);

  const { response, data } = await apiRequest(
    `/transactions/filtered?${params.toString()}`,
  );

  if (response.status === 200) {
    transactionsCache = {};
    data.forEach((t) => {
      transactionsCache[t.id] = t;
    });
    renderTransactions(data);
    renderPagination(data.length);
  } else if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
  } else if (response.status === 400) {
    showMessage("message", data?.detail || "Wrong filter", "error");
  } else {
    showMessage("message", "Failed to load transactions", "error");
  }
}

// ===== TYPE TOGGLE =====
function setType(isIncome) {
  currentType = isIncome;
  document.querySelectorAll(".type-btn").forEach((btn) => {
    const btnIsIncome = btn.dataset.type === "income";
    btn.classList.toggle("active", btnIsIncome === isIncome);
  });
}

// ===== MODAL =====
function openAddModal() {
  currentEditId = null;
  setType(false);
  document.getElementById("modal-title").textContent = "Add Transaction";
  document.getElementById("title-input").value = "";
  document.getElementById("summ-input").value = "";
  document.getElementById("category-input").value = "";
  document.getElementById("description-input").value = "";
  document.getElementById("modal-save-btn").textContent = "Create";
  hideMessage("modal-message");
  document.getElementById("modal-overlay").classList.add("show");
}

function openEditModal(id) {
  const t = transactionsCache[id];
  if (!t) return;

  currentEditId = id;
  setType(!!t.transaction_type);

  document.getElementById("modal-title").textContent = "Edit Transaction";
  document.getElementById("title-input").value = t.title || "";
  document.getElementById("summ-input").value = t.summ || "";
  document.getElementById("category-input").value = t.category_id || "";
  document.getElementById("description-input").value = t.description || "";
  document.getElementById("modal-save-btn").textContent = "Save";
  hideMessage("modal-message");
  document.getElementById("modal-overlay").classList.add("show");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("show");
  currentEditId = null;
}

// ===== SAVE (CREATE / UPDATE) =====
async function saveTransaction() {
  hideMessage("modal-message");

  const title = document.getElementById("title-input").value.trim();
  const summRaw = document.getElementById("summ-input").value;
  const categoryVal = document.getElementById("category-input").value;
  const description = document.getElementById("description-input").value.trim();

  // Validation
  if (!title) {
    showMessage("modal-message", "Title is required", "error");
    return;
  }
  if (
    summRaw === "" ||
    isNaN(parseFloat(summRaw)) ||
    parseFloat(summRaw) <= 0
  ) {
    showMessage("modal-message", "Amount must be greater than 0", "error");
    return;
  }

  const summ = parseFloat(summRaw);
  const categoryId = categoryVal ? parseInt(categoryVal, 10) : null;

  const saveBtn = document.getElementById("modal-save-btn");
  saveBtn.disabled = true;

  try {
    let response, data;

    if (currentEditId === null) {
      // CREATE
      ({ response, data } = await apiRequest("/transactions/transaction", {
        method: "POST",
        body: {
          title,
          description: description || null,
          summ,
          transaction_type: currentType,
          category_id: categoryId,
        },
      }));
    } else {
      // UPDATE
      ({ response, data } = await apiRequest(
        `/transactions/transaction/${currentEditId}`,
        {
          method: "PUT",
          body: {
            title,
            description: description || null,
            summ,
            transaction_type: currentType,
            category: categoryId === null ? 0 : categoryId,
          },
        },
      ));
    }

    if (response.status === 201 || response.status === 200) {
      closeModal();
      await loadTransactions();
    } else if (response.status === 404) {
      showMessage("modal-message", "Transaction not found", "error");
    } else if (response.status === 422) {
      const detail = data?.detail?.[0]?.msg || "Validation error";
      showMessage("modal-message", detail, "error");
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else {
      showMessage("modal-message", "Something went wrong", "error");
    }
  } catch (err) {
    showMessage("modal-message", "Network error", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

// ===== DELETE =====
async function confirmDelete(id) {
  const t = transactionsCache[id];
  if (!t) return;

  if (
    !confirm(
      `Delete transaction "${t.title}"?\n\nThis action cannot be undone.`,
    )
  ) {
    return;
  }

  const { response } = await apiRequest(`/transactions/transaction/${id}`, {
    method: "DELETE",
  });

  if (response.status === 204) {
    await loadTransactions();
  } else if (response.status === 404) {
    showMessage("message", "Transaction not found", "error");
  } else if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
  } else {
    showMessage("message", "Failed to delete transaction", "error");
  }
}

// ===== RESET FILTERS =====
function resetFilters() {
  document.getElementById("search-input").value = "";
  document.getElementById("type-filter").value = "";
  document.getElementById("category-filter").value = "";
  document.getElementById("sort-select").value = "date_created_new";
  document.getElementById("min-sum").value = "";
  document.getElementById("max-sum").value = "";
  document.getElementById("start-date").value = "";
  document.getElementById("end-date").value = "";
  currentPage = 1;
  loadTransactions();
}

// ===== DEBOUNCE =====
let searchTimeout;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentPage = 1;
    loadTransactions();
  }, 350);
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", async () => {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("user-name").textContent =
    localStorage.getItem("user_name") || "User";

  // Type toggle
  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      setType(btn.dataset.type === "income");
    });
  });

  // Toolbar events
  document
    .getElementById("search-input")
    .addEventListener("input", debounceSearch);

  [
    "type-filter",
    "category-filter",
    "sort-select",
    "min-sum",
    "max-sum",
    "start-date",
    "end-date",
  ].forEach((id) => {
    document.getElementById(id).addEventListener("change", () => {
      currentPage = 1;
      loadTransactions();
    });
  });

  document
    .getElementById("reset-filters")
    .addEventListener("click", resetFilters);

  // Modal
  document.getElementById("add-btn").addEventListener("click", openAddModal);
  document
    .getElementById("modal-save-btn")
    .addEventListener("click", saveTransaction);
  document
    .getElementById("modal-cancel-btn")
    .addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });

  // Load initial data
  await loadCategoriesForSelect();
  await loadTransactions();
});
