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
    let setupWarning = "";

    function clearSetupWarning() {
        setupWarning = "";
    }

    function setSetupWarning(message) {
        setupWarning = message;
        console.warn("[Supabase] Setup warning:", message);
    }

    function getDefaultBundle() {
        return {
            settings: {},
            timerState: null,
            stats: { daily: {} },
            streakData: { lastActiveDate: null, currentStreak: 0, bestStreak: 0 },
            notes: [],
            music: { lastTrackIndex: 0, lastVolume: 0.7 },
            tasks: []
        };
    }

    function isMissingTableMessage(message) {
        const text = String(message || "").toLowerCase();
        return text.includes("could not find the table")
            || text.includes("schema cache")
            || text.includes("relation") && text.includes("does not exist");
    }

    function isSchemaMismatchMessage(message) {
        const text = String(message || "").toLowerCase();
        return text.includes("column") && text.includes("does not exist")
            || text.includes("invalid input syntax for type json")
            || text.includes("violates not-null constraint");
    }

    function getSetupMessage() {
        return "Supabase tables are missing. Create public.user_stats and public.tasks using the SQL in README, then retry login.";
    }

    function getSchemaMismatchMessage() {
        return "Supabase schema mismatch. Use the exact SQL from README Section 2 for public.user_stats/public.tasks, then retry login.";
    }

    const client = configValidationError
        ? null
        : window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: "implicit"
            }
        });

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

    async function getCurrentUser() {
        if (!client) {
            return null;
        }

        const result = await client.auth.getUser();
        if (result.error) {
            console.error("[Supabase] getUser failed:", result.error);
            throw result.error;
        }

        const user = result.data ? result.data.user : null;
        console.log("USER:", user);
        return user;
    }

    function normalizeDbError(error, context) {
        const message = error && error.message ? error.message : "Unknown database error";
        const lower = message.toLowerCase();

        if (isMissingTableMessage(message)) {
            return context + ": " + getSetupMessage();
        }

        if (isSchemaMismatchMessage(message)) {
            return context + ": " + getSchemaMismatchMessage();
        }

        if (lower.includes("row-level security") || lower.includes("permission denied") || lower.includes("not allowed")) {
            return context + ": RLS blocked this query. Add a policy with auth.uid() = user_id for this table.";
        }

        return context + ": " + message;
    }

    async function requireUser(expectedUserId) {
        const user = await getCurrentUser();
        if (!user) {
            throw new Error("No user logged in");
        }

        if (expectedUserId && expectedUserId !== user.id) {
            throw new Error("User mismatch detected. Refresh session and retry.");
        }

        return user;
    }

    async function ensureStatsRow(userId) {
        const user = await requireUser(userId);
        const payload = {
            user_id: user.id,
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
            throw new Error(normalizeDbError(error, "ensureStatsRow failed"));
        }
    }

    async function loadUserBundle(userId) {
        const user = await requireUser(userId);
        clearSetupWarning();

        try {
            await ensureStatsRow(user.id);

            const statsResult = await client
                .from("user_stats")
                .select("settings, timer_state, daily_stats, streak, notes, music")
                .eq("user_id", user.id)
                .single();

            if (statsResult.error) {
                throw new Error(normalizeDbError(statsResult.error, "user_stats select failed"));
            }

            const tasksResult = await client
                .from("tasks")
                .select("id, text, completed")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false });

            if (tasksResult.error) {
                throw new Error(normalizeDbError(tasksResult.error, "tasks select failed"));
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
        } catch (error) {
            const message = error && error.message ? error.message : "Cloud bootstrap failed";
            if (isMissingTableMessage(message) || message.includes("Supabase tables are missing")) {
                setSetupWarning(getSetupMessage());
                return getDefaultBundle();
            }
            if (isSchemaMismatchMessage(message) || message.includes("Supabase schema mismatch")) {
                setSetupWarning(getSchemaMismatchMessage());
                return getDefaultBundle();
            }
            throw error;
        }
    }

    async function updateStatsBlob(userId, patch) {
        const user = await requireUser(userId);
        const payload = {
            user_id: user.id,
            ...patch,
            updated_at: new Date().toISOString()
        };
        const { error } = await client
            .from("user_stats")
            .upsert(payload, { onConflict: "user_id" });

        if (error) {
            throw new Error(normalizeDbError(error, "user_stats update failed"));
        }
    }

    async function replaceTasks(userId, tasks) {
        const user = await requireUser(userId);
        const delResult = await client
            .from("tasks")
            .delete()
            .eq("user_id", user.id);

        if (delResult.error) {
            throw new Error(normalizeDbError(delResult.error, "tasks delete failed"));
        }

        if (!tasks.length) {
            return;
        }

        const rows = tasks.map(function (task) {
            return {
                id: task.id,
                user_id: user.id,
                text: task.text,
                completed: Boolean(task.completed)
            };
        });

        const insResult = await client
            .from("tasks")
            .insert(rows);

        if (insResult.error) {
            throw new Error(normalizeDbError(insResult.error, "tasks insert failed"));
        }
    }

    async function debugLoadStats() {
        const user = await getCurrentUser();

        if (!user) {
            console.error("No user logged in");
            return { data: null, error: "No user logged in" };
        }

        const { data, error } = await client
            .from("user_stats")
            .select("*")
            .eq("user_id", user.id);

        if (error) {
            console.error("DB ERROR:", error);
            return { data: null, error: normalizeDbError(error, "user_stats debug select failed") };
        }

        console.log("DATA:", data);
        return { data: data, error: null };
    }

    async function debugTestInsert() {
        const user = await getCurrentUser();

        if (!user) {
            console.error("No user logged in");
            return { data: null, error: "No user logged in" };
        }

        const dayKey = new Date().toISOString().slice(0, 10);
        const payload = {
            user_id: user.id,
            total_sessions: 1,
            total_focus_minutes: 25,
            daily_stats: {
                [dayKey]: {
                    sessions: 1,
                    focusMinutes: 25
                }
            },
            updated_at: new Date().toISOString()
        };

        const { data, error } = await client
            .from("user_stats")
            .upsert(payload, { onConflict: "user_id" })
            .select();

        console.log("INSERT RESULT:", data, error);

        if (error) {
            return { data: null, error: normalizeDbError(error, "user_stats debug insert failed") };
        }

        return { data: data, error: null };
    }

    window.AppDB = {
        client: client,
        config: {
            supabaseUrl: config.supabaseUrl,
            hasAnonKey: Boolean(config.supabaseAnonKey)
        },
        isConfigured: isConfigured,
        configValidationError: configValidationError,
        getSetupWarning: function () {
            return setupWarning;
        },
        checkConnection: checkConnection,
        getCurrentUser: getCurrentUser,
        debugLoadStats: debugLoadStats,
        debugTestInsert: debugTestInsert,
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

    // Console shortcut for quick troubleshooting after login.
    window.testInsert = debugTestInsert;
})();
