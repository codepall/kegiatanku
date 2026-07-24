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

let userCategories = [
  { name: "PR", subs: ["BIN", "BK", "BIG", "IPS", "PPKn", "Informatika", "IPA", "MAT", "BJ", "SB", "PAI", "PJOK"], longDate: false, timeRange: false, deadline: true, startTime: false, finishFast: false },
  { name: "Organisasi", subs: ["PMR", "OSIS", "Kader Bank Sampah", "Kader Keamanan Pangan"], longDate: true, timeRange: false, deadline: false, startTime: true, finishFast: false },
  { name: "Umum", subs: [], longDate: false, timeRange: true, deadline: false, startTime: false, finishFast: true }
];

let currentUser = null;
let allTasks = [];
let currentFilter = { type: 'status', value: 'all' };
let editCatMode = null;
let editingTaskId = null; 

// --- AUTO JADWAL KELAS 9H ---
const jadwalMapel = {
  "BIN": [1, 3, 4], "BK": [1], "BIG": [1, 5], "IPS": [1, 3],
  "PPKn": [2], "Informatika": [2], "IPA": [2, 5],
  "MAT": [3, 6], "BJ": [3], "SB": [4], "PAI": [4], "PJOK": [6]
};

// --- FUNGSI FORMAT TANGGAL INDO ---
function formatDateIndo(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const dateObj = new Date(y, m - 1, d);
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${days[dateObj.getDay()]}, ${d} ${months[dateObj.getMonth()]} ${y}`;
}

function getNextMeetingDate(mapel) {
  const daysArr = jadwalMapel[mapel];
  if (!daysArr) return ""; 
  const today = new Date();
  let currentDay = today.getDay(); 
  let diff = 1; 
  while(diff <= 7) {
    let checkDay = (currentDay + diff) % 7;
    if(daysArr.includes(checkDay)) {
      let nextDate = new Date(today);
      nextDate.setDate(today.getDate() + diff);
      return nextDate.toISOString().split('T')[0]; 
    }
    diff++;
  }
  return "";
}

function getTomorrowDate() {
  const tmrw = new Date();
  tmrw.setDate(tmrw.getDate() + 1);
  return tmrw.toISOString().split('T')[0];
}

if (window.innerWidth <= 768) document.getElementById('sidebar').classList.add('minimized');

async function loadUserSettings() {
  const docSnap = await getDoc(doc(db, "userSettings", currentUser.uid));
  if (docSnap.exists()) userCategories = docSnap.data().categories;
  else await setDoc(doc(db, "userSettings", currentUser.uid), { categories: userCategories });
  applyCategoriesToUI();
}
async function saveUserSettings() {
  await setDoc(doc(db, "userSettings", currentUser.uid), { categories: userCategories });
  applyCategoriesToUI();
}

function applyCategoriesToUI() {
  document.getElementById('input-category').innerHTML = userCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  document.getElementById('dynamic-categories-sidebar').innerHTML = userCategories.map(c => `
    <li class="nav-item" data-filter="category" data-value="${c.name}">
      <i class="ph ph-folder"></i> <span class="sidebar-text">${c.name}</span>
    </li>
  `).join('');
  attachSidebarListeners();

  document.getElementById('list-categories').innerHTML = userCategories.map(c => `
    <li>
      <div class="cat-info">
        <h5>${c.name}</h5>
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
    if(cat.name === 'PR') {
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

// PENGATURAN KATEGORI
function resetCatForm() { 
  editCatMode = null; document.getElementById('set-cat-name').value = ''; document.getElementById('set-sub-cat').value = '';
  document.querySelectorAll('.chk-label input').forEach(chk => chk.checked = false);
  document.getElementById('btn-save-cat').textContent = "Simpan Kategori"; document.getElementById('btn-cancel-edit-cat').style.display = 'none';
}
document.getElementById('btn-cancel-edit-cat').addEventListener('click', resetCatForm);
document.getElementById('btn-save-cat').addEventListener('click', async () => {
  const name = document.getElementById('set-cat-name').value.trim();
  if(!name) return alert("Nama Kategori tidak boleh kosong!");
  const subsRaw = document.getElementById('set-sub-cat').value;
  const newCat = {
    name: name, subs: subsRaw ? subsRaw.split(',').map(s => s.trim()).filter(s => s) : [],
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
  if(btnDel && confirm("Hapus kategori ini?")) {
    userCategories = userCategories.filter(c => c.name !== btnDel.getAttribute('data-name')); await saveUserSettings();
  }
  if(btnEdit) {
    const catName = btnEdit.getAttribute('data-name'); const cat = userCategories.find(c => c.name === catName);
    if(cat) {
      document.getElementById('set-cat-name').value = cat.name; document.getElementById('set-sub-cat').value = cat.subs.join(', ');
      document.getElementById('chk-longdate').checked = cat.longDate; document.getElementById('chk-timerange').checked = cat.timeRange;
      document.getElementById('chk-deadline').checked = cat.deadline; document.getElementById('chk-starttime').checked = cat.startTime;
      document.getElementById('chk-finishfast').checked = cat.finishFast;
      editCatMode = cat.name; document.getElementById('btn-save-cat').textContent = "Update Kategori"; document.getElementById('btn-cancel-edit-cat').style.display = 'inline-block';
    }
  }
});
document.getElementById('btn-open-settings').addEventListener('click', () => { resetCatForm(); document.getElementById('modal-settings').classList.add('active'); });
document.getElementById('btn-close-settings').addEventListener('click', () => document.getElementById('modal-settings').classList.remove('active'));

function attachSidebarListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.id === 'btn-open-settings') return;
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active')); item.classList.add('active');
      currentFilter = { type: item.getAttribute('data-filter'), value: item.getAttribute('data-value') };
      if(window.innerWidth > 768) { document.getElementById('header-subtitle').textContent = `Menampilkan: ${item.querySelector('.sidebar-text').textContent}`; } 
      else { document.getElementById('sidebar').classList.add('minimized'); }
      renderTasksUI();
    });
  });
}
document.getElementById('btn-toggle-sidebar').addEventListener('click', () => { document.getElementById('sidebar').classList.toggle('minimized'); });


// --- SIMPAN & UPDATE KEGIATAN ---
document.getElementById('btn-cancel').addEventListener('click', () => {
  document.getElementById('modal').classList.remove('active');
  editingTaskId = null;
});

document.getElementById('btn-add-task').addEventListener('click', () => {
  editingTaskId = null;
  document.getElementById('modal-form-title').textContent = "Buat Kegiatan Baru";
  document.getElementById('btn-save').textContent = "Simpan";
  
  document.getElementById('input-title').value = '';
  document.getElementById('input-notes').value = ''; 
  document.getElementById('val-date-start').value = '';
  document.getElementById('val-date-end').value = '';
  document.getElementById('val-date-deadline').value = '';
  document.getElementById('val-default-date').value = '';
  document.getElementById('val-time-start').value = '';
  document.getElementById('val-time-end').value = '';
  document.getElementById('val-time-only').value = '';

  if(userCategories.length > 0) {
    document.getElementById('input-category').value = userCategories[0].name;
    updateFormInputs();
  }
  document.getElementById('modal').classList.add('active');
});

document.getElementById('btn-save').addEventListener('click', async () => {
  const btnSave = document.getElementById('btn-save');
  const title = document.getElementById('input-title').value;
  const notes = document.getElementById('input-notes').value.trim();
  const catName = document.getElementById('input-category').value;
  const cat = userCategories.find(c => c.name === catName);

  if (!title) return alert('Mohon isi Judul Kegiatan!');

  let payload = {
    uid: currentUser.uid, title: title, category: catName,
    notes: notes, finishFast: cat.finishFast
  };
  
  if (!editingTaskId) {
    payload.completed = false; payload.notified = false;
    payload.notified_hmin1 = false; payload.notified_hday = false;
    payload.createdAt = new Date();
  }

  if(cat.subs.length) payload.subCategory = document.getElementById('input-sub-category').value;
  if(cat.longDate) {
    payload.dateStart = document.getElementById('val-date-start').value;
    payload.dateEnd = document.getElementById('val-date-end').value;
    if(!payload.dateStart || !payload.dateEnd) return alert("Isi tanggal mulai & selesai!");
  }
  
  if(cat.deadline) {
    if(cat.name === 'PR') {
      const type = document.getElementById('val-pr-deadline-type').value;
      if (type === 'besok') {
        payload.dateDeadline = getTomorrowDate();
      } else if (type === 'next_meeting') {
        const nextDate = getNextMeetingDate(payload.subCategory);
        if(!nextDate) return alert("Maaf, Mapel ini tidak ditemukan di jadwal!");
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
    payload.timeStart = document.getElementById('val-time-start').value;
    payload.timeEnd = document.getElementById('val-time-end').value;
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
  } catch (error) { 
    console.error(error); alert("Gagal menyimpan."); 
  } finally { btnSave.textContent = "Simpan"; }
});


// --- RENDER DATA KEGIATAN & TATA LETAK BARU ---
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
    if (a.completed === b.completed) return b.createdAt.toMillis() - a.createdAt.toMillis();
    return a.completed ? 1 : -1;
  });

  let filtered = sortedTasks;
  if (currentFilter.type === 'status') filtered = sortedTasks.filter(t => currentFilter.value === 'pending' ? !t.completed : (currentFilter.value === 'completed' ? t.completed : true));
  else if (currentFilter.type === 'category') filtered = sortedTasks.filter(t => t.category === currentFilter.value);

  if (!filtered.length) return listEl.innerHTML = `<p style="text-align:center; color:var(--text-muted); font-size:13px; margin-top:20px;">Belum ada kegiatan.</p>`;

  filtered.forEach(task => {
    let dateHtml = '';
    let timeHtml = '';

    // LOGIKA PENYUSUNAN BARIS TANGGAL
    if(task.dateStart && task.dateEnd) {
      if (task.dateStart === task.dateEnd) {
        // Jika hari sama, sebut sekali!
        dateHtml = `<div class="meta-row"><i class="ph ph-calendar"></i> ${formatDateIndo(task.dateStart)}</div>`;
      } else {
        dateHtml = `<div class="meta-row"><i class="ph ph-calendar"></i> ${formatDateIndo(task.dateStart)} s/d ${formatDateIndo(task.dateEnd)}</div>`;
      }
    } else if(task.dateDeadline) {
      dateHtml = `<div class="meta-row"><i class="ph ph-calendar"></i> Deadline: ${formatDateIndo(task.dateDeadline)}</div>`;
    } else if(task.date) {
      dateHtml = `<div class="meta-row"><i class="ph ph-calendar"></i> ${formatDateIndo(task.date)}</div>`;
    }

    // LOGIKA PENYUSUNAN BARIS WAKTU/JAM
    if(task.timeStart && task.timeEnd) {
      timeHtml = `<div class="meta-row"><i class="ph ph-clock"></i> ${task.timeStart} - ${task.timeEnd}</div>`;
    } else if(task.timeStart) {
      timeHtml = `<div class="meta-row"><i class="ph ph-clock"></i> Mulai Jam ${task.timeStart}</div>`;
    }

    let subDisp = task.subCategory ? `<span>🏷️ ${task.subCategory}</span>` : '';
    let notesDisp = task.notes ? `<div class="notes-display">${task.notes}</div>` : '';
    let btnFinishFast = (task.finishFast && !task.completed) ? `<button class="btn-finish"><i class="ph ph-check-circle"></i> Selesai</button>` : '';

    const card = document.createElement('div');
    card.className = `task-card glass-panel ${task.completed ? 'completed' : ''}`;
    card.innerHTML = `
      <div class="task-info">
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
        <div class="task-details">
          <h3>${task.title}</h3>
          
          <div class="task-meta">
            <!-- Waktu & Tanggal punya baris sendiri (Vertikal) -->
            <div class="meta-schedule">
              ${dateHtml}
              ${timeHtml}
            </div>
            <!-- Badge diletakkan berdampingan (Horizontal) -->
            <div class="meta-badges">
              <span class="badge-cat">${task.category}</span>
              ${subDisp}
            </div>
          </div>
          
          ${notesDisp}
        </div>
      </div>
      <div class="task-actions">
        ${btnFinishFast}
        <button class="btn-edit-task"><i class="ph ph-pencil"></i></button>
        <button class="btn-delete-task"><i class="ph ph-trash"></i></button>
      </div>
    `;
    
    card.querySelector('.task-checkbox').addEventListener('change', async (e) => await updateDoc(doc(db, "tasks", task.id), { completed: e.target.checked }));
    card.querySelector('.btn-delete-task').addEventListener('click', async () => { if(confirm(`Hapus?`)) await deleteDoc(doc(db, "tasks", task.id)); });
    
    // FUNGSI LOAD DATA SAAT TOMBOL EDIT TUGAS DIKLIK
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

    if(task.finishFast && !task.completed) card.querySelector('.btn-finish').addEventListener('click', async () => await updateDoc(doc(db, "tasks", task.id), { completed: true }));

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
