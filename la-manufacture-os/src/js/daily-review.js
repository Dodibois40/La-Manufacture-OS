import { isoLocal, toast } from './utils.js';
import { saveState } from './storage.js';

// Daily Review - End of day notification for incomplete tasks
// Shows at 18:00 (6 PM) if there are incomplete tasks

const REVIEW_HOUR = 18; // 6 PM
const STORAGE_KEY = 'last_daily_review';

let reviewShown = false;
let reviewInterval = null;

// Check if we should show the daily review
const shouldShowReview = state => {
  const now = new Date();
  const today = isoLocal(now);
  const hour = now.getHours();

  // Only show after REVIEW_HOUR
  if (hour < REVIEW_HOUR) return false;

  // Check if already shown today
  const lastReview = localStorage.getItem(STORAGE_KEY);
  if (lastReview === today) return false;

  // Check if there are incomplete tasks for today or overdue
  const incompleteTasks = state.tasks.filter(t => {
    return !t.done && t.date <= today;
  });

  return incompleteTasks.length > 0;
};

// Create the review modal
const createReviewModal = (state, renderCallback) => {
  const today = isoLocal(new Date());

  // Get incomplete tasks
  const overdueTasks = state.tasks.filter(t => !t.done && t.date < today);
  const todayTasks = state.tasks.filter(t => !t.done && (t.date || '').split('T')[0] === today);
  const allIncomplete = [...overdueTasks, ...todayTasks];

  if (allIncomplete.length === 0) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'review-overlay';
  overlay.innerHTML = `
    <div class="review-modal">
      <div class="review-header">
        <div class="review-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <h2>Fin de journee</h2>
        <p class="review-subtitle">Tu as ${allIncomplete.length} tache${allIncomplete.length > 1 ? 's' : ''} non terminee${allIncomplete.length > 1 ? 's' : ''}</p>
      </div>

      <div class="review-tasks" id="reviewTasks">
        ${allIncomplete
          .slice(0, 5)
          .map(
            t => `
          <div class="review-task" data-id="${t.id}">
            <span class="review-task-text">${t.text}</span>
            <div class="review-task-actions">
              <button class="review-action-btn tomorrow" data-action="tomorrow" title="Demain">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              <button class="review-action-btn done" data-action="done" title="Fait">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
              </button>
              <button class="review-action-btn delete" data-action="delete" title="Supprimer">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        `
          )
          .join('')}
        ${allIncomplete.length > 5 ? `<p class="review-more">+${allIncomplete.length - 5} autres taches...</p>` : ''}
      </div>

      <div class="review-actions">
        <button class="review-btn secondary" id="reviewPostponeAll">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          Tout reporter
        </button>
        <button class="review-btn primary" id="reviewDismiss">
          OK, compris
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  // Handle individual task actions
  overlay.querySelectorAll('.review-action-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const taskEl = e.target.closest('.review-task');
      const taskId = taskEl.dataset.id;
      const action = e.target.closest('.review-action-btn').dataset.action;
      const task = state.tasks.find(t => t.id === taskId);

      if (!task) return;

      if (action === 'tomorrow') {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        task.date = isoLocal(d);
        taskEl.classList.add('processed');
        toast('-> Demain');
      } else if (action === 'done') {
        task.done = true;
        taskEl.classList.add('processed');
        toast('Fait !');
      } else if (action === 'delete') {
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        taskEl.classList.add('processed');
        toast('Supprime');
      }

      saveState(state);

      // Check if all processed
      const remaining = overlay.querySelectorAll('.review-task:not(.processed)').length;
      if (remaining === 0) {
        closeReview(overlay, renderCallback);
      }
    });
  });

  // Postpone all button
  overlay.querySelector('#reviewPostponeAll').addEventListener('click', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = isoLocal(tomorrow);

    allIncomplete.forEach(t => {
      t.date = tomorrowISO;
    });

    saveState(state);
    toast(`${allIncomplete.length} taches reportees a demain`);
    closeReview(overlay, renderCallback);
  });

  // Dismiss button
  overlay.querySelector('#reviewDismiss').addEventListener('click', () => {
    closeReview(overlay, renderCallback);
  });

  // Click outside to close
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      closeReview(overlay, renderCallback);
    }
  });

  // Mark as shown today
  localStorage.setItem(STORAGE_KEY, today);
  reviewShown = true;
};

const closeReview = (overlay, renderCallback) => {
  overlay.classList.remove('active');
  setTimeout(() => {
    overlay.remove();
    renderCallback?.();
  }, 300);
};

// Initialize daily review checker
export const initDailyReview = (state, renderCallback) => {
  // Check every 5 minutes
  const check = () => {
    if (!reviewShown && shouldShowReview(state)) {
      createReviewModal(state, renderCallback);
    }
  };

  // Initial check after 5 seconds
  setTimeout(check, 5000);

  // Then check every 5 minutes
  reviewInterval = setInterval(check, 5 * 60 * 1000);
};

// Manual trigger for testing
export const showDailyReview = (state, renderCallback) => {
  createReviewModal(state, renderCallback);
};

// Cleanup
export const stopDailyReview = () => {
  if (reviewInterval) {
    clearInterval(reviewInterval);
    reviewInterval = null;
  }
};
