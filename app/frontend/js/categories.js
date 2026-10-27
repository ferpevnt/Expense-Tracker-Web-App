// ===== STATE =====
let currentEditId = null;
let selectedEmoji = "🍕";

const EMOJI_LIST = [
  "🍕",
  "🍔",
  "🍣",
  "🥗",
  "🍩",
  "☕",
  "🍺",
  "🍷",
  "🚗",
  "🚌",
  "✈️",
  "⛽",
  "🚲",
  "🚕",
  "🏠",
  "💡",
  "💧",
  "🛋️",
  "🔧",
  "🛒",
  "👕",
  "👟",
  "💄",
  "🎁",
  "💊",
  "🏥",
  "🦷",
  "👓",
  "📚",
  "🎓",
  "💻",
  "📱",
  "🎮",
  "🎬",
  "🎵",
  "🎨",
  "📷",
  "🏋️",
  "⚽",
  "🎾",
  "🏊",
  "💰",
  "💳",
  "📈",
  "🏦",
  "🐶",
  "🐱",
  "🌱",
  "✂️",
  "🎉",
  "🎂",
  "🎄",
  "🌍",
  "🔥",
  "⭐",
  "💎",
];

// ===== HELPERS =====
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
function renderCategories(categories) {
  const grid = document.getElementById("categories-grid");
  grid.innerHTML = "";

  if (!categories || categories.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <div class="emoji">📂</div>
        <h3>No categories yet</h3>
        <p>Click "Add Category" to create your first one</p>
      </div>
    `;
    return;
  }

  categories.forEach((cat) => {
    const card = document.createElement("div");
    card.className = "category-card";
    card.innerHTML = `
      <div class="category-emoji">${cat.emoji || "📁"}</div>
      <div class="category-name">${escapeHtml(cat.category)}</div>
      <div class="category-count">${cat.transaction_count ?? 0} transactions</div>
      <div class="category-actions">
        <button class="btn-icon" data-action="edit" data-id="${cat.id}">✏️</button>
        <button class="btn-icon" data-action="delete" data-id="${cat.id}">🗑️</button>
      </div>
    `;
    grid.appendChild(card);
  });

  // Delegation
  grid.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.id, 10);
      const cat = categories.find((c) => c.id === id);
      if (cat) openEditModal(cat);
    });
  });

  grid.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = parseInt(btn.dataset.id, 10);
      const cat = categories.find((c) => c.id === id);
      if (cat) confirmDelete(cat);
    });
  });
}

// ===== LOAD =====
async function loadCategories() {
  hideMessage("message");

  const search = document.getElementById("search-input").value.trim();
  const sort = document.getElementById("sort-select").value;

  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (sort) params.append("sort", sort);

  try {
    const { response, data } = await apiRequest(
      `/categories/filtered?${params.toString()}`,
    );

    if (response.status === 200) {
      renderCategories(data);
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else if (response.status === 400) {
      showMessage("message", data?.detail || "Invalid sort filter", "error");
    } else {
      showMessage("message", "Failed to load categories", "error");
    }
  } catch (error) {
    showMessage("message", "Network error", "error");
  }
}

// ===== EMOJI PICKER =====
function renderEmojiPicker() {
  const picker = document.getElementById("emoji-picker");
  picker.innerHTML = "";

  EMOJI_LIST.forEach((e) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-option" + (e === selectedEmoji ? " selected" : "");
    btn.textContent = e;
    btn.addEventListener("click", () => {
      selectedEmoji = e;
      document.getElementById("emoji-input").value = e;
      renderEmojiPicker();
    });
    picker.appendChild(btn);
  });
}

// ===== MODAL =====
function openAddModal() {
  currentEditId = null;
  selectedEmoji = "🍕";
  document.getElementById("modal-title").textContent = "Add Category";
  document.getElementById("name-input").value = "";
  document.getElementById("emoji-input").value = selectedEmoji;
  document.getElementById("modal-save-btn").textContent = "Create";
  hideMessage("modal-message");
  renderEmojiPicker();
  document.getElementById("modal-overlay").classList.add("show");
  document.getElementById("name-input").focus();
}

function openEditModal(cat) {
  currentEditId = cat.id;
  selectedEmoji = cat.emoji || "📁";
  document.getElementById("modal-title").textContent = "Edit Category";
  document.getElementById("name-input").value = cat.category;
  document.getElementById("emoji-input").value = selectedEmoji;
  document.getElementById("modal-save-btn").textContent = "Save";
  hideMessage("modal-message");
  renderEmojiPicker();
  document.getElementById("modal-overlay").classList.add("show");
  document.getElementById("name-input").focus();
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("show");
  currentEditId = null;
}

// ===== SAVE =====
async function saveCategory() {
  hideMessage("modal-message");

  const name = document.getElementById("name-input").value.trim();
  const emoji =
    document.getElementById("emoji-input").value.trim() || selectedEmoji;

  if (!name) {
    showMessage("modal-message", "Name is required", "error");
    return;
  }

  const saveBtn = document.getElementById("modal-save-btn");
  saveBtn.disabled = true;

  try {
    let response, data;

    if (currentEditId === null) {
      ({ response, data } = await apiRequest("/categories/category", {
        method: "POST",
        body: { category: name, emoji },
      }));
    } else {
      ({ response, data } = await apiRequest(
        `/categories/category/${currentEditId}`,
        {
          method: "PUT",
          body: { category: name, emoji },
        },
      ));
    }

    if (response.status === 201 || response.status === 200) {
      closeModal();
      await loadCategories();
    } else if (response.status === 409) {
      showMessage(
        "modal-message",
        "Category with such name already exists",
        "error",
      );
    } else if (response.status === 404) {
      showMessage("modal-message", "Category not found", "error");
    } else if (response.status === 422) {
      const detail = data?.detail?.[0]?.msg || "Validation error";
      showMessage("modal-message", detail, "error");
    } else if (response.status === 429) {
      showMessage("modal-message", "Too many attempts. Try later.", "error");
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else {
      showMessage("modal-message", "Something went wrong", "error");
    }
  } catch (error) {
    showMessage("modal-message", "Network error", "error");
  } finally {
    saveBtn.disabled = false;
  }
}

// ===== DELETE =====
async function confirmDelete(cat) {
  if (
    !confirm(
      `Delete category "${cat.category}"?\n\nThis will not delete transactions, but they will lose their category.`,
    )
  ) {
    return;
  }

  try {
    const { response } = await apiRequest(`/categories/category/${cat.id}`, {
      method: "DELETE",
    });

    if (response.status === 204) {
      await loadCategories();
    } else if (response.status === 404) {
      showMessage("message", "Category not found", "error");
    } else if (response.status === 429) {
      showMessage("message", "Too many attempts. Try later.", "error");
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else {
      showMessage("message", "Failed to delete category", "error");
    }
  } catch (error) {
    showMessage("message", "Network error", "error");
  }
}

// ===== LOGOUT =====
function handleLogout() {
  clearToken();
  window.location.href = "login.html";
}

// ===== DEBOUNCE =====
let searchTimeout;
function debounceSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(loadCategories, 300);
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  if (!isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  document.getElementById("nav-user-name").textContent =
    localStorage.getItem("user_name") || "User";

  document
    .getElementById("search-input")
    .addEventListener("input", debounceSearch);
  document
    .getElementById("sort-select")
    .addEventListener("change", loadCategories);
  document.getElementById("add-btn").addEventListener("click", openAddModal);
  document
    .getElementById("modal-save-btn")
    .addEventListener("click", saveCategory);
  document
    .getElementById("modal-cancel-btn")
    .addEventListener("click", closeModal);
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });
  document.getElementById("emoji-input").addEventListener("input", (e) => {
    selectedEmoji = e.target.value;
    renderEmojiPicker();
  });
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  loadCategories();
});
