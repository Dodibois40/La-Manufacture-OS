// Swipe Gestures for Tasks
// Swipe right = done, Swipe left = delete
// Simple CSS-only approach (no DOM wrapping)

const SWIPE_THRESHOLD = 80;
const SWIPE_MAX = 150;

export const initSwipeGestures = (container, callbacks) => {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;
  let taskEl = null;
  let direction = null;

  const getTaskElement = target => {
    return target.closest('.task');
  };

  const handleTouchStart = e => {
    const task = getTaskElement(e.target);
    if (!task) return;

    // Don't swipe if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('.check') || e.target.closest('.task-more'))
      return;

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

    // Update visual feedback with CSS classes
    const progress = Math.min(Math.abs(currentX) / SWIPE_THRESHOLD, 1);
    taskEl.style.setProperty('--swipe-progress', progress);

    if (currentX > 0) {
      // Swipe right = done (green)
      taskEl.classList.add('swiping-right');
      taskEl.classList.remove('swiping-left');
    } else if (currentX < 0) {
      // Swipe left = delete (red)
      taskEl.classList.add('swiping-left');
      taskEl.classList.remove('swiping-right');
    } else {
      taskEl.classList.remove('swiping-left', 'swiping-right');
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging || !taskEl) return;

    const taskId = taskEl.dataset.taskId;
    taskEl.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease';

    if (Math.abs(currentX) >= SWIPE_THRESHOLD) {
      if (currentX > 0) {
        // Swipe right = done
        taskEl.style.transform = `translateX(100vw)`;
        taskEl.style.opacity = '0';
        setTimeout(() => {
          callbacks.onDone?.(taskId);
          cleanupSwipe();
        }, 250);
      } else {
        // Swipe left = delete
        taskEl.style.transform = `translateX(-100vw)`;
        taskEl.style.opacity = '0';
        setTimeout(() => {
          callbacks.onDelete?.(taskId);
          cleanupSwipe();
        }, 250);
      }
    } else {
      // Snap back
      taskEl.style.transform = '';
      cleanupSwipe();
    }

    isDragging = false;
    currentX = 0;
    direction = null;
  };

  const cleanupSwipe = () => {
    if (!taskEl) return;

    // Just remove the classes - no DOM manipulation needed!
    taskEl.classList.remove('swiping-left', 'swiping-right');
    taskEl.style.removeProperty('--swipe-progress');
    taskEl.style.transform = '';
    taskEl.style.opacity = '';
    taskEl.style.transition = '';

    taskEl = null;
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
