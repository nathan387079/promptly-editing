import {
    GoogleAuthProvider,
    onAuthStateChanged,
    getRedirectResult,
    signInWithPopup,
    signInWithRedirect,
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

import { auth, db } from "./firebase.js";

const googleLoginButton = document.getElementById("google-login-button");
const loginMessage = document.getElementById("login-message");

const emailLoginForm = document.getElementById("email-login-form");
const emailInput = document.getElementById("email");
const emailSubmitButton = document.getElementById("email-submit-button");

function setMessage(message, type = "error") {
    if (!loginMessage) {
        return;
    }

    loginMessage.textContent = message;
    loginMessage.className = `login-message show ${type}`;
}

function clearMessage() {
    if (!loginMessage) {
        return;
    }

    loginMessage.textContent = "";
    loginMessage.className = "login-message";
}

function setInputError(input, hasError) {
    if (!input) {
        return;
    }

    input.classList.toggle("input-error", hasError);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getGoogleErrorMessage(error) {
    switch (error?.code) {
        case "auth/unauthorized-domain":
            return "This site is not authorized for Google sign-in. Add this domain in Firebase Authentication settings.";
        case "auth/operation-not-allowed":
            return "Google sign-in is not enabled in Firebase Authentication.";
        case "auth/popup-blocked":
            return "The sign-in popup was blocked. Opening Google sign-in...";
        case "auth/popup-closed-by-user":
            return "The Google sign-in window was closed before login finished.";
        case "auth/network-request-failed":
            return "The login request could not reach Firebase. Check your internet connection.";
        case "auth/account-exists-with-different-credential":
            return "An account already exists with this email using a different sign-in method.";
        default:
            console.error("Google authentication error:", error);
            return "Google login failed. Please try again.";
    }
}

function getEmailErrorMessage(error) {
    switch (error?.code) {
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/invalid-credential":
        case "auth/invalid-action-code":
            return "This link could not be verified. Confirm the email it was sent to, or request a new link.";
        case "auth/expired-action-code":
            return "This link has expired. Request a new link below.";
        case "auth/user-disabled":
            return "This account has been disabled.";
        case "auth/operation-not-allowed":
            return "Email-link sign-in is currently unavailable.";
        case "auth/unauthorized-domain":
        case "auth/unauthorized-continue-uri":
        case "auth/invalid-continue-uri":
            return "Email-link sign-in is not configured for this site yet.";
        case "auth/network-request-failed":
            return "Could not reach the sign-in service. Check your connection and try again.";
        case "auth/too-many-requests":
        case "auth/quota-exceeded":
            return "Too many sign-in requests. Please wait and try again later.";
        default:
            return "Email sign-in failed. Please try again.";
    }
}

const emailStorageKey = "promptly.emailForSignIn";
let emailLink = isSignInWithEmailLink(auth, window.location.href)
    ? window.location.href
    : null;
let authenticationBusy = true;

function setAuthenticationBusy(busy) {
    if (!busy && auth.currentUser) {
        busy = true;
        window.location.replace("/prompt");
    }
    authenticationBusy = busy;
    if (emailSubmitButton) emailSubmitButton.disabled = busy;
    if (googleLoginButton) googleLoginButton.disabled = busy;
    if (emailInput) emailInput.disabled = busy;
}

function updateEmailButton() {
    const label = document.getElementById("email-submit-label");
    if (label) {
        label.textContent = emailLink
            ? "Confirm Email and Sign In"
            : "Continue With Email";
    }
}

function clearSavedEmail() {
    try {
        window.localStorage.removeItem(emailStorageKey);
    } catch {
    }
}

async function completeEmailSignIn(email) {
    setAuthenticationBusy(true);
    setMessage("Signing you in...", "info");
    try {
        const result = await signInWithEmailLink(auth, email, emailLink);
        clearSavedEmail();
        emailLink = null;
        window.history.replaceState(null, "", window.location.pathname);
        await finishLogin(result.user);
    } catch (error) {
        clearSavedEmail();
        setAuthenticationBusy(false);
        setMessage(getEmailErrorMessage(error));
        if (error?.code === "auth/expired-action-code") {
            emailLink = null;
            window.history.replaceState(null, "", window.location.pathname);
        }
        updateEmailButton();
        emailInput?.focus();
    }
}

async function sendEmailLink(email) {
    setAuthenticationBusy(true);
    setMessage("Sending your sign-in link...", "info");
    try {
        await sendSignInLinkToEmail(auth, email, {
            url: new URL(window.location.pathname, window.location.origin).href,
            handleCodeInApp: true
        });
        try {
            window.localStorage.setItem(emailStorageKey, email);
        } catch {
        }
        setMessage("Check your inbox for your sign-in link to sign in or create your account. If you can't find it, check your spam folder.", "success");
    } catch (error) {
        setMessage(getEmailErrorMessage(error));
    } finally {
        setAuthenticationBusy(false);
    }
}

async function saveUserProfile(user) {
    if (!user) {
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        await runTransaction(db, async (transaction) => {
            const snapshot = await transaction.get(userRef);
            const profile = {
                displayName: user.displayName || "",
                email: user.email || "",
                photoURL: user.photoURL || "",
                lastLoginAt: serverTimestamp()
            };

            if (!Object.prototype.hasOwnProperty.call(snapshot.data() || {}, "account-type")) {
                profile["account-type"] = "personal";
            }

            transaction.set(userRef, profile, { merge: true });
        });
    } catch (error) {
        console.error("Could not save user profile:", error);
    }
}

async function finishLogin(user) {
    if (!user) {
        return;
    }

    await saveUserProfile(user);

    setMessage(
        `Welcome, ${user.displayName || user.email || "there"}!`,
        "success"
    );

    setTimeout(() => {
        window.location.replace("/prompt");
    }, 300);
}

async function handleRedirectResult() {
    try {
        const result = await getRedirectResult(auth);

        if (result?.user) {
            await finishLogin(result.user);
        }
    } catch (error) {
        console.error("Redirect login error:", error);
        setMessage(getGoogleErrorMessage(error));

        if (googleLoginButton) {
            setAuthenticationBusy(false);
        }
    }
}

if (googleLoginButton) {
    googleLoginButton.addEventListener("click", async () => {
        if (authenticationBusy) return;
        setAuthenticationBusy(true);
        setMessage("Signing you in...", "info");

        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            await finishLogin(result.user);
        } catch (error) {
            console.error("Popup login error:", error);

            if (error?.code === "auth/popup-blocked") {
                setMessage(getGoogleErrorMessage(error), "info");

                try {
                    await signInWithRedirect(auth, provider);
                } catch (redirectError) {
                    console.error("Redirect login error:", redirectError);
                    setAuthenticationBusy(false);
                    setMessage(getGoogleErrorMessage(redirectError));
                }

                return;
            }

            setAuthenticationBusy(false);
            setMessage(getGoogleErrorMessage(error));
        }
    });
}

if (emailInput) {
    emailInput.addEventListener("input", () => {
        setInputError(emailInput, false);
        clearMessage();
    });
}

if (emailLoginForm) {
    emailLoginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (authenticationBusy) return;
        const email = emailInput?.value.trim() || "";
        setInputError(emailInput, false);
        clearMessage();
        if (!isValidEmail(email)) {
            setInputError(emailInput, true);
            setMessage("Please enter a valid email address.");
            emailInput?.focus();
            return;
        }
        if (emailLink) {
            await completeEmailSignIn(email);
        } else {
            await sendEmailLink(email);
        }
    });
}

async function initializeLogin() {
    await auth.authStateReady();
    if (auth.currentUser) {
        setAuthenticationBusy(true);
        window.location.replace("/prompt");
        return;
    }
    updateEmailButton();
    if (!emailLink) {
        await handleRedirectResult();
        setAuthenticationBusy(false);
        return;
    }
    let savedEmail = null;
    try {
        savedEmail = window.localStorage.getItem(emailStorageKey);
    } catch {
    }
    if (savedEmail && isValidEmail(savedEmail)) {
        if (emailInput) emailInput.value = savedEmail;
        await completeEmailSignIn(savedEmail);
    } else {
        setAuthenticationBusy(false);
        setMessage("Confirm the email address this link was sent to, then select Confirm Email and Sign In.", "info");
        emailInput?.focus();
    }
}

onAuthStateChanged(auth, (user) => {
    if (user && !authenticationBusy) {
        setAuthenticationBusy(true);
        window.location.replace("/prompt");
    }
});

void initializeLogin();
