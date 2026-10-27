// ===== API =====
const API_URL = "http://localhost:8000";

// ===== TOKEN =====
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

// ===== PUBLIC ENDPOINTS (не додаємо токен) =====
const PUBLIC_ENDPOINTS = ["/auth/login", "/auth/signup"];

// ===== FETCH WRAPPER =====
async function apiRequest(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const token = getToken();
  const isPublic = PUBLIC_ENDPOINTS.some((e) => endpoint.startsWith(e));

  const headers = { ...(options.headers || {}) };

  if (token && !isPublic) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body && typeof options.body === "object") {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => null);
    return { response, data };
  } catch (error) {
    return { response: { status: 0, ok: false }, data: null, error };
  }
}

// ===== MESSAGES =====
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

// ===== VALIDATION =====
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePassword(password) {
  return password.length >= 8 && password.length <= 56;
}
