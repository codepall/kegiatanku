import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ============================================================================
// Ganti email di bawah ini dengan email Super Admin yang baru kamu buat!
// ============================================================================
const SUPER_ADMIN_EMAIL = "superadmin@codepall.com";

const firebaseConfig = {
  apiKey: "AIzaSyDPsRwRf72xaQkSdGn89WdwA3sbJI2Z-z0",
  authDomain: "kegiatanku-503210.firebaseapp.com",
  projectId: "kegiatanku-503210",
  storageBucket: "kegiatanku-503210.firebasestorage.app",
  messagingSenderId: "603325028994",
  appId: "1:603325028994:web:b6b123f304d8a69d32b29b"
};

// Instance KHUSUS Admin agar tidak terjadi tabrakan login dengan tab Aplikasi Utama
const adminApp = initializeApp(firebaseConfig, "AdminPortalApp");
const auth = getAuth(adminApp);

// Instance Default untuk mengakses database (Firestore)
const defaultApp = initializeApp(firebaseConfig);
const db = getFirestore(defaultApp);

// Instance Ketiga khusus untuk membuat user baru di latar belakang tanpa menimpa login saat ini
const secondaryApp = initializeApp(firebaseConfig, "secondaryAuthApp");
const secondaryAuth = getAuth(secondaryApp);


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
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-panel-screen').style.display = 'block';
    loadManagedUsers();
  } else {
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
    errEl.textContent = "Login Gagal: Password salah atau akun belum dibuat di Firebase Console.";
  }
});

document.getElementById('btn-admin-logout').addEventListener('click', () => {
  signOut(auth);
});


document.getElementById('btn-create-user').addEventListener('click', async () => {
  const emailInput = document.getElementById('new-user-email');
  const passwordInput = document.getElementById('new-user-password');
  const statusEl = document.getElementById('create-user-status');
  const btn = document.getElementById('btn-create-user');

  const email = emailInput.value.trim();
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
    let createdUid = "";
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

    const existingCheck = await getDocs(query(collection(db, "managed_users"), where("email", "==", email)));
    if (!existingCheck.empty) {
      statusEl.textContent = `Akun ${email} sudah ada di dalam tabel kelola!`;
      statusEl.style.color = "var(--sage-dark)";
      return;
    }

    await addDoc(collection(db, "managed_users"), {
      uid: createdUid || "existing-user",
      email: email,
      createdAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    });

    if (isExistingAccount) {
      statusEl.textContent = `Akun lama (${email}) berhasil ditautkan ke tabel kelola!`;
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

function loadManagedUsers() {
  const tbody = document.getElementById('user-table-body');
  onSnapshot(collection(db, "managed_users"), (snapshot) => {
    tbody.innerHTML = '';
    if (snapshot.empty) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">Belum ada user yang ditambahkan ke panel ini.</td></tr>';
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
            Hapus dari Tabel
          </button>
        </td>
      `;

      tr.querySelector('.btn-del-record').addEventListener('click', async () => {
        if (confirm(`Hapus catatan kelola untuk ${u.email}?`)) {
          await deleteDoc(doc(db, "managed_users", docSnap.id));
        }
      });

      tbody.appendChild(tr);
    });
  });
}
