import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, updateDoc, deleteDoc, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// Data Pengaturan Kustom User (Default)
let userSettings = {
  kategori: ['Umum', 'PR', 'Organisasi', 'Pribadi', 'Tinkering'],
  mapel: ['BIN', 'BK', 'BIG', 'IPS', 'PPKn', 'Informatika', 'IPA', 'MAT', 'BJ', 'SB', 'PAI', 'PJOK'],
  organisasi: ['PMR', 'OSIS', 'Kader Bank Sampah', 'Kader Keamanan Pangan']
};

let currentUser = null;
let allTasks = [];
let currentFilter = { type: 'status', value: 'all' };

// DOM
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const taskListEl = document.getElementById('task-list');
const modal = document.getElementById('modal');
const modalSettings = document.getElementById('modal-settings');

// Input DOM
const inputCategory = document.getElementById('input-category');
const inputMapel = document.getElementById('input-mapel');
const inputSubOrg = document.getElementById('input-sub-org');

// --- SISTEM PENGATURAN KUSTOM (CRUD) ---
async function loadUserSettings() {
  const docRef = doc(db, "userSettings", currentUser.uid);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    userSettings = docSnap.data();
  } else {
    await setDoc(docRef, userSettings); // Simpan default jika baru pertama kali
  }
  applySettingsToUI();
}

async function saveUserSettings() {
  await setDoc(doc(db, "userSettings", currentUser.uid), userSettings);
  applySettingsToUI();
}

function applySettingsToUI() {
  // 1. Update Dropdown di Modal Tambah Kegiatan
  inputCategory.innerHTML = userSettings.kategori.map(c => `<option value="${c}">${c}</option>`).join('');
  inputMapel.innerHTML = userSettings.mapel.map(m => `<option value="${m}">${m}</option>`).join('');
  inputSubOrg.innerHTML = userSettings.organisasi.map(o => `<option value="${o}">${o}</option>`).join('');

  // 2. Update Kategori di Sidebar
  const sidebarCat = document.getElementById('dynamic-categories-sidebar');
  sidebarCat.innerHTML = userSettings.kategori.map(c => `
    <li class="nav-item" data-filter="category" data-value="${c}">
      <i class="ph ph-folder"></i> <span class="sidebar-text">${c}</span>
    </li>
  `).join('');
  
  // Re-attach event listener ke sidebar yang baru di-render
  attachSidebarListeners();

  // 3. Update UI List di Modal Pengaturan
  renderSettingsList('list-cat', userSettings.kategori, 'kategori');
  renderSettingsList('list-mapel', userSettings.mapel, 'mapel');
  renderSettingsList('list-org', userSettings.organisasi, 'organisasi');
}

function renderSettingsList(ulId, dataArray, settingKey) {
  const ul = document.getElementById(ulId);
  ul.innerHTML = dataArray.map(item => `
    <li>${item} <button class="btn-del-setting" data-val="${item}" data-key="${settingKey}"><i class="ph ph-x"></i></button></li>
  `).join('');
}

// Fungsi Generic untuk Tambah/Hapus Pengaturan
function setupSettingCRUD(inputId, btnAddId, settingKey) {
  document.getElementById(btnAddId).addEventListener('click', async () => {
    const val = document.getElementById(inputId).value.trim();
    if(val && !userSettings[settingKey].includes(val)) {
      userSettings[settingKey].push(val);
      document.getElementById(inputId).value = '';
      await saveUserSettings();
    }
  });
}
setupSettingCRUD('new-cat', 'btn-add-cat', 'kategori');
setupSettingCRUD('new-mapel', 'btn-add-mapel', 'mapel');
setupSettingCRUD('new-org', 'btn-add-org', 'organisasi');

// Delegasi Event Hapus Pengaturan (Hanya butuh 1 event listener untuk semua tombol X)
document.getElementById('modal-settings').addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-del-setting');
  if (btn) {
    const val = btn.getAttribute('data-val');
    const key = btn.getAttribute('data-key');
    userSettings[key] = userSettings[key].filter(item => item !== val);
    await saveUserSettings();
  }
});

document.getElementById('btn-open-settings').addEventListener('click', () => modalSettings.classList.add('active'));
document.getElementById('btn-close-settings').addEventListener('click', () => modalSettings.classList.remove('active'));

// --- LOGIKA FORM KEGIATAN DINAMIS ---
inputCategory.addEventListener('change', (e) => {
  const cat = e.target.value;
  document.getElementById('field-mapel').style.display = 'none';
  document.getElementById('field-org-sub').style.display = 'none';
  document.getElementById('field-org-duration').style.display = 'none';
  document.getElementById('block-time-multi').style.display = 'none';
  document.getElementById('block-time-single').style.display = 'block';
  document.getElementById('time-start-end-container').style.display = 'flex';
  document.getElementById('label-date-single').textContent = 'Tanggal Kegiatan';

  if (cat === 'PR') { // Fitur Khusus PR
    document.getElementById('field-mapel').style.display = 'flex';
    document.getElementById('time-start-end-container').style.display = 'none';
    document.getElementById('label-date-single').textContent = 'Tanggal Deadline PR';
  } 
  else if (cat === 'Organisasi') { // Fitur Khusus Organisasi
    document.getElementById('field-org-sub').style.display = 'flex';
    document.getElementById('field-org-duration').style.display = 'flex';
    document.getElementById('input-durasi-org').dispatchEvent(new Event('change'));
  }
});

document.getElementById('input-durasi-org').addEventListener('change', (e) => {
  if (e.target.value === 'multi') {
    document.getElementById('block-time-single').style.display = 'none';
    document.getElementById('block-time-multi').style.display = 'block';
  } else {
    document.getElementById('block-time-single').style.display = 'block';
    document.getElementById('block-time-multi').style.display = 'none';
  }
});

// --- AUTH & CORE ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    loginScreen.classList.remove('active');
    appScreen.classList.add('active');
    
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    
    const dName = user.email.split("@")[0];
    document.getElementById('user-name').textContent = dName.charAt(0).toUpperCase() + dName.slice(1);
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${dName}&background=8a9e86&color=fff&bold=true`;
    
    await loadUserSettings(); // Load custom settings
    fetchTasksFromDB();
    startNotificationChecker();
  } else {
    currentUser = null;
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
  }
});

// Login Handlers
document.getElementById('btn-login').addEventListener('click', async () => {
  try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
  catch (error) { document.getElementById('login-error').textContent = 'Gagal login.'; }
});
document.getElementById('btn-register').addEventListener('click', async () => {
  try { await createUserWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
  catch (error) { document.getElementById('login-error').textContent = 'Gagal daftar.'; }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

// Sidebar Toggle
document.getElementById('btn-toggle-sidebar').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('minimized'));
document.getElementById('btn-cancel').addEventListener('click', () => modal.classList.remove('active'));
document.getElementById('btn-add-task').addEventListener('click', () => {
  document.getElementById('input-title').value = '';
  inputCategory.dispatchEvent(new Event('change'));
  modal.classList.add('active');
});

// Sidebar Logic (Harus dipanggil ulang setelah render list kategori)
function attachSidebarListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      // Abaikan jika yang diklik adalah tombol pengaturan
      if (item.id === 'btn-open-settings') return;
      
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentFilter = { type: item.getAttribute('data-filter'), value: item.getAttribute('data-value') };
      document.getElementById('header-subtitle').textContent = `Menampilkan: ${item.querySelector('.sidebar-text').textContent}`;
      renderTasksUI();
    });
  });
}

// --- BUG FIX: PERBAIKAN LOGIKA SIMPAN & FETCH DB ---
document.getElementById('btn-save').addEventListener('click', async () => {
  const btnSave = document.getElementById('btn-save');
  const title = document.getElementById('input-title').value;
  const category = inputCategory.value;

  if (!title) return alert('Mohon isi Judul Kegiatan!');

  let payload = {
    uid: currentUser.uid,
    title: title,
    category: category,
    completed: false,
    notified: false,
    notified_hmin1: false,
    notified_hday: false,
    createdAt: new Date()
  };

  if (category === 'PR') {
    payload.mapel = document.getElementById('input-mapel').value;
    payload.date = document.getElementById('input-date-single').value;
    if(!payload.date) return alert('Lengkapi tanggal!');
  } else if (category === 'Organisasi' && document.getElementById('input-durasi-org').value === 'multi') {
    payload.subOrg = document.getElementById('input-sub-org').value;
    payload.dateStart = document.getElementById('input-date-start-multi').value;
    payload.dateEnd = document.getElementById('input-date-end-multi').value;
    payload.timeStart = document.getElementById('input-time-multi').value;
    payload.isMultiDay = true;
    if(!payload.dateStart || !payload.dateEnd || !payload.timeStart) return alert('Lengkapi data!');
  } else {
    // Normal / Umum / Kustom
    if (category === 'Organisasi') payload.subOrg = document.getElementById('input-sub-org').value;
    payload.date = document.getElementById('input-date-single').value;
    payload.timeStart = document.getElementById('input-time-start').value;
    payload.timeEnd = document.getElementById('input-time-end').value;
    payload.isMultiDay = false;
    if(!payload.date || !payload.timeStart || !payload.timeEnd) return alert('Lengkapi data!');
  }

  // Hapus semua properties yang bernilai undefined dari payload agar tidak ditolak Firebase
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

  try {
    btnSave.textContent = "Menyimpan...";
    await addDoc(collection(db, "tasks"), payload);
    modal.classList.remove('active');
  } catch (error) { 
    console.error(error); 
    alert("Gagal menyimpan.");
  } finally { btnSave.textContent = "Simpan"; }
});

// BUG FIX: Hapus `orderBy` di query agar tidak butuh Composite Index, lalu sort manual di JS.
function fetchTasksFromDB() {
  const q = query(collection(db, "tasks"), where("uid", "==", currentUser.uid));
  onSnapshot(q, (snapshot) => {
    allTasks = [];
    snapshot.forEach(docSnap => { allTasks.push({ id: docSnap.id, ...docSnap.data() }); });
    
    // Sort manual: yang terbaru ada di atas
    allTasks.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    renderTasksUI();
  });
}

function renderTasksUI() {
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
    let extraInfo = '';
    let timeDisplay = '';
    
    // Fallback UI
    if (task.category === 'PR') {
      extraInfo = `<span>📚 ${task.mapel}</span>`;
      timeDisplay = `<span>📅 Deadline: ${task.date}</span>`;
    } else {
      if (task.category === 'Organisasi') extraInfo = `<span>🏷️ ${task.subOrg}</span>`;
      if (task.isMultiDay) {
        timeDisplay = `<span>📅 ${task.dateStart} s/d ${task.dateEnd}</span> <span>⏰ Jam: ${task.timeStart}</span>`;
      } else {
        timeDisplay = `<span>📅 ${task.date}</span> <span>⏰ ${task.timeStart} - ${task.timeEnd}</span>`;
      }
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
            <span style="background:var(--sage-light); color:var(--sage-dark)">${task.category}</span>
            ${extraInfo}
          </div>
        </div>
      </div>
      <button class="btn-delete"><i class="ph ph-trash"></i></button>
    `;

    card.querySelector('.task-checkbox').addEventListener('change', async (e) => await updateDoc(doc(db, "tasks", task.id), { completed: e.target.checked }));
    card.querySelector('.btn-delete').addEventListener('click', async () => { if(confirm(`Hapus?`)) await deleteDoc(doc(db, "tasks", task.id)); });
    
    taskListEl.appendChild(card);
  });
}

function startNotificationChecker() {
  setInterval(async () => {
    if (Notification.permission === "granted") {
      const now = new Date();
      const currentHour = now.getHours();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      
      for (const task of allTasks) {
        if (task.completed) continue;
        if (task.category === 'PR') {
          const deadlineDate = new Date(`${task.date}T00:00:00`);
          const daysDiff = (deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
          if (daysDiff > 0 && daysDiff <= 1.5 && !task.notified_hmin1 && currentHour === 15) {
            new Notification("Pengingat PR!", { body: `Besok deadline: ${task.title}.` });
            await updateDoc(doc(db, "tasks", task.id), { notified_hmin1: true });
          }
          if (task.date === todayStr && !task.notified_hday && currentHour === 5) {
            new Notification("Deadline PR Hari Ini!", { body: `Segera kumpulkan: ${task.title}!` });
            await updateDoc(doc(db, "tasks", task.id), { notified_hday: true });
          }
        } 
        else {
          if (!task.notified && !task.isMultiDay && task.timeStart) {
            const taskDateTime = new Date(`${task.date}T${task.timeStart}`);
            const diffMinutes = (taskDateTime - now) / 1000 / 60;
            if (diffMinutes > 0 && diffMinutes <= 30) {
              new Notification("Pengingat Jadwal!", { body: `"${task.title}" akan dimulai dalam ${Math.round(diffMinutes)} menit.` });
              await updateDoc(doc(db, "tasks", task.id), { notified: true });
            }
          }
        }
      }
    }
  }, 60000);
}
