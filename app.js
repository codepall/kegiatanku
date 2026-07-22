import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, updateDoc, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Config Firebase
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
const modal = document.getElementById('modal');

// Modal Elements
const inputCategory = document.getElementById('input-category');
const fieldMapel = document.getElementById('field-mapel');
const fieldOrgSub = document.getElementById('field-org-sub');
const fieldOrgDuration = document.getElementById('field-org-duration');
const inputDurasiOrg = document.getElementById('input-durasi-org');
const blockTimeSingle = document.getElementById('block-time-single');
const blockTimeMulti = document.getElementById('block-time-multi');
const timeStartEndContainer = document.getElementById('time-start-end-container');
const labelDateSingle = document.getElementById('label-date-single');

let currentUser = null;
let allTasks = [];
let currentFilter = { type: 'status', value: 'all' };

document.getElementById('btn-toggle-sidebar').addEventListener('click', () => sidebar.classList.toggle('minimized'));

// Logika UI Form
inputCategory.addEventListener('change', (e) => {
  const cat = e.target.value;
  
  // Reset Display
  fieldMapel.style.display = 'none';
  fieldOrgSub.style.display = 'none';
  fieldOrgDuration.style.display = 'none';
  blockTimeMulti.style.display = 'none';
  blockTimeSingle.style.display = 'block';
  timeStartEndContainer.style.display = 'flex';
  labelDateSingle.textContent = 'Tanggal Kegiatan';

  if (cat === 'PR') {
    fieldMapel.style.display = 'flex';
    timeStartEndContainer.style.display = 'none'; // Sembunyikan Jam untuk PR
    labelDateSingle.textContent = 'Tanggal Deadline PR';
  } 
  else if (cat === 'Organisasi') {
    fieldOrgSub.style.display = 'flex';
    fieldOrgDuration.style.display = 'flex';
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

// Auth & Setup
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
    startNotificationChecker();
  } else {
    currentUser = null;
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
  }
});

document.getElementById('btn-login').addEventListener('click', async () => {
  try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
  catch (error) { loginError.textContent = 'Gagal login: Periksa kembali.'; }
});
document.getElementById('btn-register').addEventListener('click', async () => {
  if(document.getElementById('login-password').value.length < 6) return loginError.textContent = 'Password min 6 karakter!';
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

document.getElementById('btn-add-task').addEventListener('click', () => {
  document.getElementById('input-title').value = '';
  inputCategory.value = 'Umum';
  inputCategory.dispatchEvent(new Event('change'));
  modal.classList.add('active');
});
document.getElementById('btn-cancel').addEventListener('click', () => modal.classList.remove('active'));

// PERBAIKAN LOGIKA SIMPAN (Anti Error Firebase)
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
    notified_hmin1: false, // Untuk PR (Jam 15.00)
    notified_hday: false,  // Untuk PR (Jam 05.00)
    createdAt: new Date()
  };

  // Validasi Ketat & Penugasan Nilai berdasarkan Kategori Aktif
  if (category === 'PR') {
    payload.mapel = document.getElementById('input-mapel').value;
    payload.date = document.getElementById('input-date-single').value;
    if(!payload.date) return alert('Lengkapi tanggal deadline PR!');
  } 
  else if (category === 'Organisasi') {
    payload.subOrg = document.getElementById('input-sub-org').value;
    if (inputDurasiOrg.value === 'multi') {
      payload.dateStart = document.getElementById('input-date-start-multi').value;
      payload.dateEnd = document.getElementById('input-date-end-multi').value;
      payload.timeStart = document.getElementById('input-time-multi').value;
      payload.isMultiDay = true;
      if(!payload.dateStart || !payload.dateEnd || !payload.timeStart) return alert('Lengkapi tanggal dan jam!');
    } else {
      payload.date = document.getElementById('input-date-single').value;
      payload.timeStart = document.getElementById('input-time-start').value;
      payload.timeEnd = document.getElementById('input-time-end').value;
      payload.isMultiDay = false;
      if(!payload.date || !payload.timeStart || !payload.timeEnd) return alert('Lengkapi tanggal dan jam!');
    }
  } 
  else { // Umum
    payload.date = document.getElementById('input-date-single').value;
    payload.timeStart = document.getElementById('input-time-start').value;
    payload.timeEnd = document.getElementById('input-time-end').value;
    payload.isMultiDay = false;
    if(!payload.date || !payload.timeStart || !payload.timeEnd) return alert('Lengkapi tanggal dan jam!');
  }

  // Hapus semua properties yang bernilai undefined dari payload agar tidak ditolak Firebase
  Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

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
      timeDisplay = `<span>📅 Deadline: ${task.date}</span>`;
    } else {
      if(task.category === 'Organisasi') {
        badgeClass = 'badge-org';
        extraInfo = `<span>🏷️ ${task.subOrg}</span>`;
      }
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

// Sistem Pengecekan Notifikasi Cerdas
function startNotificationChecker() {
  setInterval(() => {
    if (Notification.permission === "granted") {
      const now = new Date();
      const currentHour = now.getHours();
      
      // Ambil format YYYY-MM-DD hari ini
      const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      
      allTasks.forEach(async (task) => {
        if (task.completed) return;

        if (task.category === 'PR') {
          // Logika PR: H-1 Jam 15.00 dan Hari H Jam 05.00
          const deadlineDate = new Date(`${task.date}T00:00:00`);
          const timeDiff = deadlineDate.getTime() - now.getTime();
          const daysDiff = timeDiff / (1000 * 3600 * 24);

          // Jika sisa waktu antara 0 sampai 1.5 hari (H-1) dan jam menunjukkan pukul 15.00
          if (daysDiff > 0 && daysDiff <= 1.5 && !task.notified_hmin1 && currentHour === 15) {
            new Notification("Pengingat PR!", { body: `Besok ada deadline PR ${task.mapel}: ${task.title}. Jangan lupa dikerjakan ya!` });
            await updateDoc(doc(db, "tasks", task.id), { notified_hmin1: true });
          }
          
          // Jika hari ini adalah hari deadline (Hari H) dan jam menunjukkan pukul 05.00 pagi
          if (task.date === todayStr && !task.notified_hday && currentHour === 5) {
            new Notification("Deadline PR Hari Ini!", { body: `Pagi! Hari ini PR ${task.mapel}: ${task.title} harus dikumpulkan!` });
            await updateDoc(doc(db, "tasks", task.id), { notified_hday: true });
          }
        } 
        else {
          // Logika Normal & Organisasi: 30 Menit Sebelum Acara (Hanya untuk 1 Hari)
          if (!task.notified && !task.isMultiDay && task.timeStart) {
            const taskDateTime = new Date(`${task.date}T${task.timeStart}`);
            const diffMinutes = (taskDateTime - now) / 1000 / 60;
            
            if (diffMinutes > 0 && diffMinutes <= 30) {
              const label = task.category === 'Organisasi' ? task.subOrg : task.category;
              new Notification("Pengingat Jadwal!", { body: `Kegiatan [${label}] "${task.title}" akan dimulai dalam ${Math.round(diffMinutes)} menit.` });
              await updateDoc(doc(db, "tasks", task.id), { notified: true });
            }
          }
        }
      });
    }
  }, 60000); // Berjalan setiap 1 Menit
}
