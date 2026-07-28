import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPsRwRf72xaQkSdGn89WdwA3sbJI2Z-z0",
  authDomain: "kegiatanku-503210.firebaseapp.com",
  projectId: "kegiatanku-503210",
  storageBucket: "kegiatanku-503210.firebasestorage.app",
  messagingSenderId: "603325028994",
  appId: "1:603325028994:web:b6b123f304d8a69d32b29b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'index.html';
  }
});

document.getElementById('btn-login').addEventListener('click', async () => {
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
  } catch (e) {
    document.getElementById('login-error').textContent = 'Gagal login. Periksa email & sandi.';
  }
});

document.getElementById('btn-register').addEventListener('click', async () => {
  try {
    await createUserWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
  } catch (e) {
    document.getElementById('login-error').textContent = 'Gagal daftar (Min. 6 karakter).';
  }
});
