(function () {
    "use strict";

    const DEFAULT_SETTINGS = {
        focusMinutes: 25,
        shortBreakMinutes: 5,
        longBreakMinutes: 15,
        sessionsBeforeLong: 4,
        soundEnabled: true,
        alarmSound: "bell",
        theme: "light"
    };

    const MODE_LABELS = {
        focus: "Focus Session",
        shortBreak: "Short Break",
        longBreak: "Long Break"
    };

    const BREAK_QUOTES = [
        "Breaks prevent burnout and protect high-quality output.",
        "Step away for a moment. Better ideas return quickly.",
        "Resting is part of deep work, not a pause from it.",
        "A short reset now means stronger focus next block."
    ];

    const INSIGHT_QUOTES = [
        "Consistency beats intensity when the goal is long-term progress.",
        "A protected hour of focus creates momentum for the whole day.",
        "Clarity comes from fewer switches, not more effort.",
        "Your calendar becomes your results when sessions are completed."
    ];

    /* Storage Module: cloud-backed cache with Supabase persistence. */
    const StorageModule = (function () {
        const cloudState = {
            settings: { ...DEFAULT_SETTINGS },
            timerState: null,
            stats: { daily: {} },
            streakData: {
                lastActiveDate: null,
                currentStreak: 0,
                bestStreak: 0
            },
            tasks: [],
            notes: [],
            music: {
                lastTrackIndex: 0,
                lastVolume: 0.7
            }
        };

        function persistSafe(saveOperation) {
            if (!appState.currentUserId) {
                return;
            }
            saveOperation().catch(function (error) {
                console.error("[Cloud] Persist failed:", error);
            });
        }

        function normalizeSettings(saved) {
            if (!saved || typeof saved !== "object") {
                return { ...DEFAULT_SETTINGS };
            }

            return {
                focusMinutes: clampInt(saved.focusMinutes, 1, 120, DEFAULT_SETTINGS.focusMinutes),
                shortBreakMinutes: clampInt(saved.shortBreakMinutes, 1, 60, DEFAULT_SETTINGS.shortBreakMinutes),
                longBreakMinutes: clampInt(saved.longBreakMinutes, 1, 120, DEFAULT_SETTINGS.longBreakMinutes),
                sessionsBeforeLong: clampInt(saved.sessionsBeforeLong, 1, 12, DEFAULT_SETTINGS.sessionsBeforeLong),
                soundEnabled: typeof saved.soundEnabled === "boolean" ? saved.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
                alarmSound: ["bell", "chime", "buzzer"].includes(saved.alarmSound)
                    ? saved.alarmSound
                    : DEFAULT_SETTINGS.alarmSound,
                theme: "light"
            };
        }

        return {
            hydrateFromCloud: async function (userId) {
                const bundle = await window.AppDB.loadUserBundle(userId);

                Object.assign(cloudState.settings, normalizeSettings(bundle.settings));
                cloudState.timerState = bundle.timerState || null;

                cloudState.stats.daily = bundle.stats && bundle.stats.daily && typeof bundle.stats.daily === "object"
                    ? bundle.stats.daily
                    : {};

                Object.assign(cloudState.streakData, {
                    lastActiveDate: bundle.streakData && typeof bundle.streakData.lastActiveDate === "string"
                        ? bundle.streakData.lastActiveDate
                        : null,
                    currentStreak: bundle.streakData && Number.isFinite(bundle.streakData.currentStreak)
                        ? Math.max(0, bundle.streakData.currentStreak)
                        : 0,
                    bestStreak: bundle.streakData && Number.isFinite(bundle.streakData.bestStreak)
                        ? Math.max(0, bundle.streakData.bestStreak)
                        : 0
                });

                cloudState.tasks.splice(0, cloudState.tasks.length);
                (Array.isArray(bundle.tasks) ? bundle.tasks : []).forEach(function (task) {
                    cloudState.tasks.push({
                        id: String(task.id),
                        text: String(task.text || ""),
                        completed: Boolean(task.completed)
                    });
                });

                cloudState.notes.splice(0, cloudState.notes.length);
                (Array.isArray(bundle.notes) ? bundle.notes : []).forEach(function (note) {
                    cloudState.notes.push(note);
                });

                Object.assign(cloudState.music, {
                    lastTrackIndex: Number.isFinite(bundle.music && bundle.music.lastTrackIndex)
                        ? Math.max(0, bundle.music.lastTrackIndex)
                        : 0,
                    lastVolume: typeof (bundle.music && bundle.music.lastVolume) === "number"
                        ? Math.max(0, Math.min(1, bundle.music.lastVolume))
                        : 0.7
                });
            },
            loadSettings: function () {
                return cloudState.settings;
            },
            saveSettings: function (settings) {
                Object.assign(cloudState.settings, settings);
                persistSafe(function () {
                    return window.AppDB.saveSettings(appState.currentUserId, cloudState.settings);
                });
            },
            loadTimerState: function () {
                return cloudState.timerState;
            },
            saveTimerState: function (timerState) {
                cloudState.timerState = timerState;
                persistSafe(function () {
                    return window.AppDB.saveTimerState(appState.currentUserId, cloudState.timerState);
                });
            },
            loadStats: function () {
                return cloudState.stats;
            },
            saveStats: function (stats) {
                cloudState.stats = stats;
                persistSafe(function () {
                    return window.AppDB.saveStats(appState.currentUserId, cloudState.stats);
                });
            },
            loadStreakData: function () {
                return cloudState.streakData;
            },
            saveStreakData: function (streakData) {
                cloudState.streakData = streakData;
                persistSafe(function () {
                    return window.AppDB.saveStreakData(appState.currentUserId, cloudState.streakData);
                });
            },
            loadTasks: function () {
                return cloudState.tasks;
            },
            saveTasks: function (tasks) {
                cloudState.tasks = tasks;
                persistSafe(function () {
                    return window.AppDB.saveTasks(appState.currentUserId, cloudState.tasks);
                });
            },
            loadNotes: function () {
                return cloudState.notes;
            },
            saveNotes: function (notes) {
                cloudState.notes = notes;
                persistSafe(function () {
                    return window.AppDB.saveNotes(appState.currentUserId, cloudState.notes);
                });
            },
            loadMusic: function () {
                return cloudState.music;
            },
            saveMusic: function (music) {
                cloudState.music = music;
                persistSafe(function () {
                    return window.AppDB.saveMusic(appState.currentUserId, cloudState.music);
                });
            }
        };
    })();

    const settings = StorageModule.loadSettings();

    const dom = {
        body: document.body,
        appShell: document.getElementById("app-shell"),
        authScreen: document.getElementById("auth-screen"),
        loginBtn: document.getElementById("login-btn"),
        signupBtn: document.getElementById("signup-btn"),
        logoutBtn: document.getElementById("logout-btn"),
        fullscreenBtn: document.getElementById("fullscreen-btn"),
        timerPanel: document.querySelector(".timer-panel"),

        modeButtons: document.querySelectorAll(".mode-btn"),
        currentModeLabel: document.getElementById("current-mode-label"),
        time: document.getElementById("time"),
        quote: document.getElementById("quote"),
        insightQuote: document.getElementById("insight-quote"),

        startPauseBtn: document.getElementById("start-pause-btn"),
        resetBtn: document.getElementById("reset-btn"),
        currentSessionCount: document.getElementById("current-session-count"),
        sessionsBeforeLong: document.getElementById("sessions-before-long"),

        progressCircle: document.querySelector(".progress-ring__circle"),
        ringStopStart: document.getElementById("ring-stop-start"),
        ringStopEnd: document.getElementById("ring-stop-end"),

        focusDurationInput: document.getElementById("focus-duration"),
        shortBreakDurationInput: document.getElementById("short-break-duration"),
        longBreakDurationInput: document.getElementById("long-break-duration"),
        sessionsCountInput: document.getElementById("sessions-count"),
        soundToggleInput: document.getElementById("sound-toggle"),
        alarmSoundSelect: document.getElementById("alarm-sound"),
        saveSettingsBtn: document.getElementById("save-settings-btn"),
        settingsStatus: document.getElementById("settings-status"),
        testSoundBtn: document.getElementById("test-sound-btn"),

        monthYear: document.getElementById("month-year"),
        calendarGrid: document.getElementById("calendar-grid"),
        prevMonthBtn: document.getElementById("prev-month"),
        nextMonthBtn: document.getElementById("next-month"),
        selectedDateStats: document.getElementById("selected-date-stats"),
        selectedDateTitle: document.getElementById("selected-date-title"),
        selectedDateSessions: document.getElementById("selected-date-sessions"),
        selectedDateTime: document.getElementById("selected-date-time"),

        todaySessions: document.getElementById("today-sessions"),
        weeklySessions: document.getElementById("weekly-sessions"),
        totalFocusTime: document.getElementById("total-focus-time"),
        currentStreak: document.getElementById("current-streak"),
        bestStreak: document.getElementById("best-streak"),
        weeklyChart: document.getElementById("weekly-chart"),

        taskForm: document.getElementById("task-form"),
        taskInput: document.getElementById("task-input"),
        taskList: document.getElementById("task-list"),
        taskCompleteModal: document.getElementById("task-complete-modal"),
        taskCompleteText: document.getElementById("task-complete-text"),
        taskCompleteYes: document.getElementById("task-complete-yes"),
        taskCompleteNo: document.getElementById("task-complete-no"),

        addNoteBtn: document.getElementById("add-note-btn"),
        notesList: document.getElementById("notes-list"),

        musicPanel: document.querySelector(".music-panel"),
        musicCover: document.getElementById("music-cover"),
        musicTrackName: document.getElementById("music-track-name"),
        musicArtist: document.getElementById("music-artist"),
        musicStatus: document.getElementById("music-status"),
        musicPrev: document.getElementById("music-prev"),
        musicToggle: document.getElementById("music-toggle"),
        musicNext: document.getElementById("music-next"),
        musicSeek: document.getElementById("music-seek"),
        musicProgressTrack: document.getElementById("music-progress-track"),
        musicVolume: document.getElementById("music-volume"),
        musicMute: document.getElementById("music-mute"),
        musicVolumeText: document.getElementById("music-volume-text"),
        musicCurrentTime: document.getElementById("music-current-time"),
        musicTotalTime: document.getElementById("music-total-time"),
        musicProgressBar: document.getElementById("music-progress-bar"),
        musicError: document.getElementById("music-error"),

        musicAudio: new Audio(),
        alarmAudio: document.getElementById("alarm-audio")
    };

    const appState = {
        settings: settings,
        selectedDateKey: null,
        viewMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        isFocusFullscreen: false,
        currentUserId: null
    };

    /* Stats Module: owns daily productivity aggregates and summaries. */
    const StatsModule = (function () {
        const stats = StorageModule.loadStats();

        function ensureDay(dayKey) {
            if (!stats.daily[dayKey]) {
                stats.daily[dayKey] = {
                    sessions: 0,
                    focusMinutes: 0
                };
            }
        }

        function recordFocus(minutes, date) {
            const key = getDateKey(date);
            ensureDay(key);
            stats.daily[key].sessions += 1;
            stats.daily[key].focusMinutes += minutes;
            StorageModule.saveStats(stats);
        }

        function getDay(dayKey) {
            return stats.daily[dayKey] || { sessions: 0, focusMinutes: 0 };
        }

        function getTotalFocusMinutes() {
            return Object.keys(stats.daily).reduce(function (sum, key) {
                return sum + (stats.daily[key].focusMinutes || 0);
            }, 0);
        }

        function getWeeklySummary() {
            const days = [];
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            for (let i = 6; i >= 0; i -= 1) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const key = getDateKey(date);
                const entry = getDay(key);
                days.push({
                    key: key,
                    label: date.toLocaleDateString(undefined, { weekday: "short" }),
                    sessions: entry.sessions,
                    focusMinutes: entry.focusMinutes
                });
            }

            return days;
        }

        function getToday() {
            return getDay(getDateKey(new Date()));
        }

        function getStats() {
            return stats;
        }

        return {
            recordFocus: recordFocus,
            getDay: getDay,
            getToday: getToday,
            getTotalFocusMinutes: getTotalFocusMinutes,
            getWeeklySummary: getWeeklySummary,
            getStats: getStats
        };
    })();

    /* Streak Module: tracks daily consistency and longest run. */
    const StreakModule = (function () {
        const streakState = StorageModule.loadStreakData();

        function syncOnAppLoad() {
            if (!streakState.lastActiveDate) {
                persist();
                return;
            }

            const todayKey = getDateKey(new Date());
            if (streakState.lastActiveDate === todayKey) {
                return;
            }

            const gap = getDayGap(streakState.lastActiveDate, todayKey);
            if (gap > 1) {
                streakState.currentStreak = 0;
                persist();
            }
        }

        function registerSessionCompletion(date) {
            const todayKey = getDateKey(date);
            if (streakState.lastActiveDate === todayKey) {
                return { increased: false };
            }

            const previous = streakState.currentStreak;
            if (!streakState.lastActiveDate) {
                streakState.currentStreak = 1;
            } else {
                const gap = getDayGap(streakState.lastActiveDate, todayKey);
                streakState.currentStreak = gap === 1 ? streakState.currentStreak + 1 : 1;
            }

            streakState.bestStreak = Math.max(streakState.bestStreak, streakState.currentStreak);
            streakState.lastActiveDate = todayKey;
            persist();
            return { increased: streakState.currentStreak > previous };
        }

        function getState() {
            return {
                lastActiveDate: streakState.lastActiveDate,
                currentStreak: streakState.currentStreak,
                bestStreak: streakState.bestStreak
            };
        }

        function persist() {
            StorageModule.saveStreakData(streakState);
        }

        function getDayGap(fromKey, toKey) {
            const fromDate = parseDateKey(fromKey);
            const toDate = parseDateKey(toKey);
            if (!fromDate || !toDate) {
                return 999;
            }

            const diffMs = toDate.getTime() - fromDate.getTime();
            return Math.floor(diffMs / (24 * 60 * 60 * 1000));
        }

        function parseDateKey(key) {
            if (typeof key !== "string") {
                return null;
            }
            const parts = key.split("-").map(function (piece) {
                return Number(piece);
            });
            if (parts.length !== 3 || parts.some(function (n) { return !Number.isFinite(n); })) {
                return null;
            }
            return new Date(parts[0], parts[1] - 1, parts[2]);
        }

        return {
            syncOnAppLoad: syncOnAppLoad,
            registerSessionCompletion: registerSessionCompletion,
            getState: getState
        };
    })();

    /* Analytics Module: owns 7-day chart rendering metadata. */
    const AnalyticsModule = (function () {
        function getLastSevenDays() {
            return StatsModule.getWeeklySummary();
        }

        function renderWeeklyChart(days) {
            dom.weeklyChart.innerHTML = "";

            const maxSessions = Math.max(1, days.reduce(function (max, day) {
                return Math.max(max, day.sessions);
            }, 0));

            const todayKey = getDateKey(new Date());

            days.forEach(function (day, index) {
                const bar = document.createElement("div");
                bar.className = "chart-bar";
                if (day.key === todayKey) {
                    bar.classList.add("is-today");
                }

                const pill = document.createElement("div");
                pill.className = "chart-pill";
                pill.style.setProperty("--bar-delay", String(index * 0.06) + "s");

                const heightPercent = day.sessions === 0 ? 8 : Math.round((day.sessions / maxSessions) * 100);
                pill.style.height = String(heightPercent) + "%";
                pill.title = day.sessions + " sessions • " + formatMinutes(day.focusMinutes);

                const value = document.createElement("span");
                value.className = "chart-value";
                value.textContent = String(day.sessions);

                const label = document.createElement("span");
                label.className = "chart-label";
                label.textContent = day.label;

                bar.appendChild(value);
                bar.appendChild(pill);
                bar.appendChild(label);
                dom.weeklyChart.appendChild(bar);
            });
        }

        return {
            getLastSevenDays: getLastSevenDays,
            renderWeeklyChart: renderWeeklyChart
        };
    })();

    /* Tasks Module: persistent task CRUD and active-task selection. */
    const TasksModule = (function () {
        let tasks = StorageModule.loadTasks();
        let activeTaskId = null;

        function addTask(text) {
            const cleaned = String(text || "").trim();
            if (!cleaned) {
                return false;
            }

            const task = {
                id: "task-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                text: cleaned,
                completed: false
            };
            tasks.unshift(task);

            if (!activeTaskId) {
                activeTaskId = task.id;
            }

            persist();
            return true;
        }

        function toggleTask(id) {
            tasks = tasks.map(function (task) {
                return task.id === id ? { ...task, completed: !task.completed } : task;
            });
            persist();
        }

        function deleteTask(id) {
            tasks = tasks.filter(function (task) {
                return task.id !== id;
            });

            if (activeTaskId === id) {
                const next = tasks.find(function (task) {
                    return !task.completed;
                });
                activeTaskId = next ? next.id : null;
            }

            persist();
        }

        function setActiveTask(id) {
            const exists = tasks.some(function (task) {
                return task.id === id;
            });
            if (exists) {
                activeTaskId = id;
            }
        }

        function markActiveTaskComplete() {
            if (!activeTaskId) {
                return;
            }
            const activeTask = tasks.find(function (task) {
                return task.id === activeTaskId;
            });
            if (!activeTask || activeTask.completed) {
                return;
            }

            toggleTask(activeTaskId);

            const next = tasks.find(function (task) {
                return !task.completed;
            });
            activeTaskId = next ? next.id : null;
        }

        function getPromptTask() {
            if (!activeTaskId) {
                return null;
            }
            const task = tasks.find(function (item) {
                return item.id === activeTaskId;
            });
            if (!task || task.completed) {
                return null;
            }
            return task;
        }

        function getTasks() {
            return tasks.slice();
        }

        function getActiveTaskId() {
            return activeTaskId;
        }

        function initActiveTask() {
            const firstPending = tasks.find(function (task) {
                return !task.completed;
            });
            activeTaskId = firstPending ? firstPending.id : null;
        }

        function persist() {
            StorageModule.saveTasks(tasks);
        }

        return {
            addTask: addTask,
            toggleTask: toggleTask,
            deleteTask: deleteTask,
            setActiveTask: setActiveTask,
            markActiveTaskComplete: markActiveTaskComplete,
            getPromptTask: getPromptTask,
            getTasks: getTasks,
            getActiveTaskId: getActiveTaskId,
            initActiveTask: initActiveTask
        };
    })();

    /* Prompt Module: non-blocking task completion modal. */
    const PromptModule = (function () {
        let isOpen = false;
        let onConfirm = null;

        function init() {
            dom.taskCompleteYes.addEventListener("click", function () {
                closeModal(true);
            });

            dom.taskCompleteNo.addEventListener("click", function () {
                closeModal(false);
            });
        }

        function showTaskCompletionPrompt(task, confirmCallback) {
            if (!task || typeof confirmCallback !== "function") {
                return;
            }

            onConfirm = confirmCallback;
            dom.taskCompleteText.textContent = "Did you complete \"" + task.text + "\"?";
            dom.taskCompleteModal.classList.remove("hidden");
            dom.taskCompleteModal.classList.add("show");
            isOpen = true;
        }

        function closeModal(confirmed) {
            const callback = onConfirm;

            dom.taskCompleteModal.classList.remove("show");
            isOpen = false;
            onConfirm = null;

            setTimeout(function () {
                if (!isOpen) {
                    dom.taskCompleteModal.classList.add("hidden");
                }
            }, 180);

            if (confirmed && typeof callback === "function") {
                callback();
            }
        }

        function closeIfOpen() {
            if (!isOpen) {
                return false;
            }
            closeModal(false);
            return true;
        }

        return {
            init: init,
            showTaskCompletionPrompt: showTaskCompletionPrompt,
            closeIfOpen: closeIfOpen
        };
    })();

    /* Notes Module: create/edit/delete persistent sticky notes. */
    const NotesModule = (function () {
        let notes = StorageModule.loadNotes();

        function addNote() {
            const note = {
                id: "note-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
                text: "",
                createdAt: Date.now()
            };
            notes.unshift(note);
            persist();
            UIModule.renderNotes(notes);
        }

        function updateNote(id, text) {
            notes = notes.map(function (note) {
                return note.id === id ? { ...note, text: text } : note;
            });
            persist();
        }

        function deleteNote(id) {
            notes = notes.filter(function (note) {
                return note.id !== id;
            });
            persist();
            UIModule.renderNotes(notes);
        }

        function persist() {
            StorageModule.saveNotes(notes);
        }

        function getAll() {
            return notes;
        }

        return {
            addNote: addNote,
            updateNote: updateNote,
            deleteNote: deleteNote,
            getAll: getAll
        };
    })();

    /* Sound Module: builds alarm tones and centralizes playback behavior. */
    const SoundModule = (function () {
        const alarmSources = {
            bell: createToneWavDataUri(880, 720, "sine"),
            chime: createToneWavDataUri(680, 900, "triangle"),
            buzzer: createToneWavDataUri(240, 620, "square")
        };

        function playAlarm(soundOverride) {
            const soundName = typeof soundOverride === "string" ? soundOverride : appState.settings.alarmSound;
            if (!appState.settings.soundEnabled && typeof soundOverride !== "string") {
                return;
            }
            const src = alarmSources[soundName] || alarmSources.bell;
            dom.alarmAudio.src = src;
            dom.alarmAudio.currentTime = 0;
            dom.alarmAudio.play().catch(function () {
                // Ignore autoplay restrictions before user interaction.
            });
        }

        return {
            playAlarm: playAlarm
        };
    })();

    /* Music Module: local folder-based player integrated with Pomodoro modes. */
    const MusicModule = (function () {
        const playlist = [
            { name: "Focus 1", artist: "Deep Work Tones", coverClass: "cover-focus1", src: "music/music1.mp3" },
            { name: "Focus 2", artist: "Clarity Engine", coverClass: "cover-focus2", src: "music/music2.mp3" },
            { name: "Rain", artist: "Ambient Weather", coverClass: "cover-rain", src: "music/rain.mp3" }
        ];

        const musicState = {
            trackIndex: 0,
            isPlaying: false,
            userPausedInFocus: false,
            volume: 0.7,
            volumeBeforeMute: 0.7,
            isSeeking: false,
            pendingSeekPercent: null
        };

        function init() {
            dom.musicAudio.preload = "metadata";
            loadFromStorage();
            dom.musicAudio.volume = musicState.volume;
            loadTrack(musicState.trackIndex, false);

            dom.musicAudio.addEventListener("timeupdate", updateProgressUI);
            dom.musicAudio.addEventListener("loadedmetadata", updateProgressUI);
            dom.musicAudio.addEventListener("durationchange", updateProgressUI);
            dom.musicAudio.addEventListener("ended", function () {
                nextTrack(true);
            });
            dom.musicAudio.addEventListener("play", function () {
                musicState.isPlaying = true;
                renderState();
            });
            dom.musicAudio.addEventListener("pause", function () {
                musicState.isPlaying = false;
                renderState();
            });
            dom.musicAudio.addEventListener("error", function () {
                showError("Could not load this track. Check files in the music folder.");
                renderState();
            });

            updateVolumeUI();
            renderState();
        }

        function loadTrack(index, autoplay) {
            clearError();
            if (!playlist.length) {
                showError("No tracks found in playlist.");
                return;
            }

            musicState.trackIndex = (index + playlist.length) % playlist.length;
            const track = playlist[musicState.trackIndex];
            dom.musicAudio.src = track.src;
            dom.musicTrackName.textContent = track.name;
            dom.musicArtist.textContent = track.artist;
            dom.musicCover.classList.remove("cover-focus1", "cover-focus2", "cover-rain");
            dom.musicCover.classList.add(track.coverClass);
            dom.musicCurrentTime.textContent = "0:00";
            dom.musicTotalTime.textContent = "0:00";
            dom.musicProgressBar.style.width = "0%";
            dom.musicSeek.value = "0";
            updateSeekFill(0);
            musicState.pendingSeekPercent = null;
            saveToStorage();

            if (autoplay) {
                play();
            } else {
                dom.musicAudio.pause();
            }
        }

        function play() {
            clearError();
            dom.musicAudio.play().catch(function () {
                showError("Playback blocked by browser. Click play again.");
            });
        }

        function pause() {
            dom.musicAudio.pause();
        }

        function togglePlay() {
            if (musicState.isPlaying) {
                pause();
                musicState.userPausedInFocus = true;
            } else {
                play();
                musicState.userPausedInFocus = false;
            }
        }

        function nextTrack(autoplay) {
            loadTrack(musicState.trackIndex + 1, autoplay || musicState.isPlaying);
            musicState.userPausedInFocus = false;
        }

        function prevTrack() {
            loadTrack(musicState.trackIndex - 1, musicState.isPlaying);
            musicState.userPausedInFocus = false;
        }

        function onModeChange(mode) {
            if (mode === "focus") {
                if (!musicState.userPausedInFocus) {
                    play();
                }
            } else {
                pause();
            }
        }

        function updateProgressUI() {
            const duration = Number.isFinite(dom.musicAudio.duration) ? dom.musicAudio.duration : 0;
            const current = Number.isFinite(dom.musicAudio.currentTime) ? dom.musicAudio.currentTime : 0;
            const progress = duration > 0 ? (current / duration) * 100 : 0;
            const safeProgress = Math.max(0, Math.min(100, progress));

            if (musicState.pendingSeekPercent !== null && duration > 0) {
                const pendingTime = (musicState.pendingSeekPercent / 100) * duration;
                dom.musicAudio.currentTime = pendingTime;
                musicState.pendingSeekPercent = null;
            }

            dom.musicCurrentTime.textContent = formatClock(current);
            dom.musicTotalTime.textContent = formatClock(duration);
            dom.musicProgressBar.style.width = String(safeProgress) + "%";

            if (!musicState.isSeeking) {
                dom.musicSeek.value = String(safeProgress);
                updateSeekFill(safeProgress);
            }
        }

        function seekTo(percent) {
            const duration = Number.isFinite(dom.musicAudio.duration) ? dom.musicAudio.duration : 0;
            const safePercent = Math.max(0, Math.min(100, percent));

            dom.musicSeek.value = String(safePercent);
            updateSeekFill(safePercent);
            dom.musicProgressBar.style.width = String(safePercent) + "%";

            if (!duration) {
                musicState.pendingSeekPercent = safePercent;
                return;
            }

            dom.musicAudio.currentTime = (safePercent / 100) * duration;
        }

        function setVolume(value) {
            const safe = Math.max(0, Math.min(1, value));
            dom.musicAudio.volume = safe;
            musicState.volume = safe;
            if (safe > 0) {
                musicState.volumeBeforeMute = safe;
            }
            updateVolumeUI();
            saveToStorage();
        }

        function toggleMute() {
            if (dom.musicAudio.volume <= 0.001) {
                setVolume(musicState.volumeBeforeMute > 0 ? musicState.volumeBeforeMute : 0.7);
            } else {
                musicState.volumeBeforeMute = dom.musicAudio.volume;
                setVolume(0);
            }
        }

        function seekFromProgressTrack(clientX) {
            const rect = dom.musicProgressTrack.getBoundingClientRect();
            const ratio = (clientX - rect.left) / Math.max(1, rect.width);
            seekTo(ratio * 100);
        }

        function updateSeekFill(percent) {
            const safe = Math.max(0, Math.min(100, percent));
            dom.musicSeek.style.setProperty("--range-progress", String(safe) + "%");
        }

        function updateVolumeFill(volumeValue) {
            const safe = Math.max(0, Math.min(1, volumeValue));
            const percent = safe * 100;
            dom.musicVolume.style.setProperty("--range-progress", String(percent) + "%");
        }

        function updateVolumeUI() {
            dom.musicVolume.value = String(dom.musicAudio.volume);
            dom.musicVolumeText.textContent = String(Math.round(dom.musicAudio.volume * 100)) + "%";
            dom.musicMute.textContent = dom.musicAudio.volume <= 0.001 ? "🔇" : "🔊";
            updateVolumeFill(dom.musicAudio.volume);
        }

        function formatClock(seconds) {
            const safe = Math.max(0, Math.floor(seconds || 0));
            const minutes = Math.floor(safe / 60);
            const remainder = safe % 60;
            return String(minutes) + ":" + String(remainder).padStart(2, "0");
        }

        function renderState() {
            dom.musicToggle.textContent = musicState.isPlaying ? "⏸" : "▶";
            dom.musicStatus.textContent = musicState.isPlaying ? "Playing" : "Paused";
            dom.musicPanel.classList.toggle("playing", musicState.isPlaying);
        }

        function showError(message) {
            dom.musicError.textContent = message;
            dom.musicError.classList.remove("hidden");
        }

        function clearError() {
            dom.musicError.textContent = "";
            dom.musicError.classList.add("hidden");
        }

        function saveToStorage() {
            StorageModule.saveMusic({
                lastTrackIndex: musicState.trackIndex,
                lastVolume: musicState.volume
            });
        }

        function loadFromStorage() {
            const saved = StorageModule.loadMusic();
            const max = playlist.length > 0 ? playlist.length - 1 : 0;
            musicState.trackIndex = Math.max(0, Math.min(max, saved.lastTrackIndex || 0));
            musicState.volume = typeof saved.lastVolume === "number" ? saved.lastVolume : 0.7;
            musicState.volumeBeforeMute = musicState.volume > 0 ? musicState.volume : 0.7;
        }

        return {
            init: init,
            loadTrack: loadTrack,
            togglePlay: togglePlay,
            nextTrack: function () { nextTrack(false); },
            prevTrack: prevTrack,
            onModeChange: onModeChange,
            seekTo: seekTo,
            setVolume: setVolume,
            seekFromProgressTrack: seekFromProgressTrack,
            setSeeking: function (value) {
                musicState.isSeeking = Boolean(value);
            },
            toggleMute: toggleMute,
            saveToStorage: saveToStorage
        };
    })();

    /* Calendar Module: builds month view and supports day-level stat drilldown. */
    const CalendarModule = (function () {
        function renderCalendar() {
            const month = appState.viewMonth.getMonth();
            const year = appState.viewMonth.getFullYear();
            dom.monthYear.textContent = appState.viewMonth.toLocaleDateString(undefined, {
                month: "long",
                year: "numeric"
            });

            dom.calendarGrid.querySelectorAll(".day").forEach(function (el) {
                el.remove();
            });

            const firstDayIndex = new Date(year, month, 1).getDay();
            const totalDays = new Date(year, month + 1, 0).getDate();

            for (let i = 0; i < firstDayIndex; i += 1) {
                const empty = document.createElement("div");
                empty.className = "day empty";
                dom.calendarGrid.appendChild(empty);
            }

            for (let day = 1; day <= totalDays; day += 1) {
                const date = new Date(year, month, day);
                const dayKey = getDateKey(date);
                const stats = StatsModule.getDay(dayKey);
                const dayEl = document.createElement("button");
                dayEl.type = "button";
                dayEl.className = "day";
                dayEl.innerHTML = "<span>" + day + "</span>";

                if (stats.sessions > 0) {
                    dayEl.classList.add("completed");
                    const count = document.createElement("span");
                    count.className = "day-count";
                    count.textContent = stats.sessions + "x";
                    dayEl.appendChild(count);
                }

                if (appState.selectedDateKey === dayKey) {
                    dayEl.classList.add("selected");
                }

                dayEl.addEventListener("click", function () {
                    appState.selectedDateKey = dayKey;
                    renderSelectedDate(dayKey);
                    renderCalendar();
                });
                dom.calendarGrid.appendChild(dayEl);
            }
        }

        function renderSelectedDate(dayKey) {
            const stats = StatsModule.getDay(dayKey);
            const dateParts = dayKey.split("-").map(function (piece) {
                return Number(piece);
            });
            const date = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            dom.selectedDateTitle.textContent = date.toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric"
            });
            dom.selectedDateSessions.textContent = String(stats.sessions);
            dom.selectedDateTime.textContent = formatMinutes(stats.focusMinutes);
            dom.selectedDateStats.classList.remove("hidden");
        }

        function nextMonth() {
            appState.viewMonth = new Date(appState.viewMonth.getFullYear(), appState.viewMonth.getMonth() + 1, 1);
            renderCalendar();
        }

        function prevMonth() {
            appState.viewMonth = new Date(appState.viewMonth.getFullYear(), appState.viewMonth.getMonth() - 1, 1);
            renderCalendar();
        }

        return {
            renderCalendar: renderCalendar,
            renderSelectedDate: renderSelectedDate,
            nextMonth: nextMonth,
            prevMonth: prevMonth
        };
    })();

    /* UI Module: all DOM rendering and visual updates live here. */
    const UIModule = (function () {
        const ringState = {
            circumference: 0
        };
        let lastModeRendered = null;

        function init() {
            setupProgressRing();
            renderSettingsForm();
            applyTheme(appState.settings.theme);
            renderInsightsQuote();
            renderNotes(NotesModule.getAll());
            renderTasks(TasksModule.getTasks(), TasksModule.getActiveTaskId());
            renderStats();
            renderStreak(false);
            CalendarModule.renderCalendar();
        }

        function setupProgressRing() {
            const radius = dom.progressCircle.r.baseVal.value;
            ringState.circumference = 2 * Math.PI * radius;
            dom.progressCircle.style.strokeDasharray = String(ringState.circumference);
            dom.progressCircle.style.strokeDashoffset = "0";
        }

        function renderTimer(state) {
            dom.time.textContent = formatTime(state.remainingMs);
            dom.currentModeLabel.textContent = MODE_LABELS[state.mode];
            dom.startPauseBtn.textContent = state.isRunning ? "Pause" : "Start";
            dom.currentSessionCount.textContent = String(state.focusStreak % appState.settings.sessionsBeforeLong);
            dom.sessionsBeforeLong.textContent = String(appState.settings.sessionsBeforeLong);
            dom.timerPanel.classList.toggle("running", state.isRunning);
            dom.body.classList.remove("mode-focus", "mode-shortBreak", "mode-longBreak");
            dom.body.classList.add("mode-" + state.mode);
            updateRingGradient(state.mode);

            if (state.mode !== lastModeRendered) {
                const modeQuote = state.mode === "focus"
                    ? "Ship one focused block right now."
                    : BREAK_QUOTES[Math.floor(Math.random() * BREAK_QUOTES.length)];
                dom.quote.textContent = modeQuote;
                lastModeRendered = state.mode;
            }

            dom.modeButtons.forEach(function (button) {
                button.classList.toggle("active", button.dataset.mode === state.mode);
            });

            const durationMs = TimerModule.getModeDurationMs(state.mode);
            const progress = Math.max(0, Math.min(1, state.remainingMs / Math.max(durationMs, 1)));
            const offset = ringState.circumference * (1 - progress);
            dom.progressCircle.style.strokeDashoffset = String(offset);
            document.title = dom.time.textContent + " • " + MODE_LABELS[state.mode];
        }

        function updateRingGradient(mode) {
            let startColor = "#ff8f85";
            let endColor = "#ff4f63";

            if (mode === "shortBreak") {
                startColor = "#4bd6b8";
                endColor = "#54bbde";
            }

            if (mode === "longBreak") {
                startColor = "#78c0ff";
                endColor = "#5f8dff";
            }

            dom.ringStopStart.setAttribute("stop-color", startColor);
            dom.ringStopEnd.setAttribute("stop-color", endColor);
        }

        function renderSettingsForm() {
            dom.focusDurationInput.value = String(appState.settings.focusMinutes);
            dom.shortBreakDurationInput.value = String(appState.settings.shortBreakMinutes);
            dom.longBreakDurationInput.value = String(appState.settings.longBreakMinutes);
            dom.sessionsCountInput.value = String(appState.settings.sessionsBeforeLong);
            dom.soundToggleInput.checked = appState.settings.soundEnabled;
            dom.themeSettingToggle.checked = appState.settings.theme === "light";
            dom.alarmSoundSelect.value = appState.settings.alarmSound;
        }

        function renderNotes(notes) {
            dom.notesList.innerHTML = "";
            if (notes.length === 0) {
                const empty = document.createElement("p");
                empty.className = "muted";
                empty.textContent = "No notes yet. Add one for ideas or tasks.";
                dom.notesList.appendChild(empty);
                return;
            }

            notes.forEach(function (note) {
                const card = document.createElement("article");
                card.className = "note-item";
                card.dataset.noteId = note.id;

                const input = document.createElement("textarea");
                input.className = "note-input";
                input.value = note.text;
                input.placeholder = "Type your note...";
                input.addEventListener("input", function () {
                    NotesModule.updateNote(note.id, input.value);
                });

                const actions = document.createElement("div");
                actions.className = "note-actions";

                const deleteBtn = document.createElement("button");
                deleteBtn.className = "small-btn";
                deleteBtn.type = "button";
                deleteBtn.textContent = "Delete";
                deleteBtn.addEventListener("click", function () {
                    NotesModule.deleteNote(note.id);
                });

                actions.appendChild(deleteBtn);
                card.appendChild(input);
                card.appendChild(actions);
                dom.notesList.appendChild(card);
            });
        }

        function renderStats() {
            const today = StatsModule.getToday();
            const totalFocusMinutes = StatsModule.getTotalFocusMinutes();
            const weekly = AnalyticsModule.getLastSevenDays();
            const weeklySessions = weekly.reduce(function (sum, day) {
                return sum + day.sessions;
            }, 0);

            dom.todaySessions.textContent = String(today.sessions);
            dom.weeklySessions.textContent = String(weeklySessions);
            dom.totalFocusTime.textContent = formatHoursMinutes(totalFocusMinutes);
            AnalyticsModule.renderWeeklyChart(weekly);
        }

        function renderStreak(animateIncrease) {
            const streak = StreakModule.getState();
            dom.currentStreak.textContent = String(streak.currentStreak);
            dom.bestStreak.textContent = String(streak.bestStreak);

            if (animateIncrease) {
                dom.currentStreak.classList.remove("streak-pop");
                dom.bestStreak.classList.remove("streak-pop");
                void dom.currentStreak.offsetWidth;
                dom.currentStreak.classList.add("streak-pop");
                dom.bestStreak.classList.add("streak-pop");
            }
        }

        function renderTasks(tasks, activeTaskId) {
            dom.taskList.innerHTML = "";

            if (!tasks.length) {
                const empty = document.createElement("p");
                empty.className = "muted";
                empty.textContent = "No tasks yet. Add one before your next focus sprint.";
                dom.taskList.appendChild(empty);
                return;
            }

            tasks.forEach(function (task) {
                const row = document.createElement("article");
                row.className = "task-item";
                if (task.completed) {
                    row.classList.add("completed");
                }
                if (task.id === activeTaskId) {
                    row.classList.add("active");
                }

                const check = document.createElement("input");
                check.type = "checkbox";
                check.checked = task.completed;
                check.className = "task-check";
                check.dataset.taskId = task.id;
                check.setAttribute("aria-label", "Mark task complete");

                const textBtn = document.createElement("button");
                textBtn.type = "button";
                textBtn.className = "task-text-btn";
                textBtn.textContent = task.text;
                textBtn.dataset.taskId = task.id;

                const deleteBtn = document.createElement("button");
                deleteBtn.type = "button";
                deleteBtn.className = "small-btn task-delete-btn";
                deleteBtn.dataset.taskDeleteId = task.id;
                deleteBtn.textContent = "Delete";

                row.appendChild(check);
                row.appendChild(textBtn);
                row.appendChild(deleteBtn);
                dom.taskList.appendChild(row);
            });
        }

        function renderInsightsQuote() {
            dom.insightQuote.textContent = INSIGHT_QUOTES[Math.floor(Math.random() * INSIGHT_QUOTES.length)];
        }

        function applyTheme(theme) {
            const normalized = theme === "light" ? "light" : "dark";
            document.documentElement.dataset.theme = normalized;
            appState.settings.theme = normalized;
            dom.themeToggle.textContent = normalized === "dark" ? "Light Mode" : "Dark Mode";
            StorageModule.saveSettings(appState.settings);
        }

        return {
            init: init,
            renderTimer: renderTimer,
            renderSettingsForm: renderSettingsForm,
            renderNotes: renderNotes,
            renderStats: renderStats,
            renderStreak: renderStreak,
            renderTasks: renderTasks,
            renderInsightsQuote: renderInsightsQuote,
            applyTheme: applyTheme
        };
    })();

    /* Timer Module: drift-resistant timing with Date.now persistence. */
    const TimerModule = (function () {
        const state = {
            mode: "focus",
            isRunning: false,
            remainingMs: appState.settings.focusMinutes * 60 * 1000,
            endTimestamp: null,
            focusStreak: 0,
            ticker: null,
            lastPersistSecond: null
        };

        function init() {
            restore();
            UIModule.renderTimer(state);
            MusicModule.onModeChange(state.mode);
        }

        function startPauseToggle() {
            if (state.isRunning) {
                pause();
            } else {
                start();
            }
        }

        function start() {
            if (state.remainingMs <= 0) {
                state.remainingMs = getModeDurationMs(state.mode);
            }
            state.isRunning = true;
            state.endTimestamp = Date.now() + state.remainingMs;
            state.lastPersistSecond = null;
            startTicker();
            persist();
            UIModule.renderTimer(state);
        }

        function pause() {
            if (!state.isRunning) {
                return;
            }
            state.remainingMs = Math.max(0, state.endTimestamp - Date.now());
            state.isRunning = false;
            state.endTimestamp = null;
            stopTicker();
            persist();
            UIModule.renderTimer(state);
        }

        function reset() {
            state.isRunning = false;
            state.endTimestamp = null;
            state.remainingMs = getModeDurationMs(state.mode);
            stopTicker();
            persist();
            UIModule.renderTimer(state);
        }

        function switchMode(mode, isManual) {
            if (!MODE_LABELS[mode]) {
                return;
            }
            state.mode = mode;
            state.isRunning = false;
            state.endTimestamp = null;
            state.remainingMs = getModeDurationMs(mode);
            stopTicker();
            if (isManual) {
                SoundModule.playAlarm(appState.settings.alarmSound);
            }
            MusicModule.onModeChange(state.mode);
            persist();
            UIModule.renderTimer(state);
        }

        function completeSession() {
            if (state.mode === "focus") {
                state.focusStreak += 1;
                StatsModule.recordFocus(appState.settings.focusMinutes, new Date());

                const streakResult = StreakModule.registerSessionCompletion(new Date());
                if (streakResult.increased) {
                    UIModule.renderStreak(true);
                }

                const promptTask = TasksModule.getPromptTask();
                if (promptTask) {
                    PromptModule.showTaskCompletionPrompt(promptTask, function () {
                        TasksModule.markActiveTaskComplete();
                        UIModule.renderTasks(TasksModule.getTasks(), TasksModule.getActiveTaskId());
                    });
                }
            }

            SoundModule.playAlarm(appState.settings.alarmSound);

            const nextMode = getNextMode();
            state.mode = nextMode;
            state.remainingMs = getModeDurationMs(nextMode);
            state.isRunning = false;
            state.endTimestamp = null;

            setTimeout(function () {
                SoundModule.playAlarm(appState.settings.alarmSound);
            }, 160);

            MusicModule.onModeChange(state.mode);
            UIModule.renderStats();
            UIModule.renderStreak(false);
            CalendarModule.renderCalendar();
            UIModule.renderInsightsQuote();
            persist();
            UIModule.renderTimer(state);
        }

        function getNextMode() {
            if (state.mode === "focus") {
                return state.focusStreak % appState.settings.sessionsBeforeLong === 0 ? "longBreak" : "shortBreak";
            }
            return "focus";
        }

        function startTicker() {
            stopTicker();
            state.ticker = setInterval(tick, 200);
            tick();
        }

        function stopTicker() {
            if (state.ticker) {
                clearInterval(state.ticker);
                state.ticker = null;
            }
        }

        function tick() {
            if (!state.isRunning || !state.endTimestamp) {
                return;
            }
            const now = Date.now();
            const remaining = state.endTimestamp - now;
            if (remaining <= 0) {
                state.remainingMs = 0;
                state.isRunning = false;
                state.endTimestamp = null;
                stopTicker();
                completeSession();
                return;
            }
            state.remainingMs = remaining;
            UIModule.renderTimer(state);

            const second = Math.ceil(remaining / 1000);
            if (second !== state.lastPersistSecond) {
                state.lastPersistSecond = second;
                persist();
            }
        }

        function persist() {
            StorageModule.saveTimerState({
                mode: state.mode,
                isRunning: state.isRunning,
                remainingMs: Math.round(state.remainingMs),
                endTimestamp: state.isRunning ? state.endTimestamp : null,
                focusStreak: state.focusStreak
            });
        }

        function restore() {
            const saved = StorageModule.loadTimerState();
            if (!saved || typeof saved !== "object" || !MODE_LABELS[saved.mode]) {
                state.mode = "focus";
                state.remainingMs = getModeDurationMs("focus");
                return;
            }

            state.mode = saved.mode;
            state.focusStreak = Number.isFinite(saved.focusStreak) ? Math.max(0, saved.focusStreak) : 0;

            if (saved.isRunning && Number.isFinite(saved.endTimestamp)) {
                const remaining = saved.endTimestamp - Date.now();
                if (remaining > 0) {
                    state.remainingMs = remaining;
                    state.endTimestamp = saved.endTimestamp;
                    state.isRunning = true;
                    startTicker();
                    return;
                }

                state.remainingMs = 0;
                state.isRunning = false;
                state.endTimestamp = null;
                completeSession();
                return;
            }

            state.remainingMs = Number.isFinite(saved.remainingMs)
                ? Math.max(0, saved.remainingMs)
                : getModeDurationMs(saved.mode);
            state.isRunning = false;
            state.endTimestamp = null;
        }

        function getModeDurationMs(mode) {
            if (mode === "shortBreak") {
                return appState.settings.shortBreakMinutes * 60 * 1000;
            }
            if (mode === "longBreak") {
                return appState.settings.longBreakMinutes * 60 * 1000;
            }
            return appState.settings.focusMinutes * 60 * 1000;
        }

        function syncWithUpdatedSettings() {
            if (!state.isRunning) {
                state.remainingMs = getModeDurationMs(state.mode);
                UIModule.renderTimer(state);
                persist();
            }
        }

        function getState() {
            return state;
        }

        return {
            init: init,
            startPauseToggle: startPauseToggle,
            reset: reset,
            switchMode: switchMode,
            getModeDurationMs: getModeDurationMs,
            syncWithUpdatedSettings: syncWithUpdatedSettings,
            getState: getState,
            persist: persist,
            tick: tick
        };
    })();

    function bindEvents() {
        let settingsStatusTimer = null;

        function setSettingsStatus(message, isError) {
            if (!dom.settingsStatus) {
                return;
            }
            dom.settingsStatus.textContent = message;
            dom.settingsStatus.style.color = isError ? "#ff8e95" : "";
            if (settingsStatusTimer) {
                clearTimeout(settingsStatusTimer);
            }
            if (message) {
                settingsStatusTimer = setTimeout(function () {
                    dom.settingsStatus.textContent = "";
                    dom.settingsStatus.style.color = "";
                }, 2400);
            }
        }

        function normalizeNumberInput(inputEl, min, max, fallbackValue) {
            const value = clampInt(inputEl.value, min, max, fallbackValue);
            inputEl.value = String(value);
            return value;
        }

        function applySettingsFromForm() {
            appState.settings.focusMinutes = normalizeNumberInput(dom.focusDurationInput, 1, 120, appState.settings.focusMinutes);
            appState.settings.shortBreakMinutes = normalizeNumberInput(dom.shortBreakDurationInput, 1, 60, appState.settings.shortBreakMinutes);
            appState.settings.longBreakMinutes = normalizeNumberInput(dom.longBreakDurationInput, 1, 120, appState.settings.longBreakMinutes);
            appState.settings.sessionsBeforeLong = normalizeNumberInput(dom.sessionsCountInput, 1, 12, appState.settings.sessionsBeforeLong);
            appState.settings.soundEnabled = dom.soundToggleInput.checked;
            appState.settings.theme = "light";
            appState.settings.alarmSound = ["bell", "chime", "buzzer"].includes(dom.alarmSoundSelect.value)
                ? dom.alarmSoundSelect.value
                : appState.settings.alarmSound;

            StorageModule.saveSettings(appState.settings);
            UIModule.applyTheme("light");
            TimerModule.syncWithUpdatedSettings();
            UIModule.renderSettingsForm();
            UIModule.renderTimer(TimerModule.getState());
            setSettingsStatus("Settings saved", false);
        }

        dom.startPauseBtn.addEventListener("click", TimerModule.startPauseToggle);
        dom.resetBtn.addEventListener("click", TimerModule.reset);

        dom.loginBtn.addEventListener("click", function () {
            const credentials = window.AppUI.getAuthCredentials();
            if (!credentials.email || !credentials.password) {
                window.AppUI.setAuthStatus("Enter email and password", true);
                return;
            }
            window.AuthModule.login(credentials.email, credentials.password);
        });

        dom.signupBtn.addEventListener("click", function () {
            const credentials = window.AppUI.getAuthCredentials();
            if (!credentials.email || !credentials.password) {
                window.AppUI.setAuthStatus("Enter email and password", true);
                return;
            }
            window.AuthModule.signup(credentials.email, credentials.password);
        });

        dom.logoutBtn.addEventListener("click", function () {
            window.AuthModule.logout();
        });

        dom.modeButtons.forEach(function (btn) {
            btn.addEventListener("click", function () {
                TimerModule.switchMode(btn.dataset.mode, true);
            });
        });

        /* theme toggle removed */

        dom.fullscreenBtn.addEventListener("click", function () {
            appState.isFocusFullscreen = !appState.isFocusFullscreen;
            dom.body.classList.toggle("focus-fullscreen", appState.isFocusFullscreen);
            dom.fullscreenBtn.textContent = appState.isFocusFullscreen ? "Exit Focus" : "Fullscreen";
        });

        dom.saveSettingsBtn.addEventListener("click", function () {
            applySettingsFromForm();
        });

        [dom.focusDurationInput, dom.shortBreakDurationInput, dom.longBreakDurationInput, dom.sessionsCountInput].forEach(function (inputEl) {
            inputEl.addEventListener("blur", function () {
                normalizeNumberInput(
                    inputEl,
                    Number(inputEl.min || 1),
                    Number(inputEl.max || 120),
                    Number(inputEl.defaultValue || 1)
                );
            });
        });

        [dom.focusDurationInput, dom.shortBreakDurationInput, dom.longBreakDurationInput, dom.sessionsCountInput].forEach(function (inputEl) {
            inputEl.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    applySettingsFromForm();
                }
            });
        });

        dom.soundToggleInput.addEventListener("change", function () {
            appState.settings.soundEnabled = dom.soundToggleInput.checked;
            StorageModule.saveSettings(appState.settings);
            setSettingsStatus("Sound setting saved", false);
        });

        /* theme setting removed */

        dom.alarmSoundSelect.addEventListener("change", function () {
            appState.settings.alarmSound = ["bell", "chime", "buzzer"].includes(dom.alarmSoundSelect.value)
                ? dom.alarmSoundSelect.value
                : appState.settings.alarmSound;
            StorageModule.saveSettings(appState.settings);
            setSettingsStatus("Alarm sound saved", false);
        });

        dom.testSoundBtn.addEventListener("click", function () {
            SoundModule.playAlarm(dom.alarmSoundSelect.value);
        });

        dom.prevMonthBtn.addEventListener("click", CalendarModule.prevMonth);
        dom.nextMonthBtn.addEventListener("click", CalendarModule.nextMonth);

        dom.addNoteBtn.addEventListener("click", NotesModule.addNote);

        dom.taskForm.addEventListener("submit", function (event) {
            event.preventDefault();
            const added = TasksModule.addTask(dom.taskInput.value);
            if (added) {
                dom.taskInput.value = "";
                UIModule.renderTasks(TasksModule.getTasks(), TasksModule.getActiveTaskId());
            }
        });

        dom.taskList.addEventListener("click", function (event) {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const deleteId = target.dataset.taskDeleteId;
            if (deleteId) {
                TasksModule.deleteTask(deleteId);
                UIModule.renderTasks(TasksModule.getTasks(), TasksModule.getActiveTaskId());
                return;
            }

            const selectId = target.dataset.taskId;
            if (selectId && target.classList.contains("task-text-btn")) {
                TasksModule.setActiveTask(selectId);
                UIModule.renderTasks(TasksModule.getTasks(), TasksModule.getActiveTaskId());
            }
        });

        dom.taskList.addEventListener("change", function (event) {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) {
                return;
            }
            if (target.classList.contains("task-check") && target.dataset.taskId) {
                TasksModule.toggleTask(target.dataset.taskId);
                UIModule.renderTasks(TasksModule.getTasks(), TasksModule.getActiveTaskId());
            }
        });

        dom.musicToggle.addEventListener("click", function () {
            MusicModule.togglePlay();
        });

        dom.musicNext.addEventListener("click", function () {
            MusicModule.nextTrack();
        });

        dom.musicPrev.addEventListener("click", function () {
            MusicModule.prevTrack();
        });

        dom.musicSeek.addEventListener("input", function () {
            MusicModule.setSeeking(true);
            MusicModule.seekTo(Number(dom.musicSeek.value));
        });

        dom.musicSeek.addEventListener("change", function () {
            MusicModule.seekTo(Number(dom.musicSeek.value));
            MusicModule.setSeeking(false);
        });

        ["pointerup", "mouseup", "touchend", "keyup"].forEach(function (eventName) {
            dom.musicSeek.addEventListener(eventName, function () {
                MusicModule.setSeeking(false);
            });
        });

        dom.musicProgressTrack.addEventListener("click", function (event) {
            MusicModule.seekFromProgressTrack(event.clientX);
        });

        dom.musicVolume.addEventListener("input", function () {
            MusicModule.setVolume(Number(dom.musicVolume.value));
        });

        dom.musicVolume.addEventListener("change", function () {
            MusicModule.setVolume(Number(dom.musicVolume.value));
        });

        dom.musicMute.addEventListener("click", function () {
            MusicModule.toggleMute();
        });

        document.addEventListener("keydown", function (event) {
            const target = event.target;
            const inInput = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
            if (event.key === "Escape") {
                if (PromptModule.closeIfOpen()) {
                    return;
                }
                if (appState.isFocusFullscreen) {
                    appState.isFocusFullscreen = false;
                    dom.body.classList.remove("focus-fullscreen");
                    dom.fullscreenBtn.textContent = "Fullscreen";
                }
            }
            if (event.code === "Space" && !inInput) {
                event.preventDefault();
                TimerModule.startPauseToggle();
            }
        });

        document.addEventListener("visibilitychange", function () {
            if (!document.hidden) {
                TimerModule.tick();
            }
        });

        window.addEventListener("beforeunload", function () {
            TimerModule.persist();
        });
    }

    function init() {
        StreakModule.syncOnAppLoad();
        TasksModule.initActiveTask();
        PromptModule.init();
        UIModule.init();
        TimerModule.init();
        enableRippleButtons();
        MusicModule.init();
        UIModule.renderStats();
        UIModule.renderStreak(false);
        UIModule.renderTasks(TasksModule.getTasks(), TasksModule.getActiveTaskId());
        CalendarModule.renderCalendar();
    }

    let appInitialized = false;

    async function bootstrapAuthenticatedApp(user) {
        appState.currentUserId = user.id;
        await StorageModule.hydrateFromCloud(user.id);
        window.AppUI.showDashboard();

        const setupWarning = window.AppDB.getSetupWarning ? window.AppDB.getSetupWarning() : "";
        if (setupWarning) {
            window.AppUI.setAuthStatus(setupWarning, true);
        }

        if (!appInitialized) {
            init();
            appInitialized = true;
            return;
        }

        UIModule.renderSettingsForm();
        UIModule.renderStats();
        UIModule.renderStreak(false);
        UIModule.renderTasks(TasksModule.getTasks(), TasksModule.getActiveTaskId());
        UIModule.renderTimer(TimerModule.getState());
        CalendarModule.renderCalendar();
    }

    function bootstrapLoggedOutState() {
        appState.currentUserId = null;
        window.AppUI.clearAuthForm();
        window.AppUI.showAuthScreen();
    }

    async function startAuthFlow() {
        await window.AuthModule.init({
            onSignedIn: function (user) {
                bootstrapAuthenticatedApp(user).catch(function (error) {
                    const message = error && error.message
                        ? error.message
                        : "Could not load cloud data. Check Supabase setup.";
                    console.error("[App] Cloud bootstrap failed:", error);
                    window.AppUI.setAuthStatus(message, true);
                    bootstrapLoggedOutState();
                });
            },
            onSignedOut: function () {
                bootstrapLoggedOutState();
            },
            onMessage: function (message, isError) {
                window.AppUI.setAuthStatus(message, isError);
            }
        });
    }

    function enableRippleButtons() {
        const buttons = document.querySelectorAll("button");
        buttons.forEach(function (button) {
            button.classList.add("ripple-host");
            button.addEventListener("click", function (event) {
                const rect = button.getBoundingClientRect();
                const dot = document.createElement("span");
                dot.className = "ripple-dot";
                dot.style.left = String(event.clientX - rect.left) + "px";
                dot.style.top = String(event.clientY - rect.top) + "px";
                button.appendChild(dot);
                setTimeout(function () {
                    dot.remove();
                }, 500);
            });
        });
    }

    function getDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return year + "-" + month + "-" + day;
    }

    function formatTime(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
    }

    function formatHoursMinutes(totalMinutes) {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        return hours + "h " + minutes + "m";
    }

    function formatMinutes(totalMinutes) {
        if (totalMinutes >= 60) {
            return formatHoursMinutes(totalMinutes);
        }
        return totalMinutes + "m";
    }

    function clampInt(value, min, max, fallback) {
        const n = Number.parseInt(value, 10);
        if (!Number.isFinite(n)) {
            return fallback;
        }
        return Math.max(min, Math.min(max, n));
    }

    function createToneWavDataUri(freq, durationMs, waveType) {
        return createLayeredWavDataUri([{ freq: freq, amp: 0.45, wave: waveType }], durationMs / 1000);
    }

    function createLayeredWavDataUri(tones, durationSeconds) {
        const sampleRate = 22050;
        const channels = 1;
        const bitsPerSample = 16;
        const numSamples = Math.floor(sampleRate * durationSeconds);
        const blockAlign = (channels * bitsPerSample) / 8;
        const byteRate = sampleRate * blockAlign;
        const dataSize = numSamples * blockAlign;
        const buffer = new ArrayBuffer(44 + dataSize);
        const view = new DataView(buffer);

        writeAscii(view, 0, "RIFF");
        view.setUint32(4, 36 + dataSize, true);
        writeAscii(view, 8, "WAVE");
        writeAscii(view, 12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeAscii(view, 36, "data");
        view.setUint32(40, dataSize, true);

        const attack = Math.floor(sampleRate * 0.05);
        const release = Math.floor(sampleRate * 0.2);

        for (let i = 0; i < numSamples; i += 1) {
            const t = i / sampleRate;
            let sample = 0;
            for (let j = 0; j < tones.length; j += 1) {
                const tone = tones[j];
                sample += oscillator(tone.wave, tone.freq, t) * tone.amp;
            }
            sample = sample / tones.length;

            let env = 1;
            if (i < attack) {
                env = i / attack;
            }
            if (i > numSamples - release) {
                env = Math.max(0, (numSamples - i) / release);
            }

            const pcm = Math.max(-1, Math.min(1, sample * env));
            view.setInt16(44 + i * 2, pcm * 32767, true);
        }

        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i += 1) {
            binary += String.fromCharCode(bytes[i]);
        }
        return "data:audio/wav;base64," + btoa(binary);
    }

    function oscillator(type, freq, time) {
        const x = 2 * Math.PI * freq * time;
        if (type === "square") {
            return Math.sign(Math.sin(x));
        }
        if (type === "triangle") {
            return (2 / Math.PI) * Math.asin(Math.sin(x));
        }
        return Math.sin(x);
    }

    function writeAscii(view, offset, text) {
        for (let i = 0; i < text.length; i += 1) {
            view.setUint8(offset + i, text.charCodeAt(i));
        }
    }

    bindEvents();
    startAuthFlow();
})();
