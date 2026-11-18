import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBN_cfpexzfTOA2c_cYYJ02PhWdCP2tU3U",
    authDomain: "promptly-6cfc6.firebaseapp.com",
    projectId: "promptly-6cfc6",
    storageBucket: "promptly-6cfc6.firebasestorage.app",
    messagingSenderId: "326385194112",
    appId: "1:326385194112:web:fc9f446566b871b53f4265",
    measurementId: "G-9LS6T3R8NR"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);