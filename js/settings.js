import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut, updateProfile, verifyBeforeUpdateEmail } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
const byId = (id) => document.getElementById(id);
const types = {
    personal: "Personal", premium: "Premium", student: "Student", teacher: "Teacher",
    "school-administrator": "School Administrator",
    "site-administrator": "Site Administrator", "support-team": "Support Team"
};
let currentUser = null;
let saving = false;

async function loadAccountType(user) {
    byId("account-type").textContent = "Loading…";
    try {
        const profile = await getDoc(doc(db, "users", user.uid));
        if (currentUser !== user) return;
        const data = profile.data() || {};
        byId("account-type").textContent = types[data["account-type"] || "personal"] || "Unknown";
    } catch {
        if (currentUser !== user) return;
        byId("account-type").textContent = "Unavailable";
    }
}

function settingsMessage(text, type = "error") {
    byId("settings-message").textContent = text;
    byId("settings-message").className = `message ${type}`;
    byId("settings-message").hidden = false;
}

byId("settings").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || saving) return;
    const user = currentUser;
    const name = byId("account-name").value.trim();
    const email = byId("account-email").value.trim();
    if (!name || name.length > 100) {
        settingsMessage("Please enter a name of 1–100 characters.");
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        settingsMessage("Please enter a valid email address.");
        return;
    }
    saving = true;
    byId("save-profile").disabled = true;
    byId("account-name").disabled = byId("account-email").disabled = true;
    settingsMessage("Saving…", "info");
    let profileSaved = false;
    try {
        await updateProfile(user, { displayName: name });
        await setDoc(doc(db, "users", user.uid), { displayName: name, email: user.email || "" }, { merge: true });
        profileSaved = true;
        if (email !== user.email) {
            await verifyBeforeUpdateEmail(user, email);
            settingsMessage("Name saved. Check your new email address for a confirmation link. Your email will change after you confirm it.", "success");
        } else {
            settingsMessage("Changes saved.", "success");
        }
    } catch (error) {
        const prefix = profileSaved ? "Name saved. " : "";
        const messages = {
            "auth/requires-recent-login": "Please log out and sign in again before changing your email.",
            "auth/email-already-in-use": "That email address is already in use.",
            "auth/invalid-email": "Please enter a valid email address.",
            "auth/too-many-requests": "Please wait a little before trying again."
        };
        settingsMessage(prefix + (messages[error.code] || "Couldn't save all changes. Please try again."));
    } finally {
        saving = false;
        byId("save-profile").disabled = false;
        byId("account-name").disabled = byId("account-email").disabled = false;
    }
});

byId("logout-link").addEventListener("click", async (event) => {
    event.preventDefault();
    try {
        await signOut(auth);
        window.location.replace("/login");
    } catch {
        settingsMessage("Couldn't log out. Please try again.");
    }
});
onAuthStateChanged(auth, (user) => {
    currentUser = user;
    if (!user) {

        document.documentElement.dataset.authState = "checking";
        window.location.replace("/login");
        return;
    }
    byId("account-name").value = user.displayName || "";
    byId("account-email").value = user.email || "";
    byId("account-name").disabled = byId("account-email").disabled = false;
    byId("save-profile").disabled = false;
    document.documentElement.dataset.authState = "ready";
    void loadAccountType(user);

});
