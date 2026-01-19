// Swipe Gestures for Tasks
// Swipe RIGHT = Done, Swipe LEFT = Delete

const SWIPE_THRESHOLD = 80;

export const initSwipeGestures = (container, callbacks) => {
  let startX = 0;
  let currentX = 0;
  let taskEl = null;

  const start = (x, target) => {
    const task = target.closest('.task');
    if (!task || target.closest('.check') || target.closest('.task-more')) return;

    taskEl = task;
    startX = x;
    currentX = 0;

    // Add swiping class to disable CSS transitions
    taskEl.classList.add('swiping');
  };

  const move = x => {
    if (!taskEl) return;

    currentX = x - startX;
    // Limit swipe distance
    currentX = Math.max(-120, Math.min(120, currentX));

    // Use CSS variable for transform
    taskEl.style.setProperty('--swipe-x', `translateX(${currentX}px)`);
  };

  const end = () => {
    if (!taskEl) return;

    const taskId = taskEl.dataset.taskId;

    // Remove swiping class and apply final animation
    taskEl.classList.remove('swiping');
    taskEl.style.removeProperty('--swipe-x');
    taskEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';

    if (currentX > SWIPE_THRESHOLD) {
      // Swipe RIGHT = Done
      taskEl.style.transform = 'translateX(100%)';
      taskEl.style.opacity = '0';
      setTimeout(() => {
        callbacks.onDone?.(taskId);
        reset();
      }, 200);
    } else if (currentX < -SWIPE_THRESHOLD) {
      // Swipe LEFT = Delete
      taskEl.style.transform = 'translateX(-100%)';
      taskEl.style.opacity = '0';
      setTimeout(() => {
        callbacks.onDelete?.(taskId);
        reset();
      }, 200);
    } else {
      // Snap back
      taskEl.style.transform = '';
      reset();
    }
  };

  const reset = () => {
    if (taskEl) {
      taskEl.style.transform = '';
      taskEl.style.opacity = '';
      taskEl.style.transition = '';
    }
    taskEl = null;
    currentX = 0;
  };

  // Touch events
  container.addEventListener('touchstart', e => start(e.touches[0].clientX, e.target), {
    passive: true,
  });
  container.addEventListener('touchmove', e => move(e.touches[0].clientX), { passive: true });
  container.addEventListener('touchend', end);

  // Mouse events (for desktop testing)
  let mouseDown = false;
  container.addEventListener('mousedown', e => {
    mouseDown = true;
    start(e.clientX, e.target);
  });
  container.addEventListener('mousemove', e => {
    if (mouseDown) move(e.clientX);
  });
  container.addEventListener('mouseup', () => {
    mouseDown = false;
    end();
  });
  container.addEventListener('mouseleave', () => {
    if (mouseDown) {
      mouseDown = false;
      end();
    }
  });
};
