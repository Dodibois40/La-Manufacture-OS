// Swipe Gestures for Tasks
// Swipe RIGHT = Done (green), Swipe LEFT = Delete (red)

const SWIPE_THRESHOLD = 80;

export const initSwipeGestures = (container, callbacks) => {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let taskEl = null;
  let isHorizontalSwipe = null; // null = undecided, true = horizontal, false = vertical

  const start = (x, y, target) => {
    const task = target.closest('.task');
    if (!task || target.closest('.check') || target.closest('.task-more')) return;

    taskEl = task;
    startX = x;
    startY = y;
    currentX = 0;
    isHorizontalSwipe = null;

    // Add swiping class to disable CSS transitions
    taskEl.classList.add('swiping');
  };

  const move = (x, y, e) => {
    if (!taskEl) return;

    const deltaX = x - startX;
    const deltaY = y - startY;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe === null && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    }

    // If vertical scroll, cancel swipe
    if (isHorizontalSwipe === false) {
      reset();
      return;
    }

    // If horizontal swipe, prevent page navigation
    if (isHorizontalSwipe === true && e) {
      e.preventDefault();
    }

    currentX = deltaX;
    // Limit swipe distance
    currentX = Math.max(-120, Math.min(120, currentX));

    // Visual feedback with colors
    if (currentX > 30) {
      // Swiping right = green (done)
      const intensity = Math.min(currentX / 120, 1);
      taskEl.style.setProperty('background', `rgba(52, 199, 89, ${intensity * 0.3})`, 'important');
    } else if (currentX < -30) {
      // Swiping left = red (delete)
      const intensity = Math.min(Math.abs(currentX) / 120, 1);
      taskEl.style.setProperty('background', `rgba(255, 69, 58, ${intensity * 0.3})`, 'important');
    } else {
      taskEl.style.removeProperty('background');
    }

    // Use setProperty with important to override CSS :active/:hover
    taskEl.style.setProperty('transform', `translateX(${currentX}px)`, 'important');
  };

  const end = () => {
    if (!taskEl) return;

    const taskId = taskEl.dataset.taskId;

    // Remove swiping class and apply final animation
    taskEl.classList.remove('swiping');
    taskEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease, background 0.2s ease';

    if (currentX > SWIPE_THRESHOLD) {
      // Swipe RIGHT = Done
      taskEl.style.setProperty('transform', 'translateX(100%)', 'important');
      taskEl.style.setProperty('opacity', '0', 'important');
      taskEl.style.setProperty('background', 'rgba(52, 199, 89, 0.5)', 'important');
      setTimeout(() => {
        callbacks.onDone?.(taskId);
        reset();
      }, 200);
    } else if (currentX < -SWIPE_THRESHOLD) {
      // Swipe LEFT = Delete
      taskEl.style.setProperty('transform', 'translateX(-100%)', 'important');
      taskEl.style.setProperty('opacity', '0', 'important');
      taskEl.style.setProperty('background', 'rgba(255, 69, 58, 0.5)', 'important');
      setTimeout(() => {
        callbacks.onDelete?.(taskId);
        reset();
      }, 200);
    } else {
      // Snap back
      taskEl.style.removeProperty('transform');
      taskEl.style.removeProperty('background');
      reset();
    }
  };

  const reset = () => {
    if (taskEl) {
      taskEl.style.removeProperty('transform');
      taskEl.style.removeProperty('opacity');
      taskEl.style.removeProperty('transition');
      taskEl.style.removeProperty('background');
      taskEl.classList.remove('swiping');
    }
    taskEl = null;
    currentX = 0;
    isHorizontalSwipe = null;
  };

  // Touch events - passive: false to allow preventDefault for horizontal swipes
  container.addEventListener(
    'touchstart',
    e => start(e.touches[0].clientX, e.touches[0].clientY, e.target),
    {
      passive: true,
    }
  );
  container.addEventListener(
    'touchmove',
    e => move(e.touches[0].clientX, e.touches[0].clientY, e),
    { passive: false }
  );
  container.addEventListener('touchend', end);

  // Mouse events (for desktop testing)
  let mouseDown = false;
  container.addEventListener('mousedown', e => {
    mouseDown = true;
    start(e.clientX, e.clientY, e.target);
  });
  container.addEventListener('mousemove', e => {
    if (mouseDown) move(e.clientX, e.clientY, null);
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
