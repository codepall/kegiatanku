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

// Data Pengaturan Kategori Default 
let userCategories = [
  {
    name: "PR",
    subs: ["BIN", "BK", "BIG", "IPS", "PPKn", "Informatika", "IPA", "MAT", "BJ", "SB", "PAI", "PJOK"],
    longDate: false, timeRange: false, deadline: true, startTime: false
  },
  {
    name: "Organisasi",
    subs: ["PMR", "OSIS", "Kader Bank Sampah", "Kader Keamanan Pangan"],
    longDate: true, timeRange: false, deadline: false, startTime: true
  },
  {
    name: "Umum",
    subs: [],
    longDate: false, timeRange: true, deadline: false, startTime: false
  }
];

let currentUser = null;
let allTasks = [];
let currentFilter = { type: 'status', value: 'all' };

// --- SISTEM PENGATURAN KATEGORI (CRUD) ---
async function loadUserSettings() {
  const docSnap = await getDoc(doc(db, "userSettings", currentUser.uid));
  if (docSnap.exists()) {
    userCategories = docSnap.data().categories;
  } else {
    await setDoc(doc(db, "userSettings", currentUser.uid), { categories: userCategories });
  }
  applyCategoriesToUI();
}

async function saveUserSettings() {
  await setDoc(doc(db, "userSettings", currentUser.uid), { categories: userCategories });
  applyCategoriesToUI();
}

function applyCategoriesToUI() {
  // Update Dropdown Modal
  document.getElementById('input-category').innerHTML = userCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  
  // Update Sidebar
  document.getElementById('dynamic-categories-sidebar').innerHTML = userCategories.map(c => `
    <li class="nav-item" data-filter="category" data-value="${c.name}">
      <i class="ph ph-folder"></i> <span class="sidebar-text">${c.name}</span>
    </li>
  `).join('');
  attachSidebarListeners();

  // Update List Pengaturan
  document.getElementById('list-categories').innerHTML = userCategories.map(c => `
    <li>
      <div class="cat-info">
        <h5>${c.name}</h5>
        <p>Sub: ${c.subs.length ? c.subs.join(', ') : '-'}</p>
        <p>Opsi: ${[c.longDate?'Tgl Panjang':'', c.timeRange?'Lama Wkt':'', c.deadline?'Deadline':'', c.startTime?'Jam Mulai':''].filter(Boolean).join(', ')}</p>
      </div>
      <button class="btn-del-cat" data-name="${c.name}"><i class="ph ph-trash"></i></button>
    </li>
  `).join('');
}

// Tambah / Edit Kategori
document.getElementById('btn-save-cat').addEventListener('click', async () => {
  const name = document.getElementById('set-cat-name').value.trim();
  if(!name) return alert("Nama Kategori tidak boleh kosong!");

  const subsRaw = document.getElementById('set-sub-cat').value;
  const newCat = {
    name: name,
    subs: subsRaw ? subsRaw.split(',').map(s => s.trim()).filter(s => s) : [],
    longDate: document.getElementById('chk-longdate').checked,
    timeRange: document.getElementById('chk-timerange').checked,
    deadline: document.getElementById('chk-deadline').checked,
    startTime: document.getElementById('chk-starttime').checked
  };

  const existingIdx = userCategories.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  if(existingIdx >= 0) userCategories[existingIdx] = newCat; // Update
  else userCategories.push(newCat); // Tambah Baru

  // Reset form
  document.getElementById('set-cat-name').value = '';
  document.getElementById('set-sub-cat').value = '';
  document.querySelectorAll('.chk-label input').forEach(chk => chk.checked = false);

  await saveUserSettings();
});

// Hapus Kategori
document.getElementById('list-categories').addEventListener('click', async (e) => {
  const btn = e.target.closest('.btn-del-cat');
  if(btn && confirm("Hapus kategori ini?")) {
    userCategories = userCategories.filter(c => c.name !== btn.getAttribute('data-name'));
    await saveUserSettings();
  }
});

// --- LOGIKA UI FORM DINAMIS (MEMBACA CHECKBOX) ---
document.getElementById('input-category').addEventListener('change', (e) => {
  const cat = userCategories.find(c => c.name === e.target.value);
  if(!cat) return;

  const fSub = document.getElementById('field-sub-category');
  const inSub = document.getElementById('input-sub-category');
  if(cat.subs.length) {
    fSub.style.display = 'flex';
    inSub.innerHTML = cat.subs.map(s => `<option value="${s}">${s}</option>`).join('');
  } else {
    fSub.style.display = 'none';
  }

  document.getElementById('field-long-date').style.display = cat.longDate ? 'flex' : 'none';
  document.getElementById('field-time-range').style.display = cat.timeRange ? 'flex' : 'none';
  document.getElementById('field-deadline').style.display = cat.deadline ? 'flex' : 'none';
  document.getElementById('field-start-time').style.display = (cat.startTime && !cat.timeRange) ? 'flex' : 'none';
  
  // Jika tidak ada pengaturan tanggal sama sekali, tampilkan tanggal default agar bisa disimpan
  document.getElementById('field-default-date').style.display = (!cat.longDate && !cat.deadline) ? 'flex' : 'none';
});

// Modal Controls
document.getElementById('btn-open-settings').addEventListener('click', () => document.getElementById('modal-settings').classList.add('active'));
document.getElementById('btn-close-settings').addEventListener('click', () => document.getElementById('modal-settings').classList.remove('active'));
document.getElementById('btn-cancel').addEventListener('click', () => document.getElementById('modal').classList.remove('active'));
document.getElementById('btn-add-task').addEventListener('click', () => {
  document.getElementById('input-title').value = '';
  if(userCategories.length > 0) {
    document.getElementById('input-category').value = userCategories[0].name;
    document.getElementById('input-category').dispatchEvent(new Event('change'));
  }
  document.getElementById('modal').classList.add('active');
});

// --- CORE APP (Auth, Simpan, Render) ---
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('active');
    if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    
    const dName = user.email.split("@")[0];
    document.getElementById('user-name').textContent = dName.charAt(0).toUpperCase() + dName.slice(1);
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${dName}&background=8a9e86&color=fff&bold=true`;
    
    await loadUserSettings();
    fetchTasksFromDB();
    startNotificationChecker();
  } else {
    currentUser = null;
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
  }
});

// Login & Logout
document.getElementById('btn-login').addEventListener('click', async () => {
  try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
  catch (error) { document.getElementById('login-error').textContent = 'Gagal login.'; }
});
document.getElementById('btn-register').addEventListener('click', async () => {
  try { await createUserWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } 
  catch (error) { document.getElementById('login-error').textContent = 'Gagal daftar.'; }
});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

function attachSidebarListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.id === 'btn-open-settings') return;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      currentFilter = { type: item.getAttribute('data-filter'), value: item.getAttribute('data-value') };
      document.getElementById('header-subtitle').textContent = `Menampilkan: ${item.querySelector('.sidebar-text').textContent}`;
      renderTasksUI();
    });
  });
}

document.getElementById('btn-toggle-sidebar').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('minimized'));

// MENYIMPAN DATA (Sesuai Kategori Aktif)
document.getElementById('btn-save').addEventListener('click', async () => {
  const btnSave = document.getElementById('btn-save');
  const title = document.getElementById('input-title').value;
  const catName = document.getElementById('input-category').value;
  const cat = userCategories.find(c => c.name === catName);

  if (!title) return alert('Mohon isi Judul Kegiatan!');

  let payload = {
    uid: currentUser.uid, title: title, category: catName,
    completed: false, notified: false, notified_hmin1: false, notified_hday: false,
    createdAt: new Date()
  };

  if(cat.subs.length) payload.subCategory = document.getElementById('input-sub-category').value;
  if(cat.longDate) {
    payload.dateStart = document.getElementById('val-date-start').value;
    payload.dateEnd = document.getElementById('val-date-end').value;
    if(!payload.dateStart || !payload.dateEnd) return alert("Isi tanggal mulai & selesai!");
  }
  if(cat.deadline) {
    payload.dateDeadline = document.getElementById('val-date-deadline').value;
    if(!payload.dateDeadline) return alert("Isi tanggal deadline!");
  }
  if(!cat.longDate && !cat.deadline) {
    payload.date = document.getElementById('val-default-date').value;
    if(!payload.date) return alert("Isi tanggal kegiatan!");
  }

  if(cat.timeRange) {
    payload.timeStart = document.getElementById('val-time-start').value;
    payload.timeEnd = document.getElementById('val-time-end').value;
  } else if(cat.startTime) {
    payload.timeStart = document.getElementById('val-time-only').value;
  }

  Object.keys(payload).forEach(k => (payload[k] === undefined || payload[k] === "") && delete payload[k]);

  try {
    btnSave.textContent = "Menyimpan...";
    await addDoc(collection(db, "tasks"), payload);
    document.getElementById('modal').classList.remove('active');
  } catch (error) { 
    console.error(error); alert("Gagal menyimpan.");
  } finally { btnSave.textContent = "Simpan"; }
});

function fetchTasksFromDB() {
  onSnapshot(query(collection(db, "tasks"), where("uid", "==", currentUser.uid)), (snapshot) => {
    allTasks = [];
    snapshot.forEach(docSnap => { allTasks.push({ id: docSnap.id, ...docSnap.data() }); });
    allTasks.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    renderTasksUI();
  });
}

function renderTasksUI() {
  const listEl = document.getElementById('task-list');
  listEl.innerHTML = '';
  
  let filtered = allTasks;
  if (currentFilter.type === 'status') filtered = allTasks.filter(t => currentFilter.value === 'pending' ? !t.completed : (currentFilter.value === 'completed' ? t.completed : true));
  else if (currentFilter.type === 'category') filtered = allTasks.filter(t => t.category === currentFilter.value);

  if (!filtered.length) return listEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;">Belum ada kegiatan.</p>`;

  filtered.forEach(task => {
    let tDisp = '';
    if(task.dateStart && task.dateEnd) tDisp += `📅 ${task.dateStart} s/d ${task.dateEnd} `;
    else if(task.dateDeadline) tDisp += `📅 Deadline: ${task.dateDeadline} `;
    else if(task.date) tDisp += `📅 ${task.date} `;

    if(task.timeStart && task.timeEnd) tDisp += `| ⏰ ${task.timeStart} - ${task.timeEnd}`;
    else if(task.timeStart) tDisp += `| ⏰ Jam: ${task.timeStart}`;

    let subDisp = task.subCategory ? `<span style="background:rgba(255,255,255,0.8); border:1px solid #ddd; padding:4px 8px; border-radius:6px; font-weight:600; color:var(--sage-dark)">🏷️ ${task.subCategory}</span>` : '';

    const card = document.createElement('div');
    card.className = `task-card glass-panel ${task.completed ? 'completed' : ''}`;
    card.innerHTML = `
      <div class="task-info">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <div class="task-details">
          <h3>${task.title}</h3>
          <div class="task-meta">
            <span>${tDisp}</span>
            <span style="background:var(--sage-light); color:var(--sage-dark); font-weight:600; padding:4px 8px; border-radius:6px;">${task.category}</span>
            ${subDisp}
          </div>
        </div>
      </div>
      <button class="btn-delete"><i class="ph ph-trash"></i></button>
    `;
    card.querySelector('.task-checkbox').addEventListener('change', async (e) => await updateDoc(doc(db, "tasks", task.id), { completed: e.target.checked }));
    card.querySelector('.btn-delete').addEventListener('click', async () => { if(confirm(`Hapus?`)) await deleteDoc(doc(db, "tasks", task.id)); });
    listEl.appendChild(card);
  });
}

function startNotificationChecker() {
  setInterval(async () => {
    if (Notification.permission === "granted") {
      const now = new Date();
      const currentH = now.getHours();
      const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      
      for (const t of allTasks) {
        if (t.completed) continue;
        
        // Logika 1: Deadline (H-1 Jam 15.00 & Hari H Jam 05.00)
        if (t.dateDeadline) {
          const dDate = new Date(`${t.dateDeadline}T00:00:00`);
          const daysDiff = (dDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
          if (daysDiff > 0 && daysDiff <= 1.5 && !t.notified_hmin1 && currentH === 15) {
            new Notification("Pengingat Jadwal!", { body: `Besok ada Deadline ${t.category}: ${t.title}.` });
            await updateDoc(doc(db, "tasks", t.id), { notified_hmin1: true });
          }
          if (t.dateDeadline === today && !t.notified_hday && currentH === 5) {
            new Notification("Deadline Hari Ini!", { body: `Segera tuntaskan: ${t.title}!` });
            await updateDoc(doc(db, "tasks", t.id), { notified_hday: true });
          }
        }
        
        // Logika 2: Jam Mulai (30 Menit Sebelum Acara)
        if (t.timeStart && !t.notified) {
          const eventDate = t.dateStart || t.date || t.dateDeadline; // Baca tanggal yg relevan
          if(eventDate) {
            const eventTime = new Date(`${eventDate}T${t.timeStart}`);
            const minDiff = (eventTime - now) / 1000 / 60;
            if (minDiff > 0 && minDiff <= 30) {
              new Notification("Pengingat Kegiatan!", { body: `"${t.title}" akan dimulai dalam ${Math.round(minDiff)} menit.` });
              await updateDoc(doc(db, "tasks", t.id), { notified: true });
            }
          }
        }
      }
    }
  }, 60000);
}
