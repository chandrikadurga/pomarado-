(function () {
    "use strict";

    let currentUser = null;

    document.addEventListener("DOMContentLoaded", function () {
        const usernameInput = document.getElementById("profile-username");
        const collegeInput = document.getElementById("profile-college");
        const bioInput = document.getElementById("profile-bio");
        const saveBtn = document.getElementById("save-profile-btn");
        const statusMsg = document.getElementById("profile-status");

        if (!window.AppDB || !window.AppDB.client) return;

        window.AppDB.client.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                currentUser = session.user;
                loadProfile();
            } else {
                currentUser = null;
            }
        });

        async function loadProfile() {
            if (!currentUser) return;
            const profile = await window.AppDB.fetchProfile(currentUser.id);
            if (profile) {
                if (usernameInput) usernameInput.value = profile.username || "";
                if (collegeInput) collegeInput.value = profile.college || "";
                if (bioInput) bioInput.value = profile.bio || "";
            } else {
                // First login, create profile
                await window.AppDB.saveProfile(currentUser.id, {
                    username: "",
                    college: "",
                    bio: ""
                });
            }
        }

        if (saveBtn) {
            saveBtn.addEventListener("click", async () => {
                if (!currentUser) return;
                
                statusMsg.textContent = "Saving...";
                
                await window.AppDB.saveProfile(currentUser.id, {
                    username: usernameInput.value,
                    college: collegeInput.value,
                    bio: bioInput.value
                });
                
                statusMsg.textContent = "Profile saved successfully!";
                setTimeout(() => { statusMsg.textContent = ""; }, 3000);
            });
        }
    });
})();
