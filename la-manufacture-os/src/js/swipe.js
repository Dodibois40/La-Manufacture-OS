// Swipe Gestures for Tasks
// Swipe right = done, Swipe left = delete

const SWIPE_THRESHOLD = 80;
const SWIPE_MAX = 150;

export const initSwipeGestures = (container, callbacks) => {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;
  let taskEl = null;
  let direction = null;
  let swipeWrapper = null;

  const getTaskElement = target => {
    return target.closest('.task');
  };

  const createSwipeBackground = el => {
    // Create wrapper for swipe background effect
    const wrapper = document.createElement('div');
    wrapper.className = 'swipe-wrapper';

    // Left background (delete - red)
    const leftBg = document.createElement('div');
    leftBg.className = 'swipe-bg swipe-bg-left';
    leftBg.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      <span>Supprimer</span>
    `;

    // Right background (done - green)
    const rightBg = document.createElement('div');
    rightBg.className = 'swipe-bg swipe-bg-right';
    rightBg.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <span>Fait</span>
    `;

    wrapper.appendChild(leftBg);
    wrapper.appendChild(rightBg);

    // Insert wrapper before the task and move task inside
    el.parentNode.insertBefore(wrapper, el);
    wrapper.appendChild(el);

    return wrapper;
  };

  const handleTouchStart = e => {
    const task = getTaskElement(e.target);
    if (!task) return;

    // Don't swipe if clicking on buttons or checkbox
    if (e.target.closest('button') || e.target.closest('.check') || e.target.closest('.task-more'))
      return;

    taskEl = task;
    startX = e.touches ? e.touches[0].clientX : e.clientX;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    isDragging = true;
    direction = null;

    // Create swipe background
    if (!taskEl.parentNode.classList.contains('swipe-wrapper')) {
      swipeWrapper = createSwipeBackground(taskEl);
    } else {
      swipeWrapper = taskEl.parentNode;
    }

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

    // Apply transform with slight rotation for depth
    const rotation = currentX * 0.02;
    taskEl.style.transform = `translateX(${currentX}px) rotate(${rotation}deg)`;

    // Update visual feedback
    updateSwipeIndicator(currentX);
  };

  const updateSwipeIndicator = x => {
    if (!swipeWrapper) return;

    const progress = Math.min(Math.abs(x) / SWIPE_THRESHOLD, 1);
    const leftBg = swipeWrapper.querySelector('.swipe-bg-left');
    const rightBg = swipeWrapper.querySelector('.swipe-bg-right');

    if (x > 0) {
      // Swipe right = done (green)
      rightBg.classList.add('active');
      leftBg.classList.remove('active');

      const scale = 0.5 + progress * 0.5;
      const icon = rightBg.querySelector('svg');
      if (icon) icon.style.transform = `scale(${scale})`;

      // Update text when threshold reached
      const span = rightBg.querySelector('span');
      if (span) span.textContent = progress >= 1 ? 'Fait !' : 'Fait';

      rightBg.style.opacity = progress;
    } else if (x < 0) {
      // Swipe left = delete (red)
      leftBg.classList.add('active');
      rightBg.classList.remove('active');

      const scale = 0.5 + progress * 0.5;
      const icon = leftBg.querySelector('svg');
      if (icon) icon.style.transform = `scale(${scale})`;

      // Update text when threshold reached
      const span = leftBg.querySelector('span');
      if (span) span.textContent = progress >= 1 ? 'Supprimer !' : 'Supprimer';

      leftBg.style.opacity = progress;
    } else {
      leftBg.classList.remove('active');
      rightBg.classList.remove('active');
      leftBg.style.opacity = 0;
      rightBg.style.opacity = 0;
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
      setTimeout(() => cleanupSwipe(), 300);
    }

    isDragging = false;
    currentX = 0;
    direction = null;
  };

  const cleanupSwipe = () => {
    if (!taskEl || !swipeWrapper) return;

    // Move task out of wrapper
    if (swipeWrapper.parentNode) {
      swipeWrapper.parentNode.insertBefore(taskEl, swipeWrapper);
      swipeWrapper.remove();
    }

    // Reset task styles
    taskEl.style.transform = '';
    taskEl.style.opacity = '';
    taskEl.style.transition = '';

    swipeWrapper = null;
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
