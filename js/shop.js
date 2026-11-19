import { auth } from "./firebase.js";
import { getIdTokenResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { collection, getDocs, orderBy, query } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import { db } from "./firebase.js";

const byId = (id) => document.getElementById(id);
const showMessage = (text, success = false) => {
  const box = byId("shop-message");
  box.textContent = text;
  box.className = success ? "notice success" : "notice";
  box.hidden = !text;
};

async function loadPurchases(user) {
  const list = byId("purchases");
  list.replaceChildren();
  try {
    const purchases = await getDocs(query(collection(db, "users", user.uid, "purchases"), orderBy("createdAt", "desc")));
    if (purchases.empty) {
      byId("purchase-status").textContent = "No completed purchases are linked to this account yet.";
      return;
    }
    byId("purchase-status").textContent = "Your completed purchases";
    for (const purchase of purchases.docs) {
      const row = document.createElement("article");
      row.className = "purchase-item";
      const product = document.createElement("strong");
      product.textContent = typeof purchase.data().productName === "string" ? purchase.data().productName : "Promptly purchase";
      const date = document.createElement("span");
      date.textContent = purchase.data().createdAt?.toDate?.().toLocaleDateString?.() || "Date unavailable";
      row.append(product, date);
      list.append(row);
    }
  } catch {
    byId("purchase-status").textContent = "Purchase history couldn't be loaded. Please try again later.";
  }
}

byId("logout-link").addEventListener("click", async (event) => {
  event.preventDefault();
  try { await signOut(auth); window.location.replace("/login"); }
  catch { showMessage("Couldn't log out. Please try again."); }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.replace("/login"); return; }
  try {
    const token = await getIdTokenResult(user);
    const active = token.claims.premium === true;
    byId("membership-badge").textContent = active ? "Active" : "Free plan";
    byId("membership-copy").textContent = active
      ? "Premium access is active on this account."
      : "Your account is on the free plan. Your writing and daily prompts remain available.";
    const paymentLink = window.PROMPTLY_CONFIG?.stripePaymentLink;
    if (typeof paymentLink === "string" && paymentLink.startsWith("https://")) {
      const link = byId("checkout-link");
      link.href = paymentLink;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.hidden = false;
      byId("checkout-note").hidden = true;
    } else {
      byId("checkout-note").hidden = false;
    }
    await loadPurchases(user);
  } catch {
    showMessage("Your membership couldn't be checked. Sign in again and refresh this page.");
    byId("purchase-status").textContent = "Membership information is unavailable.";
  }
  document.documentElement.dataset.authState = "ready";
});
