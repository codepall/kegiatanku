import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, deleteUser } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Instance Sekunder untuk operasi server latar belakang
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
  const btn = document.getElementById('btn-admin-login');
  errEl.textContent = "";

  if (email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    errEl.textContent = "Akses ditolak! Hanya email Super Admin yang diizinkan masuk.";
    return;
  }

  btn.disabled = true;
  btn.textContent = "Memeriksa...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    errEl.textContent = "Login Gagal: Periksa kembali email dan password Super Admin.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Masuk Admin";
  }
});

document.getElementById('btn-admin-logout').addEventListener('click', () => {
  signOut(auth);
});

// Fungsi Render Tabel Instan (Optimistic UI)
function renderTableUI() {
  const tbody = document.getElementById('user-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

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
}

// Buat Akun Baru atau Tautkan Akun Lama secara Paralel
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
    let targetUid = "";
    let isExistingAccount = false;

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      targetUid = userCredential.user.uid;
    } catch (authError) {
      if (authError.code === 'auth/email-already-in-use') {
        try {
          const signInCred = await signInWithEmailAndPassword(secondaryAuth, email, password);
          targetUid = signInCred.user.uid;
          isExistingAccount = true;
        } catch (pwError) {
          throw new Error("Email sudah terdaftar di Firebase, tetapi password yang dimasukkan salah!");
        }
      } else {
        throw authError;
      }
    }

    const userRecord = {
      id: targetUid,
      uid: targetUid,
      email: email,
      password: password,
      isBlocked: false,
      createdAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    const existingIdx = managedUsersList.findIndex(u => u.email.toLowerCase() === email);
    if (existingIdx >= 0) {
      managedUsersList[existingIdx] = userRecord;
    } else {
      managedUsersList.push(userRecord);
    }

    // Perbarui UI seketika tanpa menunggu jaringan selesai
    renderTableUI();
    emailInput.value = "";
    passwordInput.value = "";
    statusEl.textContent = isExistingAccount 
      ? `Akun lama (${email}) berhasil ditautkan!` 
      : `Akun baru (${email}) berhasil dibuat dan siap digunakan!`;
    statusEl.style.color = "var(--sage-dark)";

    // Jalankan penyimpanan ke kedua dokumen secara paralel dengan merge: true (Tanpa getDoc)
    const targetDocRef = doc(secondaryDb, "userSettings", targetUid);
    const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);

    await Promise.all([
      setDoc(targetDocRef, { email: email, isBlocked: false, isDeleted: false }, { merge: true }),
      setDoc(adminDocRef, { managedUsers: managedUsersList }, { merge: true })
    ]);

    signOut(secondaryAuth);
  } catch (error) {
    console.error(error);
    statusEl.textContent = `Gagal: ${error.message}`;
    statusEl.style.color = "#d9534f";
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="ph ph-plus-circle"></i> Simpan & Daftarkan Akun`;
  }
});

// Fungsi Blokir / Buka Blokir Instan (Optimistic UI + Parallel Write)
async function toggleBlockUser(u) {
  let pw = u.password;
  if (!pw) {
    pw = prompt(`Masukkan password untuk akun ${u.email} guna memverifikasi perubahan status:`);
    if (!pw) return;
  }

  const previousList = JSON.parse(JSON.stringify(managedUsersList));
  const newBlockState = !u.isBlocked;

  // 1. Ubah tampilan tabel secara instan (0ms delay)
  managedUsersList = managedUsersList.map(item => {
    if (item.email === u.email) {
      return { ...item, password: pw, isBlocked: newBlockState };
    }
    return item;
  });
  renderTableUI();

  // 2. Proses ke server secara paralel di latar belakang
  try {
    const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);
    
    const updateTargetServer = async () => {
      const cred = await signInWithEmailAndPassword(secondaryAuth, u.email, pw);
      const targetDocRef = doc(secondaryDb, "userSettings", cred.user.uid);
      await setDoc(targetDocRef, { isBlocked: newBlockState }, { merge: true });
      await signOut(secondaryAuth);
    };

    await Promise.all([
      setDoc(adminDocRef, { managedUsers: managedUsersList }, { merge: true }),
      updateTargetServer()
    ]);
  } catch (err) {
    // Kembalikan tampilan jika gagal
    managedUsersList = previousList;
    renderTableUI();
    alert(`Gagal mengubah status akun: ${err.message}`);
  }
}

// Fungsi Hapus Akun Permanen & Bersihkan Tugas secara Paralel
async function deleteAccountPermanently(u) {
  if (!confirm(`PERINGATAN: Akun ${u.email} beserta seluruh tugasnya akan dihapus PERMANEN. Lanjutkan?`)) {
    return;
  }

  let pw = u.password;
  if (!pw) {
    pw = prompt(`Masukkan password untuk akun ${u.email} guna menghapus permanen dari server:`);
    if (!pw) return;
  }

  const previousList = JSON.parse(JSON.stringify(managedUsersList));

  // 1. Hapus dari tampilan tabel secara instan
  managedUsersList = managedUsersList.filter(item => item.email !== u.email);
  renderTableUI();

  try {
    const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);

    const wipeUserFromServer = async () => {
      const cred = await signInWithEmailAndPassword(secondaryAuth, u.email, pw);
      const targetUser = cred.user;
      const targetDocRef = doc(secondaryDb, "userSettings", targetUser.uid);

      // Hapus seluruh tugas milik user dan dokumen pengaturannya secara paralel
      const tasksSnap = await getDocs(query(collection(secondaryDb, "tasks"), where("uid", "==", targetUser.uid)));
      const deletePromises = tasksSnap.docs.map(d => deleteDoc(doc(secondaryDb, "tasks", d.id)));
      
      await setDoc(targetDocRef, { isDeleted: true, isBlocked: true }, { merge: true });
      await Promise.all([
        ...deletePromises,
        deleteDoc(targetDocRef)
      ]);

      // Hapus permanen akun dari Firebase Authentication
      await deleteUser(targetUser);
    };

    await Promise.all([
      setDoc(adminDocRef, { managedUsers: managedUsersList }, { merge: true }),
      wipeUserFromServer()
    ]);
  } catch (err) {
    // Kembalikan ke tabel jika gagal
    managedUsersList = previousList;
    renderTableUI();
    alert(`Gagal menghapus akun dari server: ${err.message}`);
  }
}

function loadManagedUsers() {
  if (!currentAdminUser) return;
  const adminDocRef = doc(db, "userSettings", currentAdminUser.uid);

  onSnapshot(adminDocRef, (docSnap) => {
    managedUsersList = (docSnap.exists() && docSnap.data().managedUsers) ? docSnap.data().managedUsers : [];
    renderTableUI();
  }, (error) => {
    const tbody = document.getElementById('user-table-body');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #d9534f;">Gagal memuat data: ${error.message}</td></tr>`;
    }
  });
}
