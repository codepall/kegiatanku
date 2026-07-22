import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// Mengimpor fungsi login menggunakan Email dan Password
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
const taskListEl = document.getElementById('task-list');

// Modal Elements
const modal = document.getElementById('modal');
const btnAddTask = document.getElementById('btn-add-task');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');

let currentUser = null;

// Auth Listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginScreen.classList.remove('active');
    appScreen.classList.add('active');
    
    // Mengambil nama dari email (contoh: naufal@gmail.com jadi "naufal")
    const nameFromEmail = user.email.split("@")[0];
    const displayName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
    
    userNameEl.textContent = displayName;
    // Menggunakan API pihak ketiga untuk membuat avatar otomatis bergaya Sage Green
    userAvatarEl.src = `https://ui-avatars.com/api/?name=${displayName}&background=8a9e86&color=fff`;
    greetingEl.textContent = `Halo, ${displayName}!`;
    
    loadTasks();
  } else {
    currentUser = null;
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
  }
});

// Sistem Login
btnLogin.addEventListener('click', async () => {
  loginError.textContent = '';
  try {
    await signInWithEmailAndPassword(auth, loginEmailEl.value, loginPasswordEl.value);
  } catch (error) {
    loginError.textContent = 'Gagal login: Email atau password salah!';
  }
});

// Sistem Daftar (Register)
btnRegister.addEventListener('click', async () => {
  loginError.textContent = '';
  if(loginPasswordEl.value.length < 6) {
    loginError.textContent = 'Password minimal 6 karakter!';
    return;
  }
  try {
    await createUserWithEmailAndPassword(auth, loginEmailEl.value, loginPasswordEl.value);
    alert('Akun berhasil dibuat! Selamat datang.');
  } catch (error) {
    loginError.textContent = 'Gagal daftar: Email mungkin sudah digunakan.';
  }
});

// Logout
btnLogout.addEventListener('click', () => signOut(auth));

// Modal Controls
btnAddTask.addEventListener('click', () => {
  clearForm();
  modal.classList.add('active');
});
btnCancel.addEventListener('click', () => modal.classList.remove('active'));

// Save Task
btnSave.addEventListener('click', async () => {
  const title = document.getElementById('input-title').value;
  const date = document.getElementById('input-date').value;
  const category = document.getElementById('input-category').value;
  const timeStart = document.getElementById('input-time-start').value;
  const timeEnd = document.getElementById('input-time-end').value;

  if(!title || !date || !timeStart || !timeEnd) return alert('Isi semua data!');

  try {
    await addDoc(collection(db, "tasks"), {
      uid: currentUser.uid,
      title, date, category, timeStart, timeEnd,
      completed: false,
      createdAt: new Date()
    });
    modal.classList.remove('active');
  } catch (error) {
    console.error("Error adding task: ", error);
  }
});

function clearForm() {
  document.getElementById('input-title').value = '';
  document.getElementById('input-date').value = '';
  document.getElementById('input-time-start').value = '';
  document.getElementById('input-time-end').value = '';
}

// Load Tasks Realtime
function loadTasks() {
  const q = query(
    collection(db, "tasks"), 
    where("uid", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    taskListEl.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const task = docSnap.data();
      const taskId = docSnap.id;

      const card = document.createElement('div');
      card.className = `task-card ${task.completed ? 'completed' : ''}`;
      card.innerHTML = `
        <div class="task-info">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>
          <div class="task-details">
            <h3>${task.title}</h3>
            <div class="task-meta">
              <span>${task.date}</span>
              <span>${task.timeStart} - ${task.timeEnd}</span>
              <span>${task.category}</span>
            </div>
          </div>
        </div>
        <button class="btn-delete">Hapus</button>
      `;

      card.querySelector('.task-checkbox').addEventListener('change', async (e) => {
        await updateDoc(doc(db, "tasks", taskId), { completed: e.target.checked });
      });

      card.querySelector('.btn-delete').addEventListener('click', async () => {
        if(confirm('Hapus kegiatan ini?')) {
          await deleteDoc(doc(db, "tasks", taskId));
        }
      });

      taskListEl.appendChild(card);
    });
  });
}
