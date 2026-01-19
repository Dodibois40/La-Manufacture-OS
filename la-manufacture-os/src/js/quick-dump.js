// Quick Dump - Rapid brain dump to tasks
// Captures multiple thoughts at once, AI parses them into tasks

import { api, isApiMode } from './api-client.js';
import { toast } from './utils.js';
import { loadStateFromApi, saveState } from './storage.js';

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
          <h2>Vide ta tête</h2>
          <p>L'IA trie automatiquement : tâches, RDV au calendrier, et notes</p>
        </div>
      </div>

      <div class="quick-dump-input-wrapper">
        <textarea
          class="quick-dump-textarea"
          placeholder="Ex: Appeler Marie demain → tâche&#10;Ex: RDV dentiste vendredi 14h → calendrier&#10;Ex: Idée: refonte du site → note&#10;Ex: @Marc finir le rapport → tâche assignée&#10;&#10;Écris ou parle librement, l'IA comprend le contexte..."
          autofocus
        ></textarea>
        <button class="quick-dump-mic-btn" id="quickDumpMicBtn" title="Dictée vocale">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      </div>

      <div class="quick-dump-tips">
        <span class="tip">🤖 L'IA détecte:</span>
        <span class="tip-item">qui (@nom)</span>
        <span class="tip-item">quand (demain, lundi, 14h)</span>
        <span class="tip-item">quoi (tâche, RDV, note)</span>
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
  const micBtn = overlay.querySelector('#quickDumpMicBtn');

  // Focus textarea
  setTimeout(() => textarea.focus(), 100);

  // Speech recognition setup
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition && micBtn) {
    recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalTranscript = '';

    micBtn.addEventListener('click', () => {
      if (isListening) {
        recognition.stop();
        return;
      }

      finalTranscript = textarea.value;
      if (finalTranscript && !finalTranscript.endsWith('\n')) {
        finalTranscript += '\n';
      }

      try {
        recognition.start();
      } catch (e) {
        toast('Erreur micro. Réessaie.');
      }
    });

    recognition.onstart = () => {
      isListening = true;
      micBtn.classList.add('listening');
      toast('🎤 Parle...');
    };

    recognition.onend = () => {
      isListening = false;
      micBtn.classList.remove('listening');
    };

    recognition.onresult = event => {
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript.trim() + '\n';
        } else {
          interimTranscript = transcript;
        }
      }

      textarea.value = finalTranscript + interimTranscript;
      textarea.scrollTop = textarea.scrollHeight;
    };

    recognition.onerror = event => {
      console.error('Speech recognition error:', event.error);
      isListening = false;
      micBtn.classList.remove('listening');

      if (event.error === 'not-allowed') {
        toast('Autorise le micro dans ton navigateur');
      } else if (event.error === 'no-speech') {
        toast('Pas de voix détectée');
      } else {
        toast('Erreur: ' + event.error);
      }
    };
  } else if (micBtn) {
    // Browser doesn't support speech recognition
    micBtn.style.opacity = '0.3';
    micBtn.title = 'Dictée non supportée par ce navigateur';
    micBtn.addEventListener('click', () => {
      toast('Dictée non supportée. Utilise Chrome ou Edge.');
    });
  }

  // Handle submit
  const handleSubmit = async () => {
    const text = textarea.value.trim();
    if (!text) {
      toast("Ecris quelque chose d'abord!");
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

        // Check for sync errors
        const syncErrors = response.items.filter(i => i.google_sync_status === 'not_connected');
        if (syncErrors.length > 0) {
          setTimeout(() => {
            toast('⚠️ Google Calendar non connecté', 'warning');
          }, 2000);
        } else if (response.items.some(i => i.google_sync_status === 'api_error')) {
          setTimeout(() => {
            toast('⚠️ Erreur synchro Google', 'warning');
          }, 2000);
        }

        // Log the items created by the API
        console.log('[QuickDump] Items created:', response.items);

        // Reload state from API directly (items are already in DB)
        console.log('[QuickDump] isApiMode:', isApiMode);
        if (isApiMode) {
          console.log('[QuickDump] Reloading state from API...');
          const apiState = await loadStateFromApi();
          console.log(
            '[QuickDump] apiState:',
            apiState ? `${apiState.tasks?.length} tasks` : 'null'
          );
          if (apiState) {
            // Log the last few tasks to see what dates they have
            const lastTasks = apiState.tasks.slice(-5);
            console.log(
              '[QuickDump] Last 5 tasks:',
              lastTasks.map(t => ({ id: t.id, text: t.text, date: t.date, is_event: t.is_event }))
            );

            state.tasks = apiState.tasks;
            state.settings = apiState.settings || state.settings;
            console.log('[QuickDump] state.tasks updated:', state.tasks.length);

            // IMPORTANT: Save to localStorage as backup for page reload
            saveState(state);
            console.log('[QuickDump] State saved to localStorage');
          }
        }

        // Trigger render
        await onTasksAdded([]);

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
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      closeQuickDump();
    }
  });

  // Click outside to close (only if no text entered)
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      if (textarea.value.trim()) {
        // Don't close if there's text - flash the modal instead
        const modal = overlay.querySelector('.quick-dump-modal');
        modal.classList.add('shake');
        setTimeout(() => modal.classList.remove('shake'), 500);
        toast('Clique sur Annuler pour fermer', 'warning');
      } else {
        closeQuickDump();
      }
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
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
      e.preventDefault();
      openQuickDump(state, onTasksAdded);
    }
  });
};
