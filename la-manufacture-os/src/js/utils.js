// Utility functions

export const isoLocal = (d = new Date()) => {
  const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return tz.toISOString().split('T')[0];
};

export const nowISO = () => new Date().toISOString();

export const toast = (msg) => {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => t.classList.remove('show'), 1400);
};

export const storageOK = () => {
  try {
    localStorage.setItem('__lm_test', '1');
    const ok = localStorage.getItem('__lm_test') === '1';
    localStorage.removeItem('__lm_test');
    return ok;
  } catch (_) {
    return false;
  }
};

export const ensureTask = (t, defaultOwner) => {
  const task = t && typeof t === 'object' ? t : {};
  if (!task.id) task.id = Date.now() + Math.random();
  if (!task.text) task.text = '';
  if (!task.owner) task.owner = defaultOwner || 'Thibaud';
  if (!task.date) task.date = isoLocal();
  task.done = Boolean(task.done);
  task.urgent = Boolean(task.urgent);
  if (!task.updatedAt) task.updatedAt = nowISO();
  return task;
};
