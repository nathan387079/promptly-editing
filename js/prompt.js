import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc,
    runTransaction,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const response = document.getElementById("response");
const submitButton = document.getElementById("submit-button");
const dailyPrompt = document.getElementById("daily-prompt");
const submitMessage = document.getElementById("submit-message");
const logoutLink = document.getElementById("logout-link");

let messageTimer = null;

function showMessage(text, type = "error", dismissAfter = 0) {
    clearTimeout(messageTimer);
    messageTimer = null;
    submitMessage.textContent = text;
    submitMessage.className = text ? `prompt-message show ${type}` : "prompt-message";
    if (text && dismissAfter > 0) {
        messageTimer = setTimeout(() => showMessage(""), dismissAfter);
    }
}

function updateSubmitAvailability() {
    submitButton.setAttribute("aria-disabled", String(response.value.trim().length < 300));
}

const prompts = [
    "Describe a place where you feel completely comfortable. What makes it special?",
    "Write about a time when something did not go as planned.",
    "Imagine you wake up and discover that you can understand every animal. What happens next?",
    "What is something you wish more people understood about you?",
    "Write a story that begins with: The door had never been there before.",
    "Describe your perfect day from beginning to end.",
    "Imagine that everyone in the world suddenly loses the ability to lie.",
    "What is one small thing that can instantly improve your mood?",
    "Write about a character who discovers a mysterious object.",
    "Describe a memory using as many specific details as possible.",
    "Imagine you could visit any fictional world. Where would you go and why?",
    "Write about two people who completely disagree about something important.",
    "What is something you have learned recently that surprised you?",
    "Write a story that takes place during a power outage.",
    "Describe something ordinary as though you are seeing it for the first time."
];

function getDateKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function stringHash(text) {
    let hash = 0;

    for (let i = 0; i < text.length; i++) {
        hash = ((hash << 5) - hash) + text.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash);
}

function getDailyPrompt(userId, dateKey) {
    const index = stringHash(`${userId}-${dateKey}`) % prompts.length;
    return prompts[index];
}

function getFirestoreErrorMessage(error, action) {
    console.error(`${action} error:`, error);

    switch (error?.code) {
        case "permission-denied":
        case "firestore/permission-denied":
            return "Firebase denied access. Check your Firestore security rules.";
        case "unavailable":
        case "firestore/unavailable":
            return "Firebase is temporarily unavailable. Please try again.";
        case "failed-precondition":
        case "firestore/failed-precondition":
            return "Firebase needs additional setup before this can be saved.";
        default:
            return `${action} failed. Please try again.`;
    }
}

async function saveUserProfile(user) {
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

async function loadSavedResponse(user, dateKey) {
    const responseRef = doc(
        db,
        "users",
        user.uid,
        "responses",
        dateKey
    );

    try {
        const responseSnapshot = await getDoc(responseRef);

        if (!responseSnapshot.exists()) {
            response.disabled = false;
            submitButton.disabled = false;
            updateSubmitAvailability();
            return;
        }

        const savedData = responseSnapshot.data();
        response.value = savedData.response || "";
        response.disabled = true;
        submitButton.disabled = true;
        showMessage("You already submitted today's response.", "info");
    } catch (error) {
        response.disabled = false;
        submitButton.disabled = false;
        updateSubmitAvailability();
        showMessage(getFirestoreErrorMessage(error, "Could not load your response"));
    }
}

async function submitResponse(user, dateKey) {
    if (submitButton.disabled || response.disabled) return;
    const text = response.value.trim();

    if (text.length < 300) {
        showMessage(`Write some more! You're at ${text.length}/300 characters!`, "error", 10000);
        return;
    }

    submitButton.disabled = true;
    showMessage("Submitting...", "info");

    const responseRef = doc(
        db,
        "users",
        user.uid,
        "responses",
        dateKey
    );

    try {
        await setDoc(responseRef, {
            prompt: dailyPrompt.textContent,
            response: text,
            characterCount: text.length,
            date: dateKey,
            submittedAt: serverTimestamp()
        });

        response.disabled = true;
        showMessage("Submitted! Nice work.", "success");
    } catch (error) {
        submitButton.disabled = false;
        updateSubmitAvailability();
        showMessage(getFirestoreErrorMessage(error, "Submission"));
    }
}

response.addEventListener("input", () => {
    if (response.disabled) {
        return;
    }

    if (submitMessage.classList.contains("error")) showMessage("");
    updateSubmitAvailability();
});

submitButton.addEventListener("click", () => {
    if (currentUser && currentDateKey) {
        void submitResponse(currentUser, currentDateKey);
    }
});

logoutLink?.addEventListener("click", async (event) => {
    event.preventDefault();

    try {
        await signOut(auth);
        window.location.replace("/login");
    } catch (error) {
        console.error("Logout error:", error);
        window.location.replace("/login");
    }
});

let currentUser = null;
let currentDateKey = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.replace("/login");
        return;
    }

    currentUser = user;
    currentDateKey = getDateKey();

    dailyPrompt.textContent = getDailyPrompt(user.uid, currentDateKey);
    showMessage("");
    void saveUserProfile(user);
    response.disabled = true;
    submitButton.disabled = true;
    updateSubmitAvailability();
    document.documentElement.dataset.authState = "ready";

    await loadSavedResponse(user, currentDateKey);
});
