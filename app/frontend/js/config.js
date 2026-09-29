// ===== BACKEND CONFIGURATION =====
const API_URL = "http://localhost:8000";

// ===== TOKEN HELPERS =====
function saveToken(token, name, email) {
  localStorage.setItem("access_token", token);
  localStorage.setItem("user_name", name);
  localStorage.setItem("user_email", email);
}

function getToken() {
  return localStorage.getItem("access_token");
}

function clearToken() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_email");
}

function isLoggedIn() {
  return getToken() !== null;
}

// ===== MESSAGE HELPERS =====
function showMessage(elementId, text, type = "error") {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = text;
  el.className = `message ${type} show`;
}

function hideMessage(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = "message";
}

// ===== FETCH HELPER =====
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;

  // Додаємо токен, якщо є
  const token = getToken();
  if (token) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  //Content-Type JSON
  if (options.body && typeof options.body === "object") {
    options.headers = {
      ...options.headers,
      "Content-Type": "application/json",
    };
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, options);
  const data = await response.json().catch(() => null);

  return { response, data };
}

// ===== VALIDATION HELPERS =====
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  return password.length >= 8 && password.length <= 56;
}
