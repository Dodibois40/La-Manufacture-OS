import { Clerk } from '@clerk/clerk-js';
import { api, isApiMode } from './api-client.js';

// Initialize Clerk
const clerk = new Clerk(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
await clerk.load();

// Check authentication
if (!clerk.user) {
  window.location.href = '/';
}

// DOM Elements
const memberNameBadge = document.getElementById('memberName');
const navItems = document.querySelectorAll('.nav-item');

// Views
const tasksView = document.getElementById('tasksView');
const projectsView = document.getElementById('projectsView');
const timeView = document.getElementById('timeView');

// View switching
function showView(viewName) {
  tasksView.classList.add('hidden');
  projectsView.classList.add('hidden');
  timeView.classList.add('hidden');

  navItems.forEach(item => item.classList.remove('active'));

  switch (viewName) {
    case 'tasks':
      tasksView.classList.remove('hidden');
      break;
    case 'projects':
      projectsView.classList.remove('hidden');
      break;
    case 'time':
      timeView.classList.remove('hidden');
      break;
  }

  document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
}

navItems.forEach(item => {
  item.addEventListener('click', () => {
    showView(item.dataset.view);
  });
});

// Load profile
async function loadProfile() {
  if (!isApiMode) return;

  try {
    const { member } = await api.member.getProfile();
    memberNameBadge.textContent = member.name;
  } catch (error) {
    console.error('Error loading profile:', error);
  }
}

// Load tasks
async function loadTasks() {
  if (!isApiMode) return;

  const today = new Date().toISOString().split('T')[0];

  try {
    const { tasks } = await api.member.getTasks({ date: today });
    const tasksList = document.getElementById('tasksList');

    if (tasks.length === 0) {
      tasksList.innerHTML = '<p class="empty-state">Aucune tâche pour aujourd\'hui</p>';
      return;
    }

    tasksList.innerHTML = tasks.map(task => `
      <div class="task-card ${task.done ? 'done' : ''}">
        <div class="task-header">
          <input type="checkbox" ${task.done ? 'checked' : ''} onchange="window.toggleTask(${task.id}, this.checked)">
          <span class="task-text">${task.text}</span>
          ${task.urgent ? '<span class="badge-urgent">!</span>' : ''}
        </div>
        <div class="task-meta">
          <span>${task.status || 'open'}</span>
          ${task.time_spent ? `<span>${task.time_spent}min</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading tasks:', error);
    document.getElementById('tasksList').innerHTML = `<p class="error">Erreur: ${error.message}</p>`;
  }
}

// Load projects
async function loadProjects() {
  if (!isApiMode) return;

  try {
    const { projects } = await api.member.getProjects('active');
    const projectsList = document.getElementById('projectsList');

    if (projects.length === 0) {
      projectsList.innerHTML = '<p class="empty-state">Aucun projet assigné</p>';
      return;
    }

    projectsList.innerHTML = projects.map(project => `
      <div class="project-card">
        <h3>${project.name}</h3>
        <p>${project.description || 'Pas de description'}</p>
        <div class="project-meta">
          <span>Status: ${project.status}</span>
          ${project.deadline ? `<span>Échéance: ${new Date(project.deadline).toLocaleDateString('fr-FR')}</span>` : ''}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading projects:', error);
    document.getElementById('projectsList').innerHTML = `<p class="error">Erreur: ${error.message}</p>`;
  }
}

// Toggle task
window.toggleTask = async (taskId, done) => {
  if (!isApiMode) return;

  try {
    await api.member.updateTask(taskId, { done, status: done ? 'completed' : 'in_progress' });
    await loadTasks();
  } catch (error) {
    console.error('Error toggling task:', error);
    alert('Erreur lors de la mise à jour de la tâche');
  }
};

// Refresh buttons
document.getElementById('refreshTasks')?.addEventListener('click', loadTasks);
document.getElementById('refreshProjects')?.addEventListener('click', loadProjects);

// Initial load
loadProfile();
loadTasks();
loadProjects();
