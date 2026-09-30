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
];

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
                <button class="btn-icon" onclick="openEditModal(${cat.id}, '${escapeHtml(cat.category)}', '${cat.emoji}')">✏️</button>
                <button class="btn-icon" onclick="confirmDelete(${cat.id}, '${escapeHtml(cat.category)}')">🗑️</button>
            </div>
        `;
    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/'/g, "\\'")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ===== LOAD =====
async function loadCategories() {
  const search = document.getElementById("search-input").value.trim();
  const sort = document.getElementById("sort-select").value;

  const params = new URLSearchParams();
  if (search) params.append("search", search);
  if (sort) params.append("sort", sort);

  const { response, data } = await apiRequest(
    `/categories/filtered?${params.toString()}`,
  );

  if (response.status === 200) {
    renderCategories(data);
  } else if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
  } else if (response.status === 400) {
    showMessage("message", data?.detail || "Wrong filter", "error");
  } else {
    showMessage("message", "Failed to load categories", "error");
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
    btn.onclick = () => {
      selectedEmoji = e;
      document.getElementById("emoji-input").value = e;
      renderEmojiPicker();
    };
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
}

function openEditModal(id, name, emoji) {
  currentEditId = id;
  selectedEmoji = emoji || "📁";
  document.getElementById("modal-title").textContent = "Edit Category";
  document.getElementById("name-input").value = name;
  document.getElementById("emoji-input").value = selectedEmoji;
  document.getElementById("modal-save-btn").textContent = "Save";
  hideMessage("modal-message");
  renderEmojiPicker();
  document.getElementById("modal-overlay").classList.add("show");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.remove("show");
  currentEditId = null;
}

// ===== SAVE (CREATE / UPDATE) =====
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
      // CREATE
      ({ response, data } = await apiRequest("/categories/category", {
        method: "POST",
        body: { category: name, emoji },
      }));
    } else {
      // UPDATE
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
async function confirmDelete(id, name) {
  if (!confirm(`Delete category "${name}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  const { response } = await apiRequest(`/categories/category/${id}`, {
    method: "DELETE",
  });

  if (response.status === 204) {
    await loadCategories();
  } else if (response.status === 404) {
    showMessage("message", "Category not found", "error");
  } else if (response.status === 401) {
    clearToken();
    window.location.href = "login.html";
  } else {
    showMessage("message", "Failed to delete category", "error");
  }
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

  document.getElementById("user-name").textContent =
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

  loadCategories();
});
