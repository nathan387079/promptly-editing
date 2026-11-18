import { db } from "./firebase.js";
import {
    addDoc,
    collection,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const form = document.getElementById("support-form");
const subject = document.getElementById("support-subject");
const customField = document.getElementById("custom-subject-field");
const customSubject = document.getElementById("custom-subject");
const message = document.getElementById("support-text");
const feedback = document.getElementById("support-message");
const submitButton = document.getElementById("submit-button");
const categories = ["General question", "Report a problem", "Suggest an idea", "Other"];
let sending = false;

function showMessage(text, type = "error") {
    feedback.textContent = text;
    feedback.className = `support-message show ${type}`;
}

function updateCustomSubject() {
    const isOther = subject.value === "Other";
    customField.hidden = !isOther;
    customSubject.disabled = !isOther || sending;
    customSubject.setAttribute("aria-required", String(isOther));
}

subject.addEventListener("change", () => {
    updateCustomSubject();
    if (!customField.hidden) customSubject.focus();
});

for (const field of [subject, customSubject, message]) {
    field.addEventListener(field === subject ? "change" : "input", () => {
        field.classList.remove("input-error");
        field.removeAttribute("aria-invalid");
        if (feedback.classList.contains("error")) {
            feedback.textContent = "";
            feedback.className = "support-message";
        }
    });
}

function markInvalid(field) {
    field.classList.add("input-error");
    field.setAttribute("aria-invalid", "true");
    field.focus();
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (sending) return;

    for (const field of [subject, customSubject, message]) {
        field.classList.remove("input-error");
        field.removeAttribute("aria-invalid");
    }

    const category = subject.value;
    const title = category === "Other" ? customSubject.value.trim() : category;
    const text = message.value.trim();

    if (!categories.includes(category)) {
        showMessage("Please choose a subject.");
        markInvalid(subject);
        return;
    }
    if (!title || title.length > 120) {
        showMessage("Please enter a subject of 1–120 characters.");
        markInvalid(customSubject);
        return;
    }
    if (text.length < 10 || text.length > 5000) {
        showMessage("Please enter a message of 10–5,000 characters.");
        markInvalid(message);
        return;
    }

    sending = true;
    subject.disabled = customSubject.disabled = message.disabled = submitButton.disabled = true;
    showMessage("Sending your message...", "info");

    try {
        await addDoc(collection(db, "supportRequests"), {
            category,
            subject: title,
            message: text,
            status: "new",
            createdAt: serverTimestamp()
        });
        form.reset();
        showMessage("Your message has been sent. Thanks for reaching out!", "success");
    } catch (error) {
        const text = error?.code === "permission-denied"
            ? "We couldn't accept your message right now. Please try again later."
            : "Your message couldn't be sent. Check your connection and try again.";
        showMessage(text);
    } finally {
        sending = false;
        subject.disabled = message.disabled = submitButton.disabled = false;
        updateCustomSubject();
    }
});

updateCustomSubject();
