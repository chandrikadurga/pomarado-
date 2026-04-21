(function () {
    "use strict";

    let listeners = {
        onSignedIn: function () {},
        onSignedOut: function () {},
        onMessage: function () {}
    };

    function setMessage(message, isError) {
        listeners.onMessage(message, isError);
    }

    function mapAuthError(error) {
        const raw = error && error.message ? error.message : "Unknown authentication error";
        if (raw === "Failed to fetch") {
            return "Failed to reach Supabase. Verify internet, Supabase URL/key, and browser network blocking.";
        }
        return raw;
    }

    async function login(email, password) {
        try {
            const { error } = await window.AppDB.client.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) {
                console.error("[Auth] Login failed:", error);
                setMessage(mapAuthError(error), true);
                return;
            }

            setMessage("Logged in successfully", false);
        } catch (error) {
            console.error("[Auth] Login request crashed:", error);
            setMessage(mapAuthError(error), true);
        }
    }

    async function signup(email, password) {
        try {
            const { error } = await window.AppDB.client.auth.signUp({
                email: email,
                password: password
            });

            if (error) {
                console.error("[Auth] Signup failed:", error);
                setMessage(mapAuthError(error), true);
                return;
            }

            setMessage("Account created. Check your email if confirmation is enabled.", false);
        } catch (error) {
            console.error("[Auth] Signup request crashed:", error);
            setMessage(mapAuthError(error), true);
        }
    }

    async function logout() {
        try {
            const { error } = await window.AppDB.client.auth.signOut();
            if (error) {
                console.error("[Auth] Logout failed:", error);
                setMessage(mapAuthError(error), true);
                return;
            }
            setMessage("Logged out", false);
        } catch (error) {
            console.error("[Auth] Logout request crashed:", error);
            setMessage(mapAuthError(error), true);
        }
    }

    async function init(options) {
        listeners = {
            onSignedIn: options && typeof options.onSignedIn === "function" ? options.onSignedIn : listeners.onSignedIn,
            onSignedOut: options && typeof options.onSignedOut === "function" ? options.onSignedOut : listeners.onSignedOut,
            onMessage: options && typeof options.onMessage === "function" ? options.onMessage : listeners.onMessage
        };

        if (!window.AppDB || !window.AppDB.client || !window.AppDB.isConfigured()) {
            const configMessage = window.AppDB && window.AppDB.configValidationError
                ? window.AppDB.configValidationError
                : "Supabase is not configured. Set valid URL and anon key in db.js.";
            console.error("[Auth] Config validation failed:", configMessage);
            setMessage(configMessage, true);
            listeners.onSignedOut();
            return;
        }

        const connection = await window.AppDB.checkConnection();
        if (!connection.ok) {
            console.error("[Auth] Supabase connection check failed:", connection.message);
            setMessage(connection.message, true);
            listeners.onSignedOut();
            return;
        }

        try {
            const sessionResult = await window.AppDB.client.auth.getSession();
            if (sessionResult.error) {
                console.error("[Auth] getSession failed:", sessionResult.error);
                setMessage(mapAuthError(sessionResult.error), true);
                listeners.onSignedOut();
            } else if (sessionResult.data && sessionResult.data.session && sessionResult.data.session.user) {
                listeners.onSignedIn(sessionResult.data.session.user);
            } else {
                listeners.onSignedOut();
            }

            window.AppDB.client.auth.onAuthStateChange(function (_event, session) {
                if (session && session.user) {
                    listeners.onSignedIn(session.user);
                    return;
                }
                listeners.onSignedOut();
            });
        } catch (error) {
            console.error("[Auth] Init crashed:", error);
            setMessage(mapAuthError(error), true);
            listeners.onSignedOut();
        }
    }

    window.AuthModule = {
        init: init,
        login: login,
        signup: signup,
        logout: logout
    };
})();
