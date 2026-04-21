(function () {
    "use strict";

    const DEFAULT_CONFIG = {
        supabaseUrl: "https://mnjetleqnbiujwedwxzl.supabase.co",
        supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uamV0bGVxbmJpdWp3ZWR3eHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3NTI5NTgsImV4cCI6MjA5MjMyODk1OH0.RrYzX0dGx6TmUo_GVJN3E_rKsame6H-gzXSfxeYZ5NQ"
    };

    const config = window.__SUPABASE_CONFIG && typeof window.__SUPABASE_CONFIG === "object"
        ? {
            supabaseUrl: window.__SUPABASE_CONFIG.supabaseUrl || DEFAULT_CONFIG.supabaseUrl,
            supabaseAnonKey: window.__SUPABASE_CONFIG.supabaseAnonKey || DEFAULT_CONFIG.supabaseAnonKey
        }
        : DEFAULT_CONFIG;

    function looksLikeSupabaseUrl(url) {
        return typeof url === "string"
            && /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url.trim());
    }

    function looksLikeAnonKey(key) {
        return typeof key === "string" && key.trim().split(".").length === 3;
    }

    function getConfigValidationError() {
        if (!window.supabase || typeof window.supabase.createClient !== "function") {
            return "Supabase CDN not loaded. Verify script src is https://cdn.jsdelivr.net/npm/@supabase/supabase-js";
        }

        if (!looksLikeSupabaseUrl(config.supabaseUrl)) {
            return "Invalid Supabase URL. Expected format: https://<project-ref>.supabase.co";
        }

        if (!looksLikeAnonKey(config.supabaseAnonKey)) {
            return "Invalid Supabase anon key. Use the public anon key from Supabase project settings.";
        }

        return null;
    }

    const configValidationError = getConfigValidationError();
    const client = configValidationError
        ? null
        : window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

    async function checkConnection() {
        if (!client) {
            return {
                ok: false,
                message: configValidationError
            };
        }

        try {
            const result = await client.auth.getSession();
            if (result.error) {
                console.error("[Supabase] Session probe failed:", result.error);
                return {
                    ok: false,
                    message: result.error.message || "Supabase session probe failed"
                };
            }

            return { ok: true, message: "Supabase connection looks healthy" };
        } catch (error) {
            console.error("[Supabase] Network error during session probe:", error);
            const message = error && error.message ? error.message : "Failed to fetch";
            return {
                ok: false,
                message: message === "Failed to fetch"
                    ? "Network error: unable to reach Supabase. Check internet, project URL, anon key, and browser blockers."
                    : message
            };
        }
    }

    function isConfigured() {
        return !configValidationError
            && !config.supabaseUrl.includes("YOUR_PROJECT_ID")
            && !config.supabaseAnonKey.includes("YOUR_SUPABASE_ANON_KEY");
    }

    async function ensureStatsRow(userId) {
        const payload = {
            user_id: userId,
            total_sessions: 0,
            total_focus_minutes: 0,
            daily_stats: {},
            streak: {
                lastActiveDate: null,
                currentStreak: 0,
                bestStreak: 0
            },
            settings: {},
            timer_state: null,
            notes: [],
            music: {
                lastTrackIndex: 0,
                lastVolume: 0.7
            }
        };

        const { error } = await client
            .from("user_stats")
            .upsert(payload, { onConflict: "user_id", ignoreDuplicates: true });

        if (error) {
            throw error;
        }
    }

    async function loadUserBundle(userId) {
        await ensureStatsRow(userId);

        const statsResult = await client
            .from("user_stats")
            .select("settings, timer_state, daily_stats, streak, notes, music")
            .eq("user_id", userId)
            .single();

        if (statsResult.error) {
            throw statsResult.error;
        }

        const tasksResult = await client
            .from("tasks")
            .select("id, text, completed")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });

        if (tasksResult.error) {
            throw tasksResult.error;
        }

        return {
            settings: statsResult.data && typeof statsResult.data.settings === "object" ? statsResult.data.settings : {},
            timerState: statsResult.data ? statsResult.data.timer_state : null,
            stats: {
                daily: statsResult.data && typeof statsResult.data.daily_stats === "object" ? statsResult.data.daily_stats : {}
            },
            streakData: statsResult.data && typeof statsResult.data.streak === "object"
                ? statsResult.data.streak
                : { lastActiveDate: null, currentStreak: 0, bestStreak: 0 },
            notes: Array.isArray(statsResult.data && statsResult.data.notes) ? statsResult.data.notes : [],
            music: statsResult.data && typeof statsResult.data.music === "object"
                ? statsResult.data.music
                : { lastTrackIndex: 0, lastVolume: 0.7 },
            tasks: Array.isArray(tasksResult.data) ? tasksResult.data : []
        };
    }

    async function updateStatsBlob(userId, patch) {
        const payload = { ...patch, updated_at: new Date().toISOString() };
        const { error } = await client
            .from("user_stats")
            .update(payload)
            .eq("user_id", userId);

        if (error) {
            throw error;
        }
    }

    async function replaceTasks(userId, tasks) {
        const delResult = await client
            .from("tasks")
            .delete()
            .eq("user_id", userId);

        if (delResult.error) {
            throw delResult.error;
        }

        if (!tasks.length) {
            return;
        }

        const rows = tasks.map(function (task) {
            return {
                id: task.id,
                user_id: userId,
                text: task.text,
                completed: Boolean(task.completed)
            };
        });

        const insResult = await client
            .from("tasks")
            .insert(rows);

        if (insResult.error) {
            throw insResult.error;
        }
    }

    window.AppDB = {
        client: client,
        config: {
            supabaseUrl: config.supabaseUrl,
            hasAnonKey: Boolean(config.supabaseAnonKey)
        },
        isConfigured: isConfigured,
        configValidationError: configValidationError,
        checkConnection: checkConnection,
        loadUserBundle: loadUserBundle,
        saveSettings: function (userId, settings) {
            return updateStatsBlob(userId, { settings: settings });
        },
        saveTimerState: function (userId, timerState) {
            return updateStatsBlob(userId, { timer_state: timerState });
        },
        saveStats: function (userId, stats) {
            return updateStatsBlob(userId, {
                daily_stats: stats.daily || {},
                total_sessions: Object.values(stats.daily || {}).reduce(function (sum, day) {
                    return sum + (day.sessions || 0);
                }, 0),
                total_focus_minutes: Object.values(stats.daily || {}).reduce(function (sum, day) {
                    return sum + (day.focusMinutes || 0);
                }, 0)
            });
        },
        saveStreakData: function (userId, streakData) {
            return updateStatsBlob(userId, { streak: streakData });
        },
        saveNotes: function (userId, notes) {
            return updateStatsBlob(userId, { notes: notes });
        },
        saveMusic: function (userId, music) {
            return updateStatsBlob(userId, { music: music });
        },
        saveTasks: function (userId, tasks) {
            return replaceTasks(userId, tasks);
        }
    };
})();
