(function () {
    "use strict";

    let currentUser = null;
    let projects = [];
    let milestones = {};

    document.addEventListener("DOMContentLoaded", function () {
        const listEl = document.getElementById("projects-list");
        const addBtn = document.getElementById("add-project-btn");

        if (!window.AppDB || !window.AppDB.client) return;

        window.AppDB.client.auth.onAuthStateChange(async (event, session) => {
            if (session && session.user) {
                currentUser = session.user;
                loadProjects();
            } else {
                currentUser = null;
                projects = [];
                milestones = {};
            }
        });

        async function loadProjects() {
            if (!currentUser) return;
            projects = await window.AppDB.fetchProjects(currentUser.id);
            milestones = {};
            
            for (let proj of projects) {
                milestones[proj.id] = await window.AppDB.fetchMilestones(proj.id);
            }
            render();
        }

        async function createProject() {
            if (!currentUser) return;
            const name = prompt("Project Name:");
            if (!name) return;
            const desc = prompt("Short Description:");
            
            const payload = {
                name: name,
                description: desc || "",
                progress: 0
            };
            await window.AppDB.saveProject(currentUser.id, payload);
            loadProjects();
        }

        async function deleteProject(id) {
            if (confirm("Delete this project?")) {
                await window.AppDB.deleteProject(id);
                loadProjects();
            }
        }

        async function createMilestone(projectId) {
            const text = prompt("Milestone Name:");
            if (!text) return;
            await window.AppDB.saveMilestone(currentUser.id, {
                project_id: projectId,
                text: text,
                completed: false
            });
            loadProjects();
        }

        async function toggleMilestone(milestoneId, isCompleted, projectId) {
            const ms = milestones[projectId].find(m => m.id === milestoneId);
            if (ms) {
                ms.completed = isCompleted;
                await window.AppDB.saveMilestone(currentUser.id, ms);
                
                // Recalculate progress
                const all = milestones[projectId];
                const done = all.filter(m => m.completed).length;
                const prog = all.length ? Math.floor((done / all.length) * 100) : 0;
                
                const proj = projects.find(p => p.id === projectId);
                if (proj) {
                    proj.progress = prog;
                    await window.AppDB.saveProject(currentUser.id, proj);
                }
                loadProjects();
            }
        }

        function render() {
            if (!listEl) return;
            listEl.innerHTML = "";
            if (projects.length === 0) {
                listEl.innerHTML = '<p class="muted text-center" style="padding: 10px;">No projects yet.</p>';
            }

            projects.forEach(proj => {
                const card = document.createElement("div");
                card.className = "tracker-card";

                const msList = milestones[proj.id] || [];

                card.innerHTML = `
                    <div class="tracker-card-head">
                        <div>
                            <h3 style="margin: 0; font-size:1.1rem;">${proj.name}</h3>
                            <p class="muted" style="margin: 2px 0 0; font-size:0.85rem">${proj.description}</p>
                        </div>
                        <button class="ghost-btn small-btn del-proj" data-id="${proj.id}">Delete</button>
                    </div>
                    
                    <div style="font-size: 0.8rem; margin-top: 10px; display:flex; justify-content:space-between;">
                        <span>Progress</span>
                        <span>${proj.progress}%</span>
                    </div>
                    <div class="progress-wrap" style="height: 6px; margin: 5px 0 15px;">
                        <div class="progress-bar" style="width: ${proj.progress}%;"></div>
                    </div>
                    
                    <div class="ms-wrap">
                        ${msList.map(m => `
                            <label style="display:flex; align-items:center; gap:8px; font-size:0.9rem; margin-bottom:5px; cursor:pointer">
                                <input type="checkbox" class="ms-check" data-pid="${proj.id}" data-mid="${m.id}" ${m.completed ? 'checked' : ''}>
                                <span style="${m.completed ? 'text-decoration:line-through; color:var(--text-soft)' : ''}">${m.text}</span>
                            </label>
                        `).join('')}
                    </div>
                    
                    <button class="ghost-btn small-btn add-ms" data-id="${proj.id}" style="margin-top: 10px; width:100%">+ Add Milestone</button>
                `;

                listEl.appendChild(card);
            });

            // Bind events
            listEl.querySelectorAll('.del-proj').forEach(btn => {
                btn.addEventListener('click', (e) => deleteProject(e.target.dataset.id));
            });
            listEl.querySelectorAll('.add-ms').forEach(btn => {
                btn.addEventListener('click', (e) => createMilestone(e.target.dataset.id));
            });
            listEl.querySelectorAll('.ms-check').forEach(chk => {
                chk.addEventListener('change', (e) => {
                    toggleMilestone(e.target.dataset.mid, e.target.checked, e.target.dataset.pid);
                });
            });
        }

        if (addBtn) addBtn.addEventListener('click', createProject);
    });
})();
