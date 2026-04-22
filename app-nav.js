(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", function () {
        const navDashboard = document.getElementById("nav-dashboard");
        const navProfile = document.getElementById("nav-profile");
        const navHealth = document.getElementById("nav-health");

        const viewDashboard = document.getElementById("view-dashboard");
        const viewProfile = document.getElementById("view-profile");
        const viewHealth = document.getElementById("view-health");

        function switchView(viewName) {
            // Update buttons
            navDashboard.classList.remove("active");
            navProfile.classList.remove("active");
            navHealth.classList.remove("active");

            if (viewName === "dashboard") navDashboard.classList.add("active");
            if (viewName === "profile") navProfile.classList.add("active");
            if (viewName === "health") navHealth.classList.add("active");

            // Update sections
            viewDashboard.classList.add("hidden");
            viewProfile.classList.add("hidden");
            viewHealth.classList.add("hidden");
            viewDashboard.classList.remove("active");
            viewProfile.classList.remove("active");
            viewHealth.classList.remove("active");

            if (viewName === "dashboard") {
                viewDashboard.classList.remove("hidden");
                viewDashboard.classList.add("active");
            }
            if (viewName === "profile") {
                viewProfile.classList.remove("hidden");
                viewProfile.classList.add("active");
            }
            if (viewName === "health") {
                viewHealth.classList.remove("hidden");
                viewHealth.classList.add("active");
            }
            
            // Re-render components if needed by dispatching an event
            window.dispatchEvent(new CustomEvent("viewChanged", { detail: viewName }));
        }

        if (navDashboard) navDashboard.addEventListener("click", () => switchView("dashboard"));
        if (navProfile) navProfile.addEventListener("click", () => switchView("profile"));
        if (navHealth) navHealth.addEventListener("click", () => switchView("health"));
    });
})();
