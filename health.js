(function () {
    "use strict";

    let currentUser = null;
    let todayDateStr = new Date().toISOString().split('T')[0];
    let dailyHealth = { water: 0, sleep_hours: 0 };

    document.addEventListener("DOMContentLoaded", function () {
        const waterCountEl = document.getElementById("water-count");
        const waterProgress = document.getElementById("water-progress");
        const addWaterBtn = document.getElementById("add-water-btn");
        const resetWaterBtn = document.getElementById("reset-water-btn");

        const sleepInput = document.getElementById("sleep-hours");
        const sleepDisplay = document.getElementById("sleep-display");
        const sleepProgress = document.getElementById("sleep-progress");
        const saveSleepBtn = document.getElementById("save-sleep-btn");

        if (!window.AppDB || !window.AppDB.client) return;

        window.AppDB.client.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                currentUser = session.user;
                // Whenever returning to the app, sync date.
                todayDateStr = new Date().toISOString().split('T')[0];
                loadHealth();
            } else {
                currentUser = null;
            }
        });

        // Whenever changing tabs we might cross over midnight. Verify date on view changes
        window.addEventListener("viewChanged", (e) => {
            if (e.detail === 'health' && currentUser) {
                const nowStr = new Date().toISOString().split('T')[0];
                if (nowStr !== todayDateStr) {
                    todayDateStr = nowStr;
                    loadHealth();
                }
            }
        });

        async function loadHealth() {
            if (!currentUser) return;
            const log = await window.AppDB.fetchHealthLog(currentUser.id, todayDateStr);
            if (log) {
                dailyHealth.water = log.water || 0;
                dailyHealth.sleep_hours = log.sleep_hours || 0;
            } else {
                dailyHealth.water = 0;
                dailyHealth.sleep_hours = 0;
            }
            render();
        }

        async function updateHealth(updates) {
            Object.assign(dailyHealth, updates);
            render();
            await window.AppDB.saveHealthLog(currentUser.id, todayDateStr, dailyHealth);
        }

        function render() {
            if (!waterCountEl) return;
            
            // Water
            let wCount = Math.min(dailyHealth.water, 8); // Goal 8
            waterCountEl.textContent = dailyHealth.water;
            let wProg = Math.floor((wCount / 8) * 100);
            waterProgress.style.width = wProg + "%";

            // Sleep
            sleepInput.value = dailyHealth.sleep_hours;
            sleepDisplay.textContent = dailyHealth.sleep_hours;
            let sCount = Math.min(dailyHealth.sleep_hours, 8); // Goal 8
            let sProg = Math.floor((sCount / 8) * 100);
            sleepProgress.style.width = sProg + "%";
            sleepProgress.style.background = "linear-gradient(90deg, #6b88a9, #5d6dd8)"; 
        }

        if (addWaterBtn) {
            addWaterBtn.addEventListener("click", () => {
                if (currentUser) updateHealth({ water: dailyHealth.water + 1 });
            });
        }
        if (resetWaterBtn) {
            resetWaterBtn.addEventListener("click", () => {
                if (currentUser) updateHealth({ water: 0 });
            });
        }

        if (saveSleepBtn) {
            saveSleepBtn.addEventListener("click", () => {
                const val = parseFloat(sleepInput.value) || 0;
                if (currentUser) updateHealth({ sleep_hours: val });
            });
        }
    });
})();
