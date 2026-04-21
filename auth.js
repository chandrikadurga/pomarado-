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
        if (raw.includes("otp_expired")) {
            return "Verification link expired. Request a new signup email and open it immediately.";
        }
        return raw;
    }

    function resolveEmailRedirectUrl() {
        const origin = window.location.origin;
        const pathname = window.location.pathname || "";

        if (!origin || origin === "null") {
            return "http://127.0.0.1:5500";
        }

        if (pathname && pathname.endsWith(".html")) {
            return origin + pathname;
        }

        return origin;
    }

    async function handleAuthRedirect() {
        const url = new URL(window.location.href);
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");

        if (!tokenHash || !type) {
            return;
        }

        try {
            const verifyResult = await window.AppDB.client.auth.verifyOtp({
                type: type,
                token_hash: tokenHash
            });

            if (verifyResult.error) {
                console.error("[Auth] verifyOtp failed:", verifyResult.error);
                setMessage(mapAuthError(verifyResult.error), true);
                return;
            }

            console.info("[Auth] Email redirect processed successfully");
            setMessage("Email verified. You are now signed in.", false);

            url.searchParams.delete("token_hash");
            url.searchParams.delete("type");
            url.searchParams.delete("next");
            window.history.replaceState({}, document.title, url.pathname + (url.searchParams.toString() ? "?" + url.searchParams.toString() : ""));
        } catch (error) {
            console.error("[Auth] Redirect handling crashed:", error);
            setMessage(mapAuthError(error), true);
        }
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
            const emailRedirectTo = resolveEmailRedirectUrl();
            console.info("[Auth] Signup emailRedirectTo:", emailRedirectTo);

            const { error } = await window.AppDB.client.auth.signUp({
                email: email,
                password: password,
                options: {
                    emailRedirectTo: emailRedirectTo
                }
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

        await handleAuthRedirect();

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
