(function () {
    "use strict";

    let currentUser = null;
    let subjects = [];

    document.addEventListener("DOMContentLoaded", function () {
        const listEl = document.getElementById("subjects-list");
        const addBtn = document.getElementById("add-subject-btn");

        if (!window.AppDB || !window.AppDB.client) return;

        window.AppDB.client.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                currentUser = session.user;
                loadSubjects();
            } else {
                currentUser = null;
                subjects = [];
            }
        });

        async function loadSubjects() {
            if (!currentUser) return;
            subjects = await window.AppDB.fetchSubjects(currentUser.id);
            render();
        }

        async function createSubject() {
            if (!currentUser) return;
            const name = prompt("Subject Name (e.g. Physics 101):");
            if (!name) return;
            const units = parseInt(prompt("Total units/chapters:"), 10) || 1;
            
            const payload = {
                name: name,
                total_units: units,
                completed_units: 0
            };
            await window.AppDB.saveSubject(currentUser.id, payload);
            loadSubjects();
        }

        async function deleteSubject(id) {
            if (confirm("Delete this subject?")) {
                await window.AppDB.deleteSubject(id);
                loadSubjects();
            }
        }

        async function updateUnits(id, newCompleted) {
            const subj = subjects.find(s => s.id === id);
            if (subj) {
                subj.completed_units = Math.max(0, Math.min(subj.total_units, newCompleted));
                await window.AppDB.saveSubject(currentUser.id, subj);
                loadSubjects();
            }
        }

        function render() {
            if (!listEl) return;
            listEl.innerHTML = "";
            if (subjects.length === 0) {
                listEl.innerHTML = '<p class="muted text-center" style="padding: 10px;">No subjects yet.</p>';
            }

            subjects.forEach(subj => {
                const card = document.createElement("div");
                card.className = "tracker-card";

                const prog = subj.total_units ? Math.floor((subj.completed_units / subj.total_units) * 100) : 0;

                card.innerHTML = `
                    <div class="tracker-card-head">
                        <h3 style="margin: 0; font-size:1.1rem;">${subj.name}</h3>
                        <button class="ghost-btn small-btn del-subj" data-id="${subj.id}">Delete</button>
                    </div>
                    
                    <div style="font-size: 0.8rem; margin-top: 10px; display:flex; justify-content:space-between; align-items:center;">
                        <span>Progress (${prog}%)</span>
                        <div style="display:flex; align-items:center; gap:5px">
                            <button class="ghost-btn small-btn minus-u" data-id="${subj.id}">-</button>
                            <span style="min-width: 30px; text-align:center">${subj.completed_units} / ${subj.total_units}</span>
                            <button class="ghost-btn small-btn plus-u" data-id="${subj.id}">+</button>
                        </div>
                    </div>
                    <div class="progress-wrap" style="height: 6px; margin: 5px 0 0;">
                        <div class="progress-bar" style="width: ${prog}%; background: linear-gradient(90deg, #ff876c, #ff5f77)"></div>
                    </div>
                `;

                listEl.appendChild(card);
            });

            // Bind events
            listEl.querySelectorAll('.del-subj').forEach(btn => {
                btn.addEventListener('click', (e) => deleteSubject(e.target.dataset.id));
            });
            listEl.querySelectorAll('.minus-u').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const subj = subjects.find(s => s.id === e.target.dataset.id);
                    updateUnits(subj.id, subj.completed_units - 1);
                });
            });
            listEl.querySelectorAll('.plus-u').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const subj = subjects.find(s => s.id === e.target.dataset.id);
                    updateUnits(subj.id, subj.completed_units + 1);
                });
            });
        }

        if (addBtn) addBtn.addEventListener('click', createSubject);
    });
})();
