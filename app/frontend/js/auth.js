// ===== SIGNUP =====
async function handleSignup(event) {
  event.preventDefault();
  hideMessage("message");

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirm_password").value;

  if (!name || name.length < 2) {
    showMessage("message", "Name must be at least 2 characters", "error");
    return;
  }

  if (!isValidEmail(email)) {
    showMessage("message", "Please enter a valid email", "error");
    return;
  }

  if (!validatePassword(password)) {
    showMessage("message", "Password must be 8–56 characters", "error");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("message", "Passwords don't match", "error");
    return;
  }

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account...";

  try {
    const { response, data } = await apiRequest("/auth/signup", {
      method: "POST",
      body: {
        name,
        email,
        password,
        confirm_password: confirmPassword,
      },
    });

    if (response.status === 201) {
      showMessage("message", "Account created! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);
    } else if (response.status === 409) {
      showMessage("message", "User with this email already exists", "error");
    } else if (response.status === 422) {
      const detail = data?.detail?.[0]?.msg || "Validation error";
      showMessage("message", detail, "error");
    } else if (response.status === 429) {
      showMessage("message", "Too many attempts. Try again later.", "error");
    } else if (response.status === 0) {
      showMessage("message", "Network error. Is the server running?", "error");
    } else {
      showMessage("message", "Something went wrong. Try again.", "error");
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Sign Up";
  }
}

// ===== LOGIN =====
async function handleLogin(event) {
  event.preventDefault();
  hideMessage("message");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!email || !password) {
    showMessage("message", "Please fill in all fields", "error");
    return;
  }

  const submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  try {
    const { response, data } = await apiRequest("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    if (response.status === 200) {
      saveToken(data.access_token, data.name, data.email);
      showMessage("message", "Login successful! Redirecting...", "success");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 800);
    } else if (response.status === 401) {
      showMessage("message", "Wrong email or password", "error");
    } else if (response.status === 429) {
      showMessage("message", "Too many attempts. Try again later.", "error");
    } else if (response.status === 0) {
      showMessage("message", "Network error. Is the server running?", "error");
    } else {
      showMessage("message", "Something went wrong. Try again.", "error");
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Login";
  }
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  clearToken();

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  const signupForm = document.getElementById("signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", handleSignup);
  }
});
