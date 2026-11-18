import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const byId = (id) => document.getElementById(id);
let currentUser = null;
let loadVersion = 0;


function countStreak(entries, now = new Date()) {
    const days = new Set(entries.map((entry) => entry.id));
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
    const key = () => `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    if (!days.has(key())) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (days.has(key())) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

function todayKey() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderHistory(entries) {
    const history = byId("writing-history");
    history.replaceChildren();
    for (const entry of entries) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        const date = document.createElement("time");
        date.dateTime = entry.id;
        date.textContent = entry.id;
        const title = document.createElement("span");
        title.textContent = entry.prompt || "Writing prompt";
        summary.append(date, title);
        const response = document.createElement("p");
        response.className = "saved-response";
        response.textContent = entry.response || "";
        details.append(summary, response);
        history.append(details);
    }
}

async function loadAccount(user) {
    const version = ++loadVersion;
    byId("account-message").hidden = true;
    byId("retry-button").hidden = true;
    byId("today-status").textContent = "Loading…";
    byId("writing-days").textContent = "Loading…";
    byId("writing-streak").textContent = "Loading…";
    byId("history-status").textContent = "Loading your saved responses…";
    byId("writing-history").replaceChildren();
    const [responses] = await Promise.allSettled([
        getDocs(collection(db, "users", user.uid, "responses"))
    ]);
    if (version !== loadVersion || currentUser?.uid !== user.uid) return;
    const errors = [];
    if (responses.status === "fulfilled") {
        const entries = responses.value.docs.map((item) => ({ ...item.data(), id: item.id }))
            .sort((a, b) => b.id.localeCompare(a.id));
        byId("today-status").textContent = entries.some((entry) => entry.id === todayKey()) ? "Completed" : "Not written yet";
        byId("writing-days").textContent = String(entries.length);
        const streak = countStreak(entries);
        byId("writing-streak").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
        byId("history-status").textContent = entries.length ? "Open a response to read it again." : "No saved writing yet. Start with today's prompt.";
        renderHistory(entries);
    } else {
        byId("today-status").textContent = "Unavailable";
        byId("writing-days").textContent = "Unavailable";
        byId("writing-streak").textContent = "Unavailable";
        byId("history-status").textContent = "Your writing couldn't be loaded.";
        errors.push("Your saved responses couldn't be loaded.");
    }
    if (errors.length) {
        byId("account-message").textContent = `${errors.join(" ")} Please try again.`;
        byId("account-message").hidden = false;
        byId("retry-button").hidden = false;
    }
}

byId("retry-button").addEventListener("click", () => {
    if (currentUser) void loadAccount(currentUser);
});
byId("logout-link").addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        await signOut(auth);
        window.location.replace("/login");
    } catch {
        byId("account-message").textContent = "Couldn't log out. Please try again.";
        byId("account-message").hidden = false;
    }
});
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (!user) {
        loadVersion++;
        document.documentElement.dataset.authState = "checking";
        window.location.replace("/login");
        return;
    }
    document.documentElement.dataset.authState = "ready";
    void loadAccount(user);
});
