// ===== LOAD PROFILE =====
async function loadProfile() {
  try {
    const { response, data } = await apiRequest(
      "/profile/?username=true&email=true",
    );

    if (response.status === 200) {
      document.getElementById("display-name").textContent = data.name || "—";
      document.getElementById("display-email").textContent = data.email || "—";
      document.getElementById("name-input").value = data.name || "";
      document.getElementById("nav-user-name").textContent =
        data.name || "User";

      // Sync localStorage
      localStorage.setItem("user_name", data.name || "");
      localStorage.setItem("user_email", data.email || "");
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else if (response.status === 400) {
      showMessage("message", "Failed to load profile", "error");
    } else {
      showMessage("message", "Failed to load profile", "error");
    }
  } catch (error) {
    showMessage("message", "Network error", "error");
  }
}

// ===== UPDATE NAME =====
async function saveName() {
  hideMessage("name-message");

  const name = document.getElementById("name-input").value.trim();

  if (!name || name.length < 2) {
    showMessage("name-message", "Name must be at least 2 characters", "error");
    return;
  }

  const btn = document.getElementById("save-name-btn");
  btn.disabled = true;

  try {
    const { response, data } = await apiRequest("/profile/name", {
      method: "PUT",
      body: { name },
    });

    if (response.status === 200) {
      document.getElementById("display-name").textContent = data.name;
      document.getElementById("nav-user-name").textContent = data.name;
      localStorage.setItem("user_name", data.name);
      showMessage("name-message", "Name updated successfully ✓", "success");
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else if (response.status === 422) {
      const detail = data?.detail?.[0]?.msg || "Validation error";
      showMessage("name-message", detail, "error");
    } else if (response.status === 429) {
      showMessage("name-message", "Too many attempts. Try later.", "error");
    } else {
      showMessage("name-message", "Failed to update name", "error");
    }
  } catch (error) {
    showMessage("name-message", "Network error", "error");
  } finally {
    btn.disabled = false;
  }
}

// ===== UPDATE PASSWORD =====
async function savePassword() {
  hideMessage("password-message");

  const currentPassword = document.getElementById("current-password").value;
  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-new-password").value;

  if (!currentPassword) {
    showMessage("password-message", "Enter current password", "error");
    return;
  }

  if (!newPassword || newPassword.length < 8 || newPassword.length > 56) {
    showMessage(
      "password-message",
      "New password must be 8–56 characters",
      "error",
    );
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage("password-message", "Passwords don't match", "error");
    return;
  }

  if (newPassword === currentPassword) {
    showMessage(
      "password-message",
      "New password must differ from the old one",
      "error",
    );
    return;
  }

  const btn = document.getElementById("save-password-btn");
  btn.disabled = true;

  try {
    const { response, data } = await apiRequest("/profile/password", {
      method: "PUT",
      body: {
        password: currentPassword,
        new_password: newPassword,
      },
    });

    if (response.status === 200) {
      showMessage(
        "password-message",
        "Password updated successfully ✓",
        "success",
      );
      document.getElementById("current-password").value = "";
      document.getElementById("new-password").value = "";
      document.getElementById("confirm-new-password").value = "";
    } else if (response.status === 401) {
      // 401 може бути: неправильний пароль АБО токен прострочений
      if (!getToken()) {
        clearToken();
        window.location.href = "login.html";
        return;
      }
      showMessage("password-message", "Current password is incorrect", "error");
    } else if (response.status === 422) {
      const detail = data?.detail?.[0]?.msg || "Validation error";
      showMessage("password-message", detail, "error");
    } else if (response.status === 429) {
      showMessage("password-message", "Too many attempts. Try later.", "error");
    } else {
      showMessage("password-message", "Failed to update password", "error");
    }
  } catch (error) {
    showMessage("password-message", "Network error", "error");
  } finally {
    btn.disabled = false;
  }
}

// ===== DELETE ACCOUNT =====
async function deleteAccount() {
  const confirmed = confirm(
    "⚠️ Are you sure you want to delete your account?\n\n" +
      "This will permanently remove ALL your transactions and categories.\n" +
      "This action CANNOT be undone.",
  );
  if (!confirmed) return;

  const typed = prompt('Type "DELETE" to confirm:');
  if (typed !== "DELETE") {
    showMessage("message", "Deletion cancelled", "error");
    return;
  }

  const btn = document.getElementById("delete-account-btn");
  btn.disabled = true;

  try {
    const { response } = await apiRequest("/profile/user", {
      method: "DELETE",
    });

    if (response.status === 204) {
      clearToken();
      alert("Account deleted. Redirecting...");
      window.location.href = "login.html";
    } else if (response.status === 401) {
      clearToken();
      window.location.href = "login.html";
    } else if (response.status === 429) {
      showMessage("message", "Too many attempts. Try later.", "error");
      btn.disabled = false;
    } else {
      showMessage("message", "Failed to delete account", "error");
      btn.disabled = false;
    }
  } catch (error) {
    showMessage("message", "Network error", "error");
    btn.disabled = false;
  }
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

  // Fallback
  document.getElementById("nav-user-name").textContent =
    localStorage.getItem("user_name") || "User";

  document.getElementById("save-name-btn").addEventListener("click", saveName);
  document
    .getElementById("save-password-btn")
    .addEventListener("click", savePassword);
  document
    .getElementById("delete-account-btn")
    .addEventListener("click", deleteAccount);
  document.getElementById("logout-btn").addEventListener("click", handleLogout);

  loadProfile();
});
