import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDPsRwRf72xaQkSdGn89WdwA3sbJI2Z-z0",
  authDomain: "kegiatanku-503210.firebaseapp.com",
  projectId: "kegiatanku-503210",
  storageBucket: "kegiatanku-503210.firebasestorage.app",
  messagingSenderId: "603325028994",
  appId: "1:603325028994:web:b6b123f304d8a69d32b29b"
};

// Instance Utama untuk Admin
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Instance Kedua khusus pendaftaran akun baru agar Admin TIDAK logout otomatis
const secondaryApp = initializeApp(firebaseConfig, "secondaryAuthApp");
const secondaryAuth = getAuth(secondaryApp);

// Otentikasi Admin Gate
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-panel-screen').style.display = 'block';
    loadManagedUsers();
  } else {
    document.getElementById('admin-login-screen').style.display = 'flex';
    document.getElementById('admin-panel-screen').style.display = 'none';
  }
});

// Login Admin
document.getElementById('btn-admin-login').addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errEl = document.getElementById('admin-login-error');
  errEl.textContent = "";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    errEl.textContent = "Login Admin Gagal: Periksa email dan password.";
  }
});

// Logout Admin
document.getElementById('btn-admin-logout').addEventListener('click', () => {
  signOut(auth);
});

// Buat User Baru Tanpa Membuka Database
document.getElementById('btn-create-user').addEventListener('click', async () => {
  const emailInput = document.getElementById('new-user-email');
  const passwordInput = document.getElementById('new-user-password');
  const statusEl = document.getElementById('create-user-status');
  const btn = document.getElementById('btn-create-user');

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    statusEl.textContent = "Harap isi email dan password baru!";
    statusEl.style.color = "#d9534f";
    return;
  }

  if (password.length < 6) {
    statusEl.textContent = "Password minimal 6 karakter!";
    statusEl.style.color = "#d9534f";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Mendaftarkan...";
  statusEl.textContent = "";

  try {
    // 1. Buat User di Firebase Auth menggunakan instance sekunder
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const newUser = userCredential.user;
    
    // Segera logout dari instance sekunder
    await signOut(secondaryAuth);

    // 2. Simpan identitas ke Firestore collection 'managed_users' untuk daftar pantauan
    await addDoc(collection(db, "managed_users"), {
      uid: newUser.uid,
      email: email,
      createdAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    });

    statusEl.textContent = `Akun ${email} berhasil dibuat! User sekarang sudah bisa login.`;
    statusEl.style.color = "var(--sage-dark)";
    emailInput.value = "";
    passwordInput.value = "";
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Gagal: ${error.message}`;
    statusEl.style.color = "#d9534f";
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph ph-plus-circle"></i> Buat Akun Sekarang`;
  }
});

// Memuat Daftar Pengguna Terpantau Realtime
function loadManagedUsers() {
  const tbody = document.getElementById('user-table-body');
  onSnapshot(collection(db, "managed_users"), (snapshot) => {
    tbody.innerHTML = '';
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Belum ada user yang ditambahkan melalui panel ini.</td></tr>';
      return;
    }

    snapshot.forEach((docSnap) => {
      const u = docSnap.data();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.email}</strong></td>
        <td>${u.createdAt || '-'}</td>
        <td>
          <button class="btn-del-record" data-id="${docSnap.id}" style="background: #ffecec; border: 1px solid #ffdcdc; color: #d9534f; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 11px;">
            Hapus Catatan
          </button>
        </td>
      `;

      tr.querySelector('.btn-del-record').addEventListener('click', async () => {
        if (confirm(`Hapus catatan untuk ${u.email}?`)) {
          await deleteDoc(doc(db, "managed_users", docSnap.id));
        }
      });

      tbody.appendChild(tr);
    });
  });
}
