import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const SUPER_ADMIN_EMAIL = "superadmin@codepall.com";

const firebaseConfig = {
  apiKey: "AIzaSyDPsRwRf72xaQkSdGn89WdwA3sbJI2Z-z0",
  authDomain: "kegiatanku-503210.firebaseapp.com",
  projectId: "kegiatanku-503210",
  storageBucket: "kegiatanku-503210.firebasestorage.app",
  messagingSenderId: "603325028994",
  appId: "1:603325028994:web:b6b123f304d8a69d32b29b"
};

// Instance Khusus Admin
const adminApp = initializeApp(firebaseConfig, "AdminPortalApp");
const auth = getAuth(adminApp);
const db = getFirestore(adminApp);

// Instance Sekunder untuk eksekusi pembuatan, pemblokiran, dan penghapusan akun dari server Firebase Auth
const secondaryApp = initializeApp(firebaseConfig, "secondaryAuthApp");
const secondaryAuth = getAuth(secondaryApp);
const secondaryDb = getFirestore(secondaryApp);

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

// Buat Akun Baru atau Tautkan Akun Lama dengan Verifikasi Server Auth
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
  btn.textContent = "Memproses ke Server...";
  statusEl.textContent = "";

  try {
    let targetUid = "";
    let isExistingAccount = false;

    try {
      // 1. Buat akun di Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      targetUid = userCredential.user.uid;
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        // 2. Jika akun sudah ada di Firebase Auth, login di background untuk memverifikasi password & mengambil UID asli
        try {
          const signInCred = await signInWithEmailAndPassword(secondaryAuth, email, password);
          targetUid = signInCred.user.uid;
          isExistingAccount = true;
        } catch (pwError) {
          throw new Error("Email ini sudah terdaftar di Firebase, tetapi password yang Anda masukkan salah!");
        }
      } else {
        throw authError;
      }
    }

    // Pastikan dokumen userSettings target aktif (tidak terblokir)
    const targetDocRef = doc(secondaryDb, "userSettings", targetUid);
    const targetSnap = await getDoc(targetDocRef);
    const targetData = targetSnap.exists() ? targetSnap.data() : {};
    await setDoc(targetDocRef, {
      ...targetData,
      email: email,
      isBlocked: false,
      isDeleted: false
    });

    await signOut(secondaryAuth);

    // Perbarui daftar di dokumen Super Admin
    const existingIdx = managedUsersList.findIndex(u => u.email.toLowerCase() === email);
    const userRecord = {
      id: targetUid,
      uid: targetUid,
      email: email,
      password: password,
      isBlocked: false,
      createdAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    let updatedList = [...managedUsersList];
    if (existingIdx >= 0) {
      updatedList[existingIdx] = userRecord;
    } else {
      updatedList.push(userRecord);
    }

    const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);
    const snap = await getDoc(adminDocRef);
    const existingData = snap.exists() ? snap.data() : {};

    await setDoc(adminDocRef, {
      ...existingData,
      managedUsers: updatedList
    });

    if (isExistingAccount) {
      statusEl.textContent = `Akun lama (${email}) berhasil diverifikasi dan ditautkan ke User Manager!`;
    } else {
      statusEl.textContent = `Akun baru (${email}) berhasil dibuat di Firebase Auth dan siap digunakan!`;
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
    btn.innerHTML = `<i class="ph ph-plus-circle"></i> Simpan & Daftarkan Akun`;
  }
});

// Fungsi Blokir / Buka Blokir Real-Time
async function toggleBlockUser(u) {
  let pw = u.password;
  if (!pw) {
    pw = prompt(`Masukkan password untuk akun ${u.email} guna memverifikasi perubahan status server:`);
    if (!pw) return;
  }

  try {
    const cred = await signInWithEmailAndPassword(secondaryAuth, u.email, pw);
    const targetUid = cred.user.uid;
    const newBlockState = !u.isBlocked;

    const targetDocRef = doc(secondaryDb, "userSettings", targetUid);
    const targetSnap = await getDoc(targetDocRef);
    const targetData = targetSnap.exists() ? targetSnap.data() : {};

    await setDoc(targetDocRef, {
      ...targetData,
      isBlocked: newBlockState
    });

    await signOut(secondaryAuth);

    const updatedList = managedUsersList.map(item => {
      if (item.email === u.email) {
        return { ...item, uid: targetUid, password: pw, isBlocked: newBlockState };
      }
      return item;
    });

    const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);
    const snap = await getDoc(adminDocRef);
    const existingData = snap.exists() ? snap.data() : {};
    await setDoc(adminDocRef, { ...existingData, managedUsers: updatedList });

  } catch (err) {
    alert(`Gagal mengubah status akun: ${err.message}`);
  }
}

// Fungsi Hapus Akun Permanen dari Server Firebase Authentication
async function deleteAccountPermanently(u) {
  if (!confirm(`PERINGATAN: Akun ${u.email} akan dihapus PERMANEN dari database Firebase Authentication dan tidak akan bisa login lagi. Lanjutkan?`)) {
    return;
  }

  let pw = u.password;
  if (!pw) {
    pw = prompt(`Masukkan password untuk akun ${u.email} guna menghapus permanen dari server Firebase Auth:`);
    if (!pw) return;
  }

  try {
    // 1. Login ke akun target di jalur sekunder
    const cred = await signInWithEmailAndPassword(secondaryAuth, u.email, pw);
    const targetUser = cred.user;

    // 2. Tandai terhapus pada dokumen userSettings agar sesi yang sedang aktif langsung terputus real-time
    const targetDocRef = doc(secondaryDb, "userSettings", targetUser.uid);
    await setDoc(targetDocRef, { isDeleted: true, isBlocked: true });
    await deleteDoc(targetDocRef);

    // 3. Hapus permanen akun dari server Firebase Authentication
    await deleteUser(targetUser);

    // 4. Hapus dari daftar kelola Super Admin
    const filtered = managedUsersList.filter(item => item.email !== u.email);
    const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);
    const snap = await getDoc(adminDocRef);
    const existingData = snap.exists() ? snap.data() : {};
    await setDoc(adminDocRef, { ...existingData, managedUsers: filtered });

    alert(`Akun ${u.email} berhasil dihapus permanen dari Firebase Authentication!`);
  } catch (err) {
    alert(`Gagal menghapus akun dari server: ${err.message}`);
  }
}

function loadManagedUsers() {
  if (!currentAdminUser) return;
  const tbody = document.getElementById('user-table-body');
  const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);

  onSnapshot(adminDocRef, (docSnap) => {
    tbody.innerHTML = '';
    managedUsersList = (docSnap.exists() && docSnap.data().managedUsers) ? docSnap.data().managedUsers : [];

    if (managedUsersList.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">Belum ada akun yang dikelola. Tambahkan atau tautkan akun pada form di atas.</td></tr>';
      return;
    }

    managedUsersList.forEach((u) => {
      const isBlocked = u.isBlocked === true;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.email}</strong></td>
        <td>
          <span class="status-badge ${isBlocked ? 'status-blocked' : 'status-active'}">
            ${isBlocked ? 'Diblokir' : 'Aktif'}
          </span>
        </td>
        <td>${u.createdAt || '-'}</td>
        <td>
          <div class="action-group">
            <button class="btn-toggle-block" style="background: ${isBlocked ? 'var(--sage-light)' : '#fff3cd'}; border: 1px solid ${isBlocked ? 'var(--sage-primary)' : '#ffeeba'}; color: ${isBlocked ? 'var(--sage-dark)' : '#856404'}; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 11px; font-weight: 600;">
              ${isBlocked ? 'Aktifkan' : 'Blokir Akses'}
            </button>
            <button class="btn-del-perm" style="background: #ffecec; border: 1px solid #ffdcdc; color: #d9534f; border-radius: 6px; padding: 5px 10px; cursor: pointer; font-size: 11px; font-weight: 600;">
              Hapus Permanen
            </button>
          </div>
        </td>
      `;

      tr.querySelector('.btn-toggle-block').addEventListener('click', () => toggleBlockUser(u));
      tr.querySelector('.btn-del-perm').addEventListener('click', () => deleteAccountPermanently(u));

      tbody.appendChild(tr);
    });
  }, (error) => {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #d9534f;">Gagal memuat data: ${error.message}</td></tr>`;
  });
}
