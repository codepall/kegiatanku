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

// Data Kategori & Jadwal Manual
let userCategories = [
  { name: "PR", icon: "ph-book-open", subs: ["BIN", "BK", "BIG", "IPS", "PPKn", "Informatika", "IPA", "MAT", "BJ", "SB", "PAI", "PJOK"], longDate: false, timeRange: false, deadline: true, startTime: false, finishFast: false }
];
let userSchedule = {}; 

let currentUser = null;
let allTasks = [];
let currentFilter = { type: 'status', value: 'all' };
let editCatMode = null;
let editingTaskId = null; 

const availableIcons = ['ph-folder', 'ph-book-open', 'ph-users', 'ph-briefcase', 'ph-graduation-cap', 'ph-code', 'ph-game-controller', 'ph-heart', 'ph-star', 'ph-cpu', 'ph-shopping-cart', 'ph-palette', 'ph-music-note', 'ph-camera', 'ph-calendar-check', 'ph-lightning', 'ph-push-pin'];

function renderIconPicker(selected = 'ph-folder') {
  const picker = document.getElementById('icon-picker');
  picker.innerHTML = availableIcons.map(icon => `
    <div class="icon-option ${icon === selected ? 'selected' : ''}" data-icon="${icon}">
      <i class="ph ${icon}"></i>
    </div>
  `).join('');
  document.getElementById('set-cat-icon').value = selected;
}

document.getElementById('icon-picker').addEventListener('click', (e) => {
  const opt = e.target.closest('.icon-option');
  if(opt) {
    document.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
    opt.classList.add('selected');
    document.getElementById('set-cat-icon').value = opt.getAttribute('data-icon');
  }
});

function formatDateIndo(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(y, m - 1, d);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${days[dateObj.getDay()]}, ${d} ${months[dateObj.getMonth()]} ${y}`;
}

// LOGIKA TEPAT WAKTU (Murni HARI H) MENGGUNAKAN LOKAL ZONA WAKTU
function getNextMeetingDate(subCat) {
  const daysArr = userSchedule[subCat];
  if (!daysArr || daysArr.length === 0) return ""; 
  const today = new Date();
  let currentDay = today.getDay(); 
  let diff = 1; 
  while(diff <= 7) {
    let checkDay = (currentDay + diff) % 7;
    if(daysArr.includes(checkDay)) {
      let nextDate = new Date(today);
      nextDate.setDate(today.getDate() + diff);
      // Mencegah error UTC yang bikin mundur 1 hari (H-1)
      const y = nextDate.getFullYear();
      const m = String(nextDate.getMonth() + 1).padStart(2, '0');
      const d = String(nextDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    diff++;
  }
  return "";
}

function getTomorrowDate() {
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  const y = tmrw.getFullYear();
  const m = String(tmrw.getMonth() + 1).padStart(2, '0');
  const d = String(tmrw.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// --- SIDEBAR & OVERLAY LOGIC ---
if (window.innerWidth <= 768) {
  document.getElementById('sidebar').classList.add('minimized');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar.classList.toggle('minimized');
  if (!sidebar.classList.contains('minimized')) overlay.classList.add('active');
  else overlay.classList.remove('active');
}

document.getElementById('btn-toggle-sidebar').addEventListener('click', (e) => { 
  e.stopPropagation(); 
  toggleSidebar();
});

document.getElementById('sidebar-overlay').addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('minimized');
  document.getElementById('sidebar-overlay').classList.remove('active');
});

document.getElementById('sidebar-nav').addEventListener('click', (e) => {
  const item = e.target.closest('.nav-item');
  if (!item) return;

  if (item.id === 'btn-open-settings') {
    resetCatForm(); 
    document.getElementById('modal-settings').classList.add('active');
    return;
  }
  if (item.id === 'btn-open-schedule') {
    renderScheduleModal();
    document.getElementById('modal-schedule').classList.add('active');
    return;
  }

  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  item.classList.add('active');
  
  currentFilter = { type: item.getAttribute('data-filter'), value: item.getAttribute('data-value') };
  document.getElementById('search-date-input').value = ''; // Reset pencarian jika klik menu kiri
  
  if (window.innerWidth > 768) { 
    document.getElementById('header-subtitle').textContent = `Menampilkan: ${item.querySelector('.sidebar-text').textContent}`; 
  }
  
  renderTasksUI();
  document.getElementById('sidebar').classList.add('minimized');
  document.getElementById('sidebar-overlay').classList.remove('active');
});

// --- PENCARIAN BERDASARKAN TANGGAL ---
document.getElementById('search-date-input').addEventListener('change', (e) => {
  if (e.target.value) {
    currentFilter = { type: 'date', value: e.target.value };
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    renderTasksUI();
  } else {
    document.getElementById('sidebar-nav').querySelector('[data-value="all"]').click();
  }
});


// --- KATEGORI & SCHEDULE ---
async function loadUserSettings() {
  const docSnap = await getDoc(doc(db, "userSettings", currentUser.uid));
  if (docSnap.exists()) {
    const data = docSnap.data();
    userCategories = data.categories.map(c => ({...c, icon: c.icon || 'ph-folder'}));
    userSchedule = data.schedule || {};
  } else {
    await setDoc(doc(db, "userSettings", currentUser.uid), { categories: userCategories, schedule: userSchedule });
  }
  applyCategoriesToUI();
}

async function saveUserSettings() {
  await setDoc(doc(db, "userSettings", currentUser.uid), { categories: userCategories, schedule: userSchedule });
  applyCategoriesToUI();
}

function applyCategoriesToUI() {
  document.getElementById('input-category').innerHTML = userCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  document.getElementById('dynamic-categories-sidebar').innerHTML = userCategories.map(c => `
    <li class="nav-item" data-filter="category" data-value="${c.name}">
      <i class="ph ${c.icon}"></i> <span class="sidebar-text">${c.name}</span>
    </li>
  `).join('');

  document.getElementById('list-categories').innerHTML = userCategories.map(c => `
    <li>
      <div class="cat-info">
        <h5><i class="ph ${c.icon}" style="color:var(--sage-primary);"></i> ${c.name}</h5>
        <p>Sub: ${c.subs.length ? c.subs.join(', ') : '-'}</p>
        <p>Opsi: ${[c.longDate?'Tgl Panjang':'', c.timeRange?'Lama Wkt':'', c.deadline?'Deadline':'', c.startTime?'Jam Mulai':'', c.finishFast?'Tbl Selesai':''].filter(Boolean).join(', ')}</p>
      </div>
      <div class="cat-actions">
        <button class="btn-edit-cat" data-name="${c.name}"><i class="ph ph-pencil"></i></button>
        <button class="btn-del-cat" data-name="${c.name}"><i class="ph ph-trash"></i></button>
      </div>
    </li>
  `).join('');
}

function renderScheduleModal() {
  const matrixContainer = document.getElementById('schedule-matrix');
  matrixContainer.innerHTML = '';
  
  let allSubs = [];
  userCategories.forEach(cat => {
    if (cat.deadline && cat.subs && cat.subs.length > 0) {
      allSubs.push(...cat.subs);
    }
  });

  allSubs = [...new Set(allSubs)]; 

  if (allSubs.length === 0) {
    matrixContainer.innerHTML = '<p style="font-size:12px; color:var(--text-muted); text-align:center;">Belum ada sub-kategori dengan opsi Deadline aktif.</p>';
    return;
  }

  const days = [ { id: 1, name: 'Sen' }, { id: 2, name: 'Sel' }, { id: 3, name: 'Rab' }, { id: 4, name: 'Kam' }, { id: 5, name: 'Jum' }, { id: 6, name: 'Sab' } ];

  allSubs.forEach(sub => {
    const currentDays = userSchedule[sub] || [];
    let daysHtml = days.map(d => {
      const isChecked = currentDays.includes(d.id) ? 'checked' : '';
      return `<label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;">
                <input type="checkbox" class="chk-day" data-sub="${sub}" value="${d.id}" ${isChecked} style="width:14px; height:14px; accent-color:var(--sage-primary);"> ${d.name}
              </label>`;
    }).join('');

    const row = document.createElement('div');
    row.style = "background:rgba(255,255,255,0.6); padding:10px; border-radius:10px; border:1px solid rgba(0,0,0,0.05);";
    row.innerHTML = `
      <div style="font-size:13px; font-weight:600; color:var(--sage-dark); margin-bottom:8px;">${sub}</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">${daysHtml}</div>
    `;
    matrixContainer.appendChild(row);
  });
}

document.getElementById('btn-save-schedule').addEventListener('click', async () => {
  const btn = document.getElementById('btn-save-schedule');
  btn.textContent = "Menyimpan...";
  
  userSchedule = {}; 
  document.querySelectorAll('.chk-day:checked').forEach(chk => {
    const sub = chk.getAttribute('data-sub');
    const dayId = parseInt(chk.value);
    if (!userSchedule[sub]) userSchedule[sub] = [];
    userSchedule[sub].push(dayId);
  });

  await saveUserSettings(); 
  document.getElementById('modal-schedule').classList.remove('active');
  btn.textContent = "Simpan Jadwal";
});


function updateFormInputs() {
  const cat = userCategories.find(c => c.name === document.getElementById('input-category').value);
  if(!cat) return;

  const fSub = document.getElementById('field-sub-category');
  if(cat.subs.length) {
    fSub.style.display = 'flex';
    document.getElementById('input-sub-category').innerHTML = cat.subs.map(s => `<option value="${s}">${s}</option>`).join('');
  } else { fSub.style.display = 'none'; }

  document.getElementById('field-long-date').style.display = cat.longDate ? 'flex' : 'none';
  document.getElementById('field-time-range').style.display = cat.timeRange ? 'flex' : 'none';
  
  if(cat.deadline) {
    if(cat.subs.length > 0) {
      document.getElementById('field-pr-deadline-type').style.display = 'flex';
      document.getElementById('val-pr-deadline-type').dispatchEvent(new Event('change'));
    } else {
      document.getElementById('field-pr-deadline-type').style.display = 'none';
      document.getElementById('field-deadline').style.display = 'flex';
    }
  } else {
    document.getElementById('field-pr-deadline-type').style.display = 'none';
    document.getElementById('field-deadline').style.display = 'none';
  }
  
  document.getElementById('field-start-time').style.display = (cat.startTime && !cat.timeRange) ? 'flex' : 'none';
  document.getElementById('field-default-date').style.display = (!cat.longDate && !cat.deadline) ? 'flex' : 'none';
}

document.getElementById('input-category').addEventListener('change', updateFormInputs);
document.getElementById('val-pr-deadline-type').addEventListener('change', (e) => {
  document.getElementById('field-deadline').style.display = (e.target.value === 'khusus') ? 'flex' : 'none';
});

// AUTH
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
document.getElementById('btn-login').addEventListener('click', async () => { try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } catch (e) { document.getElementById('login-error').textContent = 'Gagal login.'; }});
document.getElementById('btn-register').addEventListener('click', async () => { try { await createUserWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } catch (e) { document.getElementById('login-error').textContent = 'Gagal daftar.'; }});
document.getElementById('btn-logout').addEventListener('click', () => signOut(auth));

function resetCatForm() { 
  editCatMode = null; document.getElementById('set-cat-name').value = ''; document.getElementById('set-sub-cat').value = '';
  document.querySelectorAll('.chk-label input').forEach(chk => chk.checked = false);
  renderIconPicker('ph-folder');
  document.getElementById('btn-save-cat').textContent = "Simpan Kategori"; document.getElementById('btn-cancel-edit-cat').style.display = 'none';
}

document.getElementById('btn-cancel-edit-cat').addEventListener('click', resetCatForm);

document.getElementById('btn-save-cat').addEventListener('click', async () => {
  const name = document.getElementById('set-cat-name').value.trim();
  if(!name) return alert("Nama Kategori tidak boleh kosong!");
  
  const subsRaw = document.getElementById('set-sub-cat').value;
  const newCat = {
    name: name, icon: document.getElementById('set-cat-icon').value, subs: subsRaw ? subsRaw.split(',').map(s => s.trim()).filter(s => s) : [],
    longDate: document.getElementById('chk-longdate').checked, timeRange: document.getElementById('chk-timerange').checked,
    deadline: document.getElementById('chk-deadline').checked, startTime: document.getElementById('chk-starttime').checked, finishFast: document.getElementById('chk-finishfast').checked
  };
  
  if (editCatMode) {
    const idx = userCategories.findIndex(c => c.name === editCatMode); if(idx >= 0) userCategories[idx] = newCat;
    if (editCatMode !== name) {
      const tasksToUpdate = allTasks.filter(t => t.category === editCatMode);
      for (const t of tasksToUpdate) await updateDoc(doc(db, "tasks", t.id), { category: name });
    }
  } else {
    const existingIdx = userCategories.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
    if(existingIdx >= 0) userCategories[existingIdx] = newCat; else userCategories.push(newCat);
  }
  resetCatForm(); await saveUserSettings();
});

document.getElementById('list-categories').addEventListener('click', async (e) => {
  const btnDel = e.target.closest('.btn-del-cat'); const btnEdit = e.target.closest('.btn-edit-cat');
  if(btnDel && confirm("Hapus kategori ini? (Catatan: Kegiatan yg sudah ada di kategori ini tidak akan terhapus)")) {
    userCategories = userCategories.filter(c => c.name !== btnDel.getAttribute('data-name')); await saveUserSettings();
  }
  if(btnEdit) {
    const catName = btnEdit.getAttribute('data-name'); const cat = userCategories.find(c => c.name === catName);
    if(cat) {
      document.getElementById('set-cat-name').value = cat.name; document.getElementById('set-sub-cat').value = cat.subs.join(', ');
      document.getElementById('chk-longdate').checked = cat.longDate; document.getElementById('chk-timerange').checked = cat.timeRange;
      document.getElementById('chk-deadline').checked = cat.deadline; document.getElementById('chk-starttime').checked = cat.startTime;
      document.getElementById('chk-finishfast').checked = cat.finishFast;
      renderIconPicker(cat.icon || 'ph-folder');
      editCatMode = cat.name; document.getElementById('btn-save-cat').textContent = "Update Kategori"; document.getElementById('btn-cancel-edit-cat').style.display = 'inline-block';
    }
  }
});

// LOGIKA SILANG (X) UNTUK TUTUP SEMUA MODAL
document.querySelectorAll('.btn-close-modal').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.target.closest('.modal').classList.remove('active');
    editingTaskId = null;
  });
});

// --- SIMPAN & UPDATE KEGIATAN ---
document.getElementById('btn-add-task').addEventListener('click', () => {
  editingTaskId = null; document.getElementById('modal-form-title').textContent = "Buat Kegiatan Baru"; document.getElementById('btn-save').textContent = "Simpan Kegiatan";
  document.getElementById('input-title').value = ''; document.getElementById('input-notes').value = ''; 
  document.getElementById('val-date-start').value = ''; document.getElementById('val-date-end').value = '';
  document.getElementById('val-date-deadline').value = ''; document.getElementById('val-default-date').value = '';
  document.getElementById('val-time-start').value = ''; document.getElementById('val-time-end').value = '';
  document.getElementById('val-time-only').value = '';

  if(userCategories.length > 0) { document.getElementById('input-category').value = userCategories[0].name; updateFormInputs(); }
  document.getElementById('modal').classList.add('active');
});

document.getElementById('btn-save').addEventListener('click', async () => {
  const btnSave = document.getElementById('btn-save');
  const title = document.getElementById('input-title').value;
  const notes = document.getElementById('input-notes').value.trim();
  const catName = document.getElementById('input-category').value;
  const cat = userCategories.find(c => c.name === catName);

  if (!title) return alert('Mohon isi Judul Kegiatan!');

  let payload = { uid: currentUser.uid, title: title, category: catName, notes: notes, finishFast: cat.finishFast };
  
  if (!editingTaskId) {
    payload.completed = false; payload.pinned = false; payload.notified = false; payload.notified_hmin1 = false; payload.notified_hday = false; payload.createdAt = new Date();
  }

  if(cat.subs.length) payload.subCategory = document.getElementById('input-sub-category').value;
  
  if(cat.longDate) {
    payload.dateStart = document.getElementById('val-date-start').value; payload.dateEnd = document.getElementById('val-date-end').value;
    if(!payload.dateStart || !payload.dateEnd) return alert("Isi tanggal mulai & selesai!");
  }
  
  if(cat.deadline) {
    if(cat.subs.length > 0) {
      const type = document.getElementById('val-pr-deadline-type').value;
      if (type === 'besok') { payload.dateDeadline = getTomorrowDate(); } 
      else if (type === 'next_meeting') {
        const nextDate = getNextMeetingDate(payload.subCategory);
        if(!nextDate) return alert(`Jadwal untuk ${payload.subCategory} belum diatur! Silakan atur terlebih dahulu di menu 'Atur Jadwal'.`);
        payload.dateDeadline = nextDate;
      } else {
        payload.dateDeadline = document.getElementById('val-date-deadline').value;
        if(!payload.dateDeadline) return alert("Isi tanggal deadline khusus!");
      }
    } else {
      payload.dateDeadline = document.getElementById('val-date-deadline').value;
      if(!payload.dateDeadline) return alert("Isi tanggal deadline!");
    }
  }

  if(!cat.longDate && !cat.deadline) {
    payload.date = document.getElementById('val-default-date').value;
    if(!payload.date) return alert("Isi tanggal kegiatan!");
  }
  if(cat.timeRange) {
    payload.timeStart = document.getElementById('val-time-start').value; payload.timeEnd = document.getElementById('val-time-end').value;
  } else if(cat.startTime) {
    payload.timeStart = document.getElementById('val-time-only').value;
  }

  Object.keys(payload).forEach(k => (payload[k] === undefined || payload[k] === "") && delete payload[k]);

  try {
    btnSave.textContent = "Menyimpan...";
    if (editingTaskId) await updateDoc(doc(db, "tasks", editingTaskId), payload);
    else await addDoc(collection(db, "tasks"), payload);
    document.getElementById('modal').classList.remove('active');
    editingTaskId = null;
  } catch (error) { console.error(error); alert("Gagal menyimpan."); } finally { btnSave.textContent = "Simpan Kegiatan"; }
});


function fetchTasksFromDB() {
  onSnapshot(query(collection(db, "tasks"), where("uid", "==", currentUser.uid)), (snapshot) => {
    allTasks = [];
    snapshot.forEach(docSnap => { allTasks.push({ id: docSnap.id, ...docSnap.data() }); });
    renderTasksUI();
  });
}

function renderTasksUI() {
  const listEl = document.getElementById('task-list');
  listEl.innerHTML = '';
  
  let sortedTasks = [...allTasks].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (!a.completed && !b.completed) {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    }
    return b.createdAt.toMillis() - a.createdAt.toMillis();
  });

  let filtered = sortedTasks;
  const subtitle = document.getElementById('header-subtitle');

  // LOGIKA PENCARIAN TANGGAL
  if (currentFilter.type === 'date') {
    const targetDate = currentFilter.value;
    
    // Fungsi bantuan mengecek apakah tugas berlangsung di tanggal tsb
    const isOverlapping = (t, dateStr) => {
      if(t.date === dateStr || t.dateDeadline === dateStr) return true;
      if(t.dateStart && t.dateEnd) return (dateStr >= t.dateStart && dateStr <= t.dateEnd);
      return false;
    };

    let exactMatches = sortedTasks.filter(t => isOverlapping(t, targetDate));

    if (exactMatches.length > 0) {
      filtered = exactMatches;
      subtitle.textContent = `Menampilkan kegiatan tanggal ${formatDateIndo(targetDate)}`;
    } else {
      // Cari tanggal paling dekat SETELAH tanggal yang dicari
      let futureTasks = sortedTasks.filter(t => {
        let refDate = t.date || t.dateStart || t.dateDeadline;
        return refDate && refDate > targetDate;
      });

      if (futureTasks.length > 0) {
        futureTasks.sort((a, b) => {
          let da = a.date || a.dateStart || a.dateDeadline;
          let db = b.date || b.dateStart || b.dateDeadline;
          return new Date(da) - new Date(db);
        });
        
        let closestDate = futureTasks[0].date || futureTasks[0].dateStart || futureTasks[0].dateDeadline;
        filtered = sortedTasks.filter(t => isOverlapping(t, closestDate));
        subtitle.textContent = `Kosong. Menampilkan terdekat: ${formatDateIndo(closestDate)}`;
      } else {
        filtered = [];
        subtitle.textContent = `Tidak ada kegiatan di tanggal tersebut atau setelahnya.`;
      }
    }
  } else if (currentFilter.type === 'status') {
    filtered = sortedTasks.filter(t => currentFilter.value === 'pending' ? !t.completed : (currentFilter.value === 'completed' ? t.completed : true));
  } else if (currentFilter.type === 'category') {
    filtered = sortedTasks.filter(t => t.category === currentFilter.value);
  }

  if (!filtered.length) return listEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;">Belum ada kegiatan.</p>`;

  filtered.forEach(task => {
    let dateHtml = ''; let timeHtml = '';

    if(task.dateStart && task.dateEnd) {
      if (task.dateStart === task.dateEnd) { dateHtml = `<div class="meta-row"><i class="ph ph-calendar"></i> ${formatDateIndo(task.dateStart)}</div>`; } 
      else { dateHtml = `<div class="meta-row"><i class="ph ph-calendar"></i> ${formatDateIndo(task.dateStart)} s/d ${formatDateIndo(task.dateEnd)}</div>`; }
    } else if(task.dateDeadline) { dateHtml = `<div class="meta-row"><i class="ph ph-calendar"></i> Deadline: ${formatDateIndo(task.dateDeadline)}</div>`; } 
      else if(task.date) { dateHtml = `<div class="meta-row"><i class="ph ph-calendar"></i> ${formatDateIndo(task.date)}</div>`; }

    if(task.timeStart && task.timeEnd) { timeHtml = `<div class="meta-row"><i class="ph ph-clock"></i> ${task.timeStart} - ${task.timeEnd}</div>`; } 
    else if(task.timeStart) { timeHtml = `<div class="meta-row"><i class="ph ph-clock"></i> Mulai Jam ${task.timeStart}</div>`; }

    const catObj = userCategories.find(c => c.name === task.category);
    const iconClass = catObj ? catObj.icon : 'ph-folder';

    let subDisp = task.subCategory ? `<span>🏷️ ${task.subCategory}</span>` : '';
    let notesDisp = task.notes ? `<div class="notes-display">${task.notes}</div>` : '';
    let btnFinishFast = (task.finishFast && !task.completed) ? `<button class="btn-finish"><i class="ph ph-check-circle"></i> Selesai</button>` : '';
    
    let pinIcon = task.pinned ? 'ph-fill ph-push-pin' : 'ph ph-push-pin';
    let pinClass = task.pinned ? 'active' : '';
    let btnPinTask = !task.completed ? `<button class="btn-pin-task ${pinClass}"><i class="${pinIcon}"></i></button>` : '';

    const card = document.createElement('div');
    card.className = `task-card glass-panel ${task.completed ? 'completed' : ''} ${task.pinned && !task.completed ? 'is-pinned' : ''}`;
    card.innerHTML = `
      <div class="task-info">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <div class="task-details">
          <h3>${task.title}</h3>
          <div class="task-meta">
            <div class="meta-schedule">${dateHtml}${timeHtml}</div>
            <div class="meta-badges"><span class="badge-cat"><i class="ph ${iconClass}"></i> ${task.category}</span>${subDisp}</div>
          </div>
          ${notesDisp}
        </div>
      </div>
      <div class="task-actions">
        ${btnFinishFast}
        ${btnPinTask}
        <button class="btn-edit-task"><i class="ph ph-pencil"></i></button>
        <button class="btn-delete-task"><i class="ph ph-trash"></i></button>
      </div>
    `;
    
    card.querySelector('.task-checkbox').addEventListener('change', async (e) => {
      const isCompleted = e.target.checked;
      let updateData = { completed: isCompleted };
      if (isCompleted) updateData.pinned = false; 
      await updateDoc(doc(db, "tasks", task.id), updateData);
    });
    
    card.querySelector('.btn-delete-task').addEventListener('click', async () => { if(confirm(`Hapus?`)) await deleteDoc(doc(db, "tasks", task.id)); });
    
    if(!task.completed) {
      card.querySelector('.btn-pin-task').addEventListener('click', async () => {
        await updateDoc(doc(db, "tasks", task.id), { pinned: !task.pinned });
      });
    }

    card.querySelector('.btn-edit-task').addEventListener('click', () => {
      editingTaskId = task.id;
      document.getElementById('modal-form-title').textContent = "Edit Kegiatan";
      document.getElementById('btn-save').textContent = "Update";
      
      document.getElementById('input-title').value = task.title;
      document.getElementById('input-notes').value = task.notes || '';
      document.getElementById('input-category').value = task.category;
      updateFormInputs(); 

      setTimeout(() => {
        if(task.subCategory) document.getElementById('input-sub-category').value = task.subCategory;
        if(task.dateStart) document.getElementById('val-date-start').value = task.dateStart;
        if(task.dateEnd) document.getElementById('val-date-end').value = task.dateEnd;
        if(task.dateDeadline) {
          document.getElementById('val-pr-deadline-type').value = 'khusus';
          document.getElementById('val-pr-deadline-type').dispatchEvent(new Event('change'));
          document.getElementById('val-date-deadline').value = task.dateDeadline;
        }
        if(task.date) document.getElementById('val-default-date').value = task.date;
        if(task.timeStart) {
          document.getElementById('val-time-start').value = task.timeStart;
          document.getElementById('val-time-only').value = task.timeStart;
        }
        if(task.timeEnd) document.getElementById('val-time-end').value = task.timeEnd;
      }, 50);

      document.getElementById('modal').classList.add('active');
    });

    if(task.finishFast && !task.completed) {
      card.querySelector('.btn-finish').addEventListener('click', async () => {
        await updateDoc(doc(db, "tasks", task.id), { completed: true, pinned: false });
      });
    }

    listEl.appendChild(card);
  });
}

function startNotificationChecker() {
  setInterval(async () => {
    if (Notification.permission === "granted") {
      const now = new Date(); const currentH = now.getHours();
      
      // Ambil tanggal mutlak waktu lokal!
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const today = `${y}-${m}-${d}`;
      
      for (const t of allTasks) {
        if (t.completed) continue;
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
        if (t.timeStart && !t.notified) {
          const eventDate = t.dateStart || t.date || t.dateDeadline; 
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
