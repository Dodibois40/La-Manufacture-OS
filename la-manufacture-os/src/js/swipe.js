// Swipe Gestures for Tasks
// Ultra simple: just translate the task, background shows through parent

const SWIPE_THRESHOLD = 100;

export const initSwipeGestures = (container, callbacks) => {
  let startX = 0;
  let currentX = 0;
  let taskEl = null;

  container.addEventListener(
    'touchstart',
    e => {
      const task = e.target.closest('.task');
      if (!task || e.target.closest('.check') || e.target.closest('.task-more')) return;

      taskEl = task;
      startX = e.touches[0].clientX;
      taskEl.style.transition = 'none';
    },
    { passive: true }
  );

  container.addEventListener(
    'touchmove',
    e => {
      if (!taskEl) return;

      currentX = e.touches[0].clientX - startX;

      // Only allow left swipe (delete)
      if (currentX > 0) currentX = 0;
      if (currentX < -150) currentX = -150;

      taskEl.style.transform = `translateX(${currentX}px)`;
    },
    { passive: true }
  );

  container.addEventListener('touchend', () => {
    if (!taskEl) return;

    const taskId = taskEl.dataset.taskId;

    if (currentX < -SWIPE_THRESHOLD) {
      // Delete
      taskEl.style.transition = 'transform 0.2s, opacity 0.2s';
      taskEl.style.transform = 'translateX(-100%)';
      taskEl.style.opacity = '0';
      setTimeout(() => callbacks.onDelete?.(taskId), 200);
    } else {
      // Snap back
      taskEl.style.transition = 'transform 0.2s';
      taskEl.style.transform = '';
    }

    taskEl = null;
    currentX = 0;
  });
};
