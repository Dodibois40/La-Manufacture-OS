// Swipe Gestures for Tasks
// Swipe left = tomorrow, Swipe right = done

const SWIPE_THRESHOLD = 80;
const SWIPE_DELETE_THRESHOLD = 150; // Long swipe left = delete
const SWIPE_MAX = 180;

export const initSwipeGestures = (container, callbacks) => {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;
  let taskEl = null;
  let direction = null;

  const getTaskElement = target => {
    return target.closest('.task-row');
  };

  const handleTouchStart = e => {
    const task = getTaskElement(e.target);
    if (!task) return;

    // Don't swipe if clicking on buttons
    if (e.target.closest('button') || e.target.closest('.task-checkbox')) return;

    taskEl = task;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    isDragging = true;
    direction = null;

    taskEl.style.transition = 'none';
  };

  const handleTouchMove = e => {
    if (!isDragging || !taskEl) return;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - startX;
    const deltaY = clientY - startY;

    // Determine direction on first significant move
    if (direction === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      direction = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
    }

    // Only handle horizontal swipes
    if (direction !== 'horizontal') return;

    e.preventDefault();
    currentX = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, deltaX));

    // Apply transform
    taskEl.style.transform = `translateX(${currentX}px)`;

    // Update visual feedback
    updateSwipeIndicator(taskEl, currentX);
  };

  const handleTouchEnd = () => {
    if (!isDragging || !taskEl) return;

    const taskId = taskEl.dataset.id;
    taskEl.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    if (Math.abs(currentX) >= SWIPE_THRESHOLD) {
      if (currentX > 0) {
        // Swipe right = done
        taskEl.style.transform = `translateX(100%)`;
        taskEl.style.opacity = '0';
        setTimeout(() => {
          callbacks.onDone?.(taskId);
          resetTask(taskEl);
        }, 200);
      } else if (Math.abs(currentX) >= SWIPE_DELETE_THRESHOLD) {
        // Long swipe left = delete
        taskEl.style.transform = `translateX(-100%)`;
        taskEl.style.opacity = '0';
        setTimeout(() => {
          callbacks.onDelete?.(taskId);
          resetTask(taskEl);
        }, 200);
      } else {
        // Short swipe left = tomorrow
        taskEl.style.transform = `translateX(-100%)`;
        taskEl.style.opacity = '0';
        setTimeout(() => {
          callbacks.onTomorrow?.(taskId);
          resetTask(taskEl);
        }, 200);
      }
    } else {
      resetTask(taskEl);
    }

    isDragging = false;
    currentX = 0;
    direction = null;
  };

  const resetTask = el => {
    if (!el) return;
    el.style.transform = '';
    el.style.opacity = '';
    el.style.transition = '';
    removeSwipeIndicator(el);
  };

  const updateSwipeIndicator = (el, x) => {
    let indicator = el.querySelector('.swipe-indicator');

    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'swipe-indicator';
      el.appendChild(indicator);
    }

    const progress = Math.min(Math.abs(x) / SWIPE_THRESHOLD, 1);
    const deleteProgress = Math.abs(x) / SWIPE_DELETE_THRESHOLD;
    const isDeleteZone = Math.abs(x) >= SWIPE_DELETE_THRESHOLD;

    if (x > 0) {
      indicator.className = 'swipe-indicator swipe-done';
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>${progress >= 1 ? 'Fait!' : 'Fait'}</span>
      `;
      indicator.style.opacity = progress;
      indicator.style.left = '16px';
      indicator.style.right = 'auto';
    } else if (isDeleteZone) {
      // Long swipe left = delete
      indicator.className = 'swipe-indicator swipe-delete';
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
        <span>Supprimer!</span>
      `;
      indicator.style.opacity = 1;
      indicator.style.right = '16px';
      indicator.style.left = 'auto';
    } else {
      // Short swipe left = tomorrow
      indicator.className = 'swipe-indicator swipe-tomorrow';
      indicator.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
        <span>${progress >= 1 ? 'Demain!' : 'Demain'}</span>
      `;
      indicator.style.opacity = progress;
      indicator.style.right = '16px';
      indicator.style.left = 'auto';
    }
  };

  const removeSwipeIndicator = el => {
    const indicator = el?.querySelector('.swipe-indicator');
    if (indicator) indicator.remove();
  };

  // Add event listeners
  container.addEventListener('touchstart', handleTouchStart, { passive: true });
  container.addEventListener('touchmove', handleTouchMove, { passive: false });
  container.addEventListener('touchend', handleTouchEnd);

  // Mouse support for desktop
  container.addEventListener('mousedown', handleTouchStart);
  container.addEventListener('mousemove', e => {
    if (isDragging) handleTouchMove(e);
  });
  container.addEventListener('mouseup', handleTouchEnd);
  container.addEventListener('mouseleave', handleTouchEnd);

  // Cleanup function
  return () => {
    container.removeEventListener('touchstart', handleTouchStart);
    container.removeEventListener('touchmove', handleTouchMove);
    container.removeEventListener('touchend', handleTouchEnd);
    container.removeEventListener('mousedown', handleTouchStart);
    container.removeEventListener('mousemove', handleTouchMove);
    container.removeEventListener('mouseup', handleTouchEnd);
    container.removeEventListener('mouseleave', handleTouchEnd);
  };
};
