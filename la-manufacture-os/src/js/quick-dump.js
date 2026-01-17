// Quick Dump - Rapid brain dump to tasks
// Captures multiple thoughts at once, AI parses them into tasks

import { api } from './api-client.js';
import { toast } from './utils.js';

// Create quick dump modal
export const openQuickDump = (state, onTasksAdded) => {
  // Remove existing if any
  closeQuickDump();

  const overlay = document.createElement('div');
  overlay.className = 'quick-dump-overlay';
  overlay.innerHTML = `
    <div class="quick-dump-modal">
      <div class="quick-dump-header">
        <div class="quick-dump-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/>
            <path d="M12 6v6l4 2"/>
          </svg>
        </div>
        <div>
          <h2>Vide ta tete</h2>
          <p>Ecris tout ce qui te passe par la tete, une idee par ligne</p>
        </div>
      </div>

      <textarea
        class="quick-dump-textarea"
        placeholder="Appeler le client demain&#10;Finir le rapport urgent&#10;Acheter du cafe&#10;RDV dentiste vendredi 14h&#10;@Marc preparer la presentation..."
        autofocus
      ></textarea>

      <div class="quick-dump-tips">
        <span class="tip">💡 Astuces:</span>
        <span class="tip-item">demain, lundi, 15/01</span>
        <span class="tip-item">@nom pour assigner</span>
        <span class="tip-item">urgent, asap</span>
        <span class="tip-item">14h pour l'heure</span>
      </div>

      <div class="quick-dump-actions">
        <button class="quick-dump-btn secondary" id="quickDumpCancel">Annuler</button>
        <button class="quick-dump-btn primary" id="quickDumpSubmit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          Ajouter les taches
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  const textarea = overlay.querySelector('.quick-dump-textarea');
  const submitBtn = overlay.querySelector('#quickDumpSubmit');
  const cancelBtn = overlay.querySelector('#quickDumpCancel');

  // Focus textarea
  setTimeout(() => textarea.focus(), 100);

  // Handle submit
  const handleSubmit = async () => {
    const text = textarea.value.trim();
    if (!text) {
      toast('Ecris quelque chose d\'abord!');
      return;
    }

    // Show loader
    const originalBtnContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <svg class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"/>
      </svg>
      Analyse en cours...
    `;
    submitBtn.classList.add('loading');

    try {
      // Call AI to process inbox
      const response = await api.ai.processInbox(text);

      // Build feedback message with counts
      const { stats } = response;
      const messages = [];
      if (stats.tasks > 0) messages.push(`${stats.tasks} tâche(s)`);
      if (stats.events > 0) messages.push(`${stats.events} RDV`);
      if (stats.notes > 0) messages.push(`${stats.notes} note(s)`);

      if (messages.length > 0) {
        toast(`✅ ${messages.join(', ')} créé(s)!`, 'success');

        // Trigger refresh - call with empty array since items are already in DB
        onTasksAdded([]);

        closeQuickDump();
      } else {
        toast('Aucun élément créé', 'warning');
      }
    } catch (error) {
      console.error('Error processing inbox:', error);
      toast(`Erreur: ${error.message}`, 'danger');

      // Restore button
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnContent;
      submitBtn.classList.remove('loading');
    }
  };

  // Event listeners
  submitBtn.addEventListener('click', handleSubmit);
  cancelBtn.addEventListener('click', closeQuickDump);

  // Ctrl+Enter to submit
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      closeQuickDump();
    }
  });

  // Click outside to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      closeQuickDump();
    }
  });
};

// Close quick dump
export const closeQuickDump = () => {
  const overlay = document.querySelector('.quick-dump-overlay');
  if (overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }
};

// Keyboard shortcut (Ctrl+Shift+N or Cmd+Shift+N)
export const initQuickDumpShortcut = (state, onTasksAdded) => {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      openQuickDump(state, onTasksAdded);
    }
  });
};
