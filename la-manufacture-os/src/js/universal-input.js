// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                      UNIVERSAL INPUT - Voice First                            ║
// ║              UN seul point d'entrée, micro en premier, ultra rapide          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { toast } from './utils.js';
import { processStream, getSuggestions, sendSuggestionFeedback } from './stream-client.js';

let recognition = null;
let isListening = false;
let abortStream = null;

// ═══════════════════════════════════════════════════════════════
// SPEECH RECOGNITION SETUP
// ═══════════════════════════════════════════════════════════════

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    console.warn('[UniversalInput] Speech recognition not supported');
    return null;
  }

  const rec = new SpeechRecognition();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = 'fr-FR';
  rec.maxAlternatives = 1;

  return rec;
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export const initUniversalInput = (state, renderCallback) => {
  recognition = initSpeechRecognition();

  // Create Modal HTML
  const modal = document.createElement('div');
  modal.id = 'universalInputOverlay';
  modal.className = 'universal-overlay';
  modal.innerHTML = `
    <div class="universal-box">
      <div class="universal-header">
        <h3>Capture Rapide</h3>
        <button class="universal-close" id="universalClose" aria-label="Fermer">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Voice Section (PRIMARY) -->
      <div class="universal-voice-section">
        <button class="universal-mic-btn ${!recognition ? 'disabled' : ''}" id="universalMic" ${!recognition ? 'disabled' : ''}>
          <div class="mic-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          </div>
          <span class="mic-label" id="micLabel">${recognition ? 'Appuie pour parler' : 'Non disponible'}</span>
        </button>
        <div class="voice-waves" id="voiceWaves">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
      </div>

      <!-- Divider -->
      <div class="universal-divider">
        <span>ou tape ton texte</span>
      </div>

      <!-- Text Input Section (SECONDARY) -->
      <div class="universal-text-section">
        <textarea
          id="universalTextInput"
          placeholder="RDV dentiste lundi 14h, appeler Marie demain urgent..."
          rows="2"
        ></textarea>
      </div>

      <!-- Preview Section (Streaming) -->
      <div class="universal-preview" id="universalPreview">
        <div class="preview-placeholder">
          <span class="preview-icon">AI</span>
          <span>L'IA analyse automatiquement ton texte</span>
        </div>
      </div>

      <!-- Suggestions Section -->
      <div class="universal-suggestions" id="universalSuggestions" style="display: none;">
        <div class="suggestions-header">Suggestions AI</div>
        <div class="suggestions-list" id="suggestionsList"></div>
      </div>

      <!-- Actions -->
      <div class="universal-actions">
        <button class="universal-btn universal-btn-cancel" id="universalCancel">
          Annuler
        </button>
        <button class="universal-btn universal-btn-create" id="universalCreate" disabled>
          Cr\u00e9er
          <span class="btn-shortcut">\u21b5</span>
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // DOM Elements
  const overlay = document.getElementById('universalInputOverlay');
  const closeBtn = document.getElementById('universalClose');
  const micBtn = document.getElementById('universalMic');
  const micLabel = document.getElementById('micLabel');
  const voiceWaves = document.getElementById('voiceWaves');
  const textInput = document.getElementById('universalTextInput');
  const preview = document.getElementById('universalPreview');
  const suggestions = document.getElementById('universalSuggestions');
  const suggestionsList = document.getElementById('suggestionsList');
  const cancelBtn = document.getElementById('universalCancel');
  const createBtn = document.getElementById('universalCreate');

  let currentText = '';
  let parsedItems = [];

  // ═══════════════════════════════════════════════════════════════
  // OPEN / CLOSE
  // ═══════════════════════════════════════════════════════════════

  const open = () => {
    overlay.classList.add('active');
    textInput.value = '';
    currentText = '';
    parsedItems = [];
    resetPreview();
    createBtn.disabled = true;

    // Focus text input after animation
    setTimeout(() => textInput.focus(), 300);
  };

  const close = () => {
    overlay.classList.remove('active');
    stopListening();
    if (abortStream) {
      abortStream();
      abortStream = null;
    }
  };

  // Expose globally
  window.openUniversalInput = open;
  window.closeUniversalInput = close;

  // ═══════════════════════════════════════════════════════════════
  // PREVIEW RENDERING
  // ═══════════════════════════════════════════════════════════════

  const resetPreview = () => {
    preview.innerHTML = `
      <div class="preview-placeholder">
        <span class="preview-icon">AI</span>
        <span>L'IA analyse automatiquement ton texte</span>
      </div>
    `;
  };

  const showLoading = (stage = 'routing') => {
    const stageTexts = {
      routing: 'Analyse en cours...',
      preview: 'Parsing rapide...',
      enriched: 'Enrichissement...',
    };
    preview.innerHTML = `
      <div class="preview-loading">
        <div class="preview-spinner"></div>
        <span>${stageTexts[stage] || 'Traitement...'}</span>
      </div>
    `;
  };

  const renderPreviewItems = (items, isComplete = false) => {
    if (!items || items.length === 0) {
      resetPreview();
      return;
    }

    const typeIcons = {
      task: '\ud83d\udcdd',
      event: '\ud83d\udcc5',
      note: '\ud83d\udca1',
    };

    const typeColors = {
      task: '#0a84ff',
      event: '#bf5af2',
      note: '#32d74b',
    };

    preview.innerHTML = items
      .map(
        item => `
      <div class="preview-item ${isComplete ? 'complete' : ''}">
        <span class="preview-type" style="color: ${typeColors[item.type] || '#8e8e93'}">
          ${typeIcons[item.type] || '\u2022'} ${item.type?.toUpperCase() || 'ITEM'}
        </span>
        <span class="preview-text">${item.text || item.title || 'Sans titre'}</span>
        ${item.date ? `<span class="preview-date">${formatDate(item.date)}</span>` : ''}
        ${item.start_time ? `<span class="preview-time">${item.start_time}</span>` : ''}
        ${item.urgent ? '<span class="preview-urgent">URGENT</span>' : ''}
      </div>
    `
      )
      .join('');

    createBtn.disabled = !isComplete;
    parsedItems = items;
  };

  const renderSuggestions = async suggestionItems => {
    if (!suggestionItems || suggestionItems.length === 0) {
      suggestions.style.display = 'none';
      return;
    }

    suggestions.style.display = 'block';
    suggestionsList.innerHTML = suggestionItems
      .map(
        s => `
      <div class="suggestion-item" data-id="${s.id}">
        <span class="suggestion-icon">\ud83d\udca1</span>
        <span class="suggestion-text">${s.task || s.suggested_task}</span>
        <div class="suggestion-actions">
          <button class="suggestion-accept" data-action="accepted" data-id="${s.id}" title="Ajouter">+</button>
          <button class="suggestion-dismiss" data-action="dismissed" data-id="${s.id}" title="Ignorer">\u00d7</button>
        </div>
      </div>
    `
      )
      .join('');

    // Wire suggestion buttons
    suggestionsList.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.target.dataset.id;
        const action = e.target.dataset.action;
        await sendSuggestionFeedback(id, action);
        e.target.closest('.suggestion-item').remove();
        if (suggestionsList.children.length === 0) {
          suggestions.style.display = 'none';
        }
        if (action === 'accepted') {
          toast('Suggestion ajout\u00e9e');
          renderCallback?.();
        }
      });
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // VOICE INPUT
  // ═══════════════════════════════════════════════════════════════

  const startListening = () => {
    if (!recognition || isListening) return;

    isListening = true;
    micBtn.classList.add('listening');
    micLabel.textContent = '\u00c9coute...';
    voiceWaves.classList.add('active');

    recognition.start();
  };

  const stopListening = () => {
    if (!recognition || !isListening) return;

    isListening = false;
    micBtn.classList.remove('listening');
    micLabel.textContent = 'Appuie pour parler';
    voiceWaves.classList.remove('active');

    try {
      recognition.stop();
    } catch {
      // Already stopped
    }
  };

  if (recognition) {
    recognition.onresult = event => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update text input with transcript
      if (finalTranscript) {
        textInput.value = textInput.value
          ? `${textInput.value} ${finalTranscript}`
          : finalTranscript;
        currentText = textInput.value;
        processInput(currentText);
      } else if (interimTranscript) {
        // Show interim in preview
        preview.innerHTML = `
          <div class="preview-interim">
            <span class="interim-text">${interimTranscript}</span>
            <span class="interim-indicator">...</span>
          </div>
        `;
      }
    };

    recognition.onerror = event => {
      console.error('[UniversalInput] Speech error:', event.error);
      stopListening();
      if (event.error === 'not-allowed') {
        toast('Micro non autoris\u00e9. V\u00e9rifie les permissions.');
      }
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // TEXT INPUT PROCESSING
  // ═══════════════════════════════════════════════════════════════

  let debounceTimer = null;

  const processInput = text => {
    if (!text || text.trim().length < 3) {
      resetPreview();
      createBtn.disabled = true;
      return;
    }

    showLoading('routing');

    // Abort previous stream if any
    if (abortStream) {
      abortStream();
    }

    // Start streaming process
    abortStream = processStream(text, {
      onRouting: data => {
        showLoading('preview');
        console.log('[UniversalInput] Routing:', data);
      },
      onPreview: data => {
        renderPreviewItems(data.items, false);
        console.log('[UniversalInput] Preview in', data.latency, 'ms');
      },
      onEnriched: data => {
        renderPreviewItems(data.items, false);
        if (data.suggestions?.length > 0) {
          renderSuggestions(data.suggestions);
        }
      },
      onComplete: data => {
        renderPreviewItems(data.items, true);
        if (data.suggestions?.length > 0) {
          renderSuggestions(data.suggestions);
        }
        console.log('[UniversalInput] Complete in', data.processingTime, 'ms');

        // Auto-close and refresh
        toast(`${data.stats.total} \u00e9l\u00e9ment(s) cr\u00e9\u00e9(s)`);
        setTimeout(() => {
          close();
          renderCallback?.();
        }, 500);
      },
      onError: error => {
        console.error('[UniversalInput] Stream error:', error);
        preview.innerHTML = `
          <div class="preview-error">
            <span>\u26a0\ufe0f Erreur: ${error.message}</span>
          </div>
        `;
      },
    });
  };

  // ═══════════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════════

  // Close button
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  // Overlay click (outside box)
  overlay.addEventListener('click', e => {
    if (e.target === overlay) close();
  });

  // Mic button
  micBtn.addEventListener('click', () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  });

  // Text input
  textInput.addEventListener('input', e => {
    currentText = e.target.value;

    // Debounce to avoid too many requests
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      processInput(currentText);
    }, 500);
  });

  // Create button (manual submit if not auto-created)
  createBtn.addEventListener('click', () => {
    if (currentText.trim()) {
      processInput(currentText);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    // Cmd/Ctrl + Shift + N to open
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'n') {
      e.preventDefault();
      if (overlay.classList.contains('active')) {
        close();
      } else {
        open();
      }
    }

    // Escape to close
    if (e.key === 'Escape' && overlay.classList.contains('active')) {
      close();
    }

    // Enter to submit (if not in textarea)
    if (e.key === 'Enter' && !e.shiftKey && overlay.classList.contains('active')) {
      if (document.activeElement !== textInput) {
        e.preventDefault();
        if (currentText.trim()) {
          processInput(currentText);
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateStr === today.toISOString().split('T')[0]) return "Aujourd'hui";
    if (dateStr === tomorrow.toISOString().split('T')[0]) return 'Demain';

    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }

  return {
    open,
    close,
  };
};

export default { initUniversalInput };
