import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = "superadmin@codepall.com";

const firebaseConfig = {
  apiKey: "AIzaSyDPsRwRf72xaQkSdGn89WdwA3sbJI2Z-z0",
  authDomain: "kegiatanku-503210.firebaseapp.com",
  projectId: "kegiatanku-503210",
  storageBucket: "kegiatanku-503210.firebasestorage.app",
  messagingSenderId: "603325028994",
  appId: "1:603325028994:web:b6b123f304d8a69d32b29b"
};

// Instance Khusus Admin agar terpisah dari sesi login web utama
const adminApp = initializeApp(firebaseConfig, "AdminPortalApp");
const auth = getAuth(adminApp);
const db = getFirestore(adminApp);

// Instance Sekunder untuk membuat akun baru tanpa mengeluarkan sesi Super Admin
const secondaryApp = initializeApp(firebaseConfig, "secondaryAuthApp");
const secondaryAuth = getAuth(secondaryApp);

let currentAdminUser = null;
let managedUsersList = [];

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (user.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
      const errEl = document.getElementById('admin-login-error');
      errEl.textContent = "Akses ditolak! Akun ini bukan akun Super Admin.";
      await signOut(auth);
      document.getElementById('admin-login-screen').style.display = 'flex';
      document.getElementById('admin-panel-screen').style.display = 'none';
      return;
    }
    currentAdminUser = user;
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-panel-screen').style.display = 'block';
    loadManagedUsers();
  } else {
    currentAdminUser = null;
    document.getElementById('admin-login-screen').style.display = 'flex';
    document.getElementById('admin-panel-screen').style.display = 'none';
  }
});

document.getElementById('btn-admin-login').addEventListener('click', async () => {
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const errEl = document.getElementById('admin-login-error');
  errEl.textContent = "";

  if (email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    errEl.textContent = "Akses ditolak! Hanya email Super Admin yang diizinkan masuk.";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    errEl.textContent = "Login Gagal: Periksa kembali email dan password Super Admin.";
  }
});

document.getElementById('btn-admin-logout').addEventListener('click', () => {
  signOut(auth);
});

// Buat Akun Baru atau Tautkan Akun Lama ke Tabel Kelola
document.getElementById('btn-create-user').addEventListener('click', async () => {
  const emailInput = document.getElementById('new-user-email');
  const passwordInput = document.getElementById('new-user-password');
  const statusEl = document.getElementById('create-user-status');
  const btn = document.getElementById('btn-create-user');

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    statusEl.textContent = "Harap isi email dan password!";
    statusEl.style.color = "#d9534f";
    return;
  }
  if (password.length < 6) {
    statusEl.textContent = "Password minimal 6 karakter!";
    statusEl.style.color = "#d9534f";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Memproses...";
  statusEl.textContent = "";

  try {
    let createdUid = "existing-user";
    let isExistingAccount = false;

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      createdUid = userCredential.user.uid;
      await signOut(secondaryAuth);
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        isExistingAccount = true;
      } else {
        throw authError;
      }
    }

    // Cek apakah email sudah ada di daftar kelola
    const alreadyExists = managedUsersList.some(u => u.email.toLowerCase() === email);
    if (alreadyExists) {
      statusEl.textContent = `Akun ${email} sudah terdaftar di dalam tabel di bawah!`;
      statusEl.style.color = "var(--sage-dark)";
      return;
    }

    const newEntry = {
      id: Date.now().toString(),
      uid: createdUid,
      email: email,
      createdAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    const updatedList = [...managedUsersList, newEntry];

    // Simpan ke dokumen userSettings milik Super Admin (Bebas Error Permission!)
    const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);
    const snap = await getDoc(adminDocRef);
    const existingData = snap.exists() ? snap.data() : {};

    await setDoc(adminDocRef, {
      ...existingData,
      managedUsers: updatedList
    });

    if (isExistingAccount) {
      statusEl.textContent = `Akun lama (${email}) berhasil ditautkan ke daftar kelola!`;
    } else {
      statusEl.textContent = `Akun baru (${email}) berhasil dibuat dan siap digunakan!`;
    }
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

// Memuat Daftar Pengguna dari Dokumen userSettings Super Admin
function loadManagedUsers() {
  if (!currentAdminUser) return;
  const tbody = document.getElementById('user-table-body');
  const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);

  onSnapshot(adminDocRef, (docSnap) => {
    tbody.innerHTML = '';
    managedUsersList = (docSnap.exists() && docSnap.data().managedUsers) ? docSnap.data().managedUsers : [];

    if (managedUsersList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Belum ada akun di daftar kelola. Ketik email akunmu di form atas untuk menautkannya.</td></tr>';
      return;
    }

    managedUsersList.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.email}</strong></td>
        <td>${u.createdAt || '-'}</td>
        <td>
          <button class="btn-del-record" data-id="${u.id}" style="background: #ffecec; border: 1px solid #ffdcdc; color: #d9534f; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 11px;">
            Hapus dari Tabel
          </button>
        </td>
      `;

      tr.querySelector('.btn-del-record').addEventListener('click', async () => {
        if (confirm(`Hapus catatan kelola untuk ${u.email}?`)) {
          const filtered = managedUsersList.filter(item => item.id !== u.id);
          const snap = await getDoc(adminDocRef);
          const existingData = snap.exists() ? snap.data() : {};
          await setDoc(adminDocRef, { ...existingData, managedUsers: filtered });
        }
      });

      tbody.appendChild(tr);
    });
  }, (error) => {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #d9534f;">Gagal memuat data: ${error.message}</td></tr>`;
  });
}
