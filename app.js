import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, updateDoc, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Config Firebase milikmu
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
const db = getFirestore(app);

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const loginEmailEl = document.getElementById('login-email');
const loginPasswordEl = document.getElementById('login-password');
const btnLogin = document.getElementById('btn-login');
const btnRegister = document.getElementById('btn-register');
const loginError = document.getElementById('login-error');
const btnLogout = document.getElementById('btn-logout');

const userNameEl = document.getElementById('user-name');
const userAvatarEl = document.getElementById('user-avatar');
const greetingEl = document.getElementById('greeting');
const headerSubtitle = document.getElementById('header-subtitle');
const taskListEl = document.getElementById('task-list');
const sidebarItems = document.querySelectorAll('.nav-item');

const modal = document.getElementById('modal');
const btnAddTask = document.getElementById('btn-add-task');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');

let currentUser = null;
let allTasks = []; // Menyimpan semua data kegiatan di memory
let currentFilter = { type: 'status', value: 'all' }; // Filter default

// Minta izin notifikasi browser
function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission !== "granted") {
    Notification.requestPermission();
  }
}

// Auth Listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginScreen.classList.remove('active');
    appScreen.classList.add('active');
    requestNotificationPermission(); // Minta izin notifikasi saat login
    
    const nameFromEmail = user.email.split("@")[0];
    const displayName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
    
    userNameEl.textContent = displayName;
    userAvatarEl.src = `https://ui-avatars.com/api/?name=${displayName}&background=8a9e86&color=fff&bold=true`;
    greetingEl.textContent = `Halo, ${displayName}!`;
    
    fetchTasksFromDB();
    startNotificationChecker();
  } else {
    currentUser = null;
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
  }
});

// Login & Register & Logout
btnLogin.addEventListener('click', async () => {
  loginError.textContent = '';
  try { await signInWithEmailAndPassword(auth, loginEmailEl.value, loginPasswordEl.value); } 
  catch (error) { loginError.textContent = 'Gagal login: Periksa kembali datamu.'; }
});
btnRegister.addEventListener('click', async () => {
  loginError.textContent = '';
  if(loginPasswordEl.value.length < 6) return loginError.textContent = 'Password min 6 karakter!';
  try {
    await createUserWithEmailAndPassword(auth, loginEmailEl.value, loginPasswordEl.value);
    alert('Akun berhasil dibuat!');
  } catch (error) { loginError.textContent = 'Gagal daftar: Email mungkin sudah ada.'; }
});
btnLogout.addEventListener('click', () => signOut(auth));

// Mengelola Klik di Sidebar (Filter)
sidebarItems.forEach(item => {
  item.addEventListener('click', () => {
    // Hapus class active dari semua menu, tambahkan ke yg diklik
    sidebarItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    // Set filter aktif
    currentFilter.type = item.getAttribute('data-filter');
    currentFilter.value = item.getAttribute('data-value');
    
    // Ubah teks sub-header
    headerSubtitle.textContent = `Menampilkan kategori: ${item.textContent}`;
    
    // Render ulang UI
    renderTasks();
  });
});

// Modal Controls
btnAddTask.addEventListener('click', () => { clearForm(); modal.classList.add('active'); });
btnCancel.addEventListener('click', () => modal.classList.remove('active'));

// Simpan Kegiatan
btnSave.addEventListener('click', async () => {
  const title = document.getElementById('input-title').value;
  const date = document.getElementById('input-date').value;
  const category = document.getElementById('input-category').value;
  const timeStart = document.getElementById('input-time-start').value;
  const timeEnd = document.getElementById('input-time-end').value;

  if(!title || !date || !timeStart || !timeEnd) return alert('Lengkapi semua data!');

  try {
    btnSave.textContent = "Menyimpan...";
    await addDoc(collection(db, "tasks"), {
      uid: currentUser.uid,
      title, date, category, timeStart, timeEnd,
      completed: false,
      notified: false, // Flag agar notif tidak muncul berulang kali
      createdAt: new Date()
    });
    modal.classList.remove('active');
  } catch (error) { console.error(error); }
  finally { btnSave.textContent = "Simpan"; }
});

function clearForm() {
  document.getElementById('input-title').value = '';
  document.getElementById('input-date').value = '';
  document.getElementById('input-time-start').value = '';
  document.getElementById('input-time-end').value = '';
}

// Mengambil Data dari Firebase secara Realtime
function fetchTasksFromDB() {
  const q = query(collection(db, "tasks"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    allTasks = [];
    snapshot.forEach(docSnap => {
      allTasks.push({ id: docSnap.id, ...docSnap.data() });
    });
    renderTasks(); // Render setelah data ditarik
  });
}

// Fungsi Merender Data sesuai Filter Aktif
function renderTasks() {
  taskListEl.innerHTML = '';
  
  let filteredTasks = allTasks;

  // Logika Filter
  if (currentFilter.type === 'status') {
    if (currentFilter.value === 'pending') filteredTasks = allTasks.filter(t => !t.completed);
    if (currentFilter.value === 'completed') filteredTasks = allTasks.filter(t => t.completed);
  } else if (currentFilter.type === 'category') {
    filteredTasks = allTasks.filter(t => t.category === currentFilter.value);
  }

  if (filteredTasks.length === 0) {
    taskListEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;">Tidak ada kegiatan di kategori ini.</p>`;
    return;
  }

  filteredTasks.forEach(task => {
    // Penanda warna khusus untuk Kategori PR dan Organisasi
    let badgeClass = '';
    if(task.category === 'PR') badgeClass = 'badge-pr';
    if(task.category === 'Organisasi') badgeClass = 'badge-org';

    const card = document.createElement('div');
    card.className = `task-card ${task.completed ? 'completed' : ''}`;
    card.innerHTML = `
      <div class="task-info">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <div class="task-details">
          <h3>${task.title}</h3>
          <div class="task-meta">
            <span>📅 ${task.date}</span>
            <span>⏰ ${task.timeStart} - ${task.timeEnd}</span>
            <span class="${badgeClass}">${task.category}</span>
          </div>
        </div>
      </div>
      <button class="btn-delete">Hapus</button>
    `;

    card.querySelector('.task-checkbox').addEventListener('change', async (e) => {
      await updateDoc(doc(db, "tasks", task.id), { completed: e.target.checked });
    });

    card.querySelector('.btn-delete').addEventListener('click', async () => {
      if(confirm(`Hapus kegiatan: ${task.title}?`)) {
        await deleteDoc(doc(db, "tasks", task.id));
      }
    });

    taskListEl.appendChild(card);
  });
}

// Sistem Pengecekan Notifikasi (Berjalan setiap 1 Menit)
function startNotificationChecker() {
  setInterval(() => {
    if (Notification.permission === "granted") {
      const now = new Date();
      
      allTasks.forEach(async (task) => {
        if (!task.completed && !task.notified) {
          // Gabungkan tanggal dan waktu mulai menjadi objek Date
          const taskDateTime = new Date(`${task.date}T${task.timeStart}`);
          // Hitung selisih waktu dalam menit
          const diffMinutes = (taskDateTime - now) / 1000 / 60;
          
          // Jika waktunya tersisa antara 0 sampai 30 menit
          if (diffMinutes > 0 && diffMinutes <= 30) {
            new Notification("Pengingat Jadwal!", {
              body: `Kegiatan [${task.category}] "${task.title}" akan dimulai dalam ${Math.round(diffMinutes)} menit.`,
            });
            
            // Update database agar tidak dikirimi notifikasi terus-menerus
            await updateDoc(doc(db, "tasks", task.id), { notified: true });
          }
        }
      });
    }
  }, 60000); // 60000 ms = 1 menit
}
