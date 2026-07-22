import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, updateDoc, deleteDoc, doc, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. MASUKKAN CONFIG FIREBASE KAMU DI SINI
const firebaseConfig = {
  apiKey: "API_KEY_KAMU",
  authDomain: "project-kamu.firebaseapp.com",
  projectId: "project-kamu",
  storageBucket: "project-kamu.appspot.com",
  messagingSenderId: "SENDER_ID",
  appId: "APP_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const appScreen = document.getElementById('app-screen');
const btnLogin = document.getElementById('btn-login');
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
    userNameEl.textContent = user.displayName.split(" ")[0];
    userAvatarEl.src = user.photoURL;
    greetingEl.textContent = `Halo, ${user.displayName.split(" ")[0]}!`;
    loadTasks();
  } else {
    currentUser = null;
    appScreen.classList.remove('active');
    loginScreen.classList.add('active');
  }
});

// Login & Logout
btnLogin.addEventListener('click', () => signInWithPopup(auth, provider));
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

      // Checkbox Toggle Completed
      card.querySelector('.task-checkbox').addEventListener('change', async (e) => {
        await updateDoc(doc(db, "tasks", taskId), { completed: e.target.checked });
      });

      // Delete Task
      card.querySelector('.btn-delete').addEventListener('click', async () => {
        if(confirm('Hapus kegiatan ini?')) {
          await deleteDoc(doc(db, "tasks", taskId));
        }
      });

      taskListEl.appendChild(card);
    });
  });
}
