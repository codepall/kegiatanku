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
const loginError = document.getElementById('login-error');
const taskListEl = document.getElementById('task-list');
const sidebar = document.getElementById('sidebar');

// Modal Form Elements
const modal = document.getElementById('modal');
const inputCategory = document.getElementById('input-category');
const fieldMapel = document.getElementById('field-mapel');
const fieldOrgDuration = document.getElementById('field-org-duration');
const inputDurasiOrg = document.getElementById('input-durasi-org');
const blockTimeSingle = document.getElementById('block-time-single');
const blockTimeMulti = document.getElementById('block-time-multi');

let currentUser = null;
let allTasks = [];
let currentFilter = { type: 'status', value: 'all' };

// Toggle Sidebar Minimize
document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
  sidebar.classList.toggle('minimized');
});

// Dinamisasi Form Kategori & Durasi (UI Logic)
inputCategory.addEventListener('change', (e) => {
  const cat = e.target.value;
  fieldMapel.style.display = (cat === 'PR') ? 'flex' : 'none';
  fieldOrgDuration.style.display = (cat === 'Organisasi') ? 'flex' : 'none';
  
  if (cat !== 'Organisasi') {
    blockTimeSingle.style.display = 'block';
    blockTimeMulti.style.display = 'none';
  } else {
    inputDurasiOrg.dispatchEvent(new Event('change'));
  }
});

inputDurasiOrg.addEventListener('change', (e) => {
  if (e.target.value === 'multi') {
    blockTimeSingle.style.display = 'none';
    blockTimeMulti.style.display = 'block';
  } else {
    blockTimeSingle.style.display = 'block';
    blockTimeMulti.style.display = 'none';
  }
});

// Auth Listener & Realtime Database Setup (Mirip sebelumnya)
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginScreen.classList.remove('active');
    appScreen.classList.add('active');
    
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    
    const displayName = user.email.split("@")[0];
    document.getElementById('user-name').textContent = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${displayName}&background=8a9e86&color=fff&bold=true`;
    
    fetchTasksFromDB();
  } else {
    currentUser = null;
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
  }
});

// Login & Logout Handlers
document.getElementById('btn-login').addEventListener('click', async () => {
  try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
  catch (error) { loginError.textContent = 'Gagal login: Periksa kembali.'; }
});
document.getElementById('btn-register').addEventListener('click', async () => {
  try { await createUserWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
  catch (error) { loginError.textContent = 'Gagal daftar.'; }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// Sidebar Filters
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    currentFilter = { type: item.getAttribute('data-filter'), value: item.getAttribute('data-value') };
    document.getElementById('header-subtitle').textContent = `Menampilkan kategori: ${item.querySelector('span').textContent}`;
    renderTasks();
  });
});

// Buka Tutup Modal
document.getElementById('btn-add-task').addEventListener('click', () => {
  document.getElementById('input-title').value = '';
  inputCategory.value = 'Umum';
  inputCategory.dispatchEvent(new Event('change'));
  modal.classList.add('active');
});
document.getElementById('btn-cancel').addEventListener('click', () => modal.classList.remove('active'));

// PERBAIKAN BUG SIMPAN KEGIATAN
document.getElementById('btn-save').addEventListener('click', async () => {
  const btnSave = document.getElementById('btn-save');
  const title = document.getElementById('input-title').value;
  const category = inputCategory.value;

  if (!title) return alert('Mohon isi Nama/Judul Kegiatan!');

  let payload = {
    uid: currentUser.uid,
    title: title,
    category: category,
    completed: false,
    notified: false,
    createdAt: new Date()
  };

  // Validasi dinamis sesuai UI yang tampil
  if (category === 'PR') {
    payload.mapel = document.getElementById('input-mapel').value;
  }

  if (category === 'Organisasi' && inputDurasiOrg.value === 'multi') {
    payload.dateStart = document.getElementById('input-date-start-multi').value;
    payload.dateEnd = document.getElementById('input-date-end-multi').value;
    payload.timeStart = document.getElementById('input-time-multi').value;
    payload.isMultiDay = true;
    if(!payload.dateStart || !payload.dateEnd || !payload.timeStart) return alert('Lengkapi tanggal dan jam!');
  } else {
    // Berlaku untuk Umum, PR, dan Organisasi (1 Hari)
    payload.date = document.getElementById('input-date-single').value;
    payload.timeStart = document.getElementById('input-time-start').value;
    payload.timeEnd = document.getElementById('input-time-end').value;
    payload.isMultiDay = false;
    if(!payload.date || !payload.timeStart || !payload.timeEnd) return alert('Lengkapi tanggal dan jam!');
  }

  try {
    btnSave.textContent = "Menyimpan...";
    await addDoc(collection(db, "tasks"), payload);
    modal.classList.remove('active');
  } catch (error) { 
    alert("Terjadi kesalahan sistem saat menyimpan.");
    console.error(error); 
  } finally { 
    btnSave.textContent = "Simpan"; 
  }
});

function fetchTasksFromDB() {
  const q = query(collection(db, "tasks"), where("uid", "==", currentUser.uid), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    allTasks = [];
    snapshot.forEach(docSnap => { allTasks.push({ id: docSnap.id, ...docSnap.data() }); });
    renderTasks();
  });
}

function renderTasks() {
  taskListEl.innerHTML = '';
  let filteredTasks = allTasks;

  if (currentFilter.type === 'status') {
    if (currentFilter.value === 'pending') filteredTasks = allTasks.filter(t => !t.completed);
    if (currentFilter.value === 'completed') filteredTasks = allTasks.filter(t => t.completed);
  } else if (currentFilter.type === 'category') {
    filteredTasks = allTasks.filter(t => t.category === currentFilter.value);
  }

  if (filteredTasks.length === 0) {
    taskListEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;">Belum ada kegiatan di sini.</p>`;
    return;
  }

  filteredTasks.forEach(task => {
    let badgeClass = '';
    let extraInfo = '';
    let timeDisplay = '';

    if(task.category === 'PR') {
      badgeClass = 'badge-pr';
      extraInfo = `<span>📚 ${task.mapel}</span>`;
    }
    if(task.category === 'Organisasi') badgeClass = 'badge-org';

    if (task.isMultiDay) {
      timeDisplay = `<span>📅 ${task.dateStart} s/d ${task.dateEnd}</span> <span>⏰ Jam Kumpul: ${task.timeStart}</span>`;
    } else {
      timeDisplay = `<span>📅 ${task.date}</span> <span>⏰ ${task.timeStart} - ${task.timeEnd}</span>`;
    }

    const card = document.createElement('div');
    card.className = `task-card glass-panel ${task.completed ? 'completed' : ''}`;
    card.innerHTML = `
      <div class="task-info">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <div class="task-details">
          <h3>${task.title}</h3>
          <div class="task-meta">
            ${timeDisplay}
            <span class="${badgeClass}">${task.category}</span>
            ${extraInfo}
          </div>
        </div>
      </div>
      <button class="btn-delete"><i class="ph ph-trash"></i></button>
    `;

    card.querySelector('.task-checkbox').addEventListener('change', async (e) => {
      await updateDoc(doc(db, "tasks", task.id), { completed: e.target.checked });
    });

    card.querySelector('.btn-delete').addEventListener('click', async () => {
      if(confirm(`Hapus kegiatan ini?`)) await deleteDoc(doc(db, "tasks", task.id));
    });

    taskListEl.appendChild(card);
  });
}
