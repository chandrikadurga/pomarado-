(function () {
    "use strict";

    const dom = {
        authScreen: document.getElementById("auth-screen"),
        authEmail: document.getElementById("auth-email"),
        authPassword: document.getElementById("auth-password"),
        authStatus: document.getElementById("auth-status"),
        appShell: document.getElementById("app-shell")
    };

    function showAuthScreen() {
        dom.authScreen.classList.remove("hidden");
        dom.appShell.classList.add("hidden");
    }

    function showDashboard() {
        dom.authScreen.classList.add("hidden");
        dom.appShell.classList.remove("hidden");
    }

    function getAuthCredentials() {
        return {
            email: dom.authEmail.value.trim(),
            password: dom.authPassword.value
        };
    }

    function setAuthStatus(message, isError) {
        dom.authStatus.textContent = message || "";
        dom.authStatus.style.color = isError ? "#ff8e95" : "";
    }

    function clearAuthForm() {
        dom.authPassword.value = "";
    }

    window.AppUI = {
        showAuthScreen: showAuthScreen,
        showDashboard: showDashboard,
        getAuthCredentials: getAuthCredentials,
        setAuthStatus: setAuthStatus,
        clearAuthForm: clearAuthForm
    };
})();
