// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                      STREAM CLIENT - SSE Consumer                             ║
// ║              Consomme le flux streaming de /api/ai/process-stream            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { getToken as getClerkToken } from './clerk-auth.js';
import { api } from './api-client.js';

// API URL configuration
const API_URL =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
    ? `http://${window.location.hostname}:3333`
    : 'http://localhost:3333');

// Get auth token helper
async function getAuthToken() {
  return await getClerkToken();
}

/**
 * Process text input via streaming SSE endpoint
 * Provides real-time feedback as AI processes the input
 *
 * @param {string} text - Input text to process
 * @param {Object} callbacks - Callback functions for each event type
 * @param {Function} callbacks.onRouting - Called with routing decision (model, complexity)
 * @param {Function} callbacks.onPreview - Called with fast preview (Haiku result, ~300ms)
 * @param {Function} callbacks.onEnriched - Called with enriched result (Sonnet, ~1s)
 * @param {Function} callbacks.onComplete - Called with final saved items
 * @param {Function} callbacks.onError - Called on error
 * @returns {Function} Abort function to cancel the stream
 */
export function processStream(text, callbacks = {}) {
  const {
    onRouting = () => {},
    onPreview = () => {},
    onEnriched = () => {},
    onComplete = () => {},
    onError = () => {},
  } = callbacks;

  const controller = new AbortController();

  (async () => {
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`${API_URL}/api/ai/process-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'routing':
                  onRouting({
                    model: data.model,
                    complexity: data.complexity,
                    reasons: data.reasons,
                  });
                  break;

                case 'preview':
                  onPreview({
                    items: data.items || [],
                    latency: data.latency_ms,
                  });
                  break;

                case 'enriched':
                  onEnriched({
                    items: data.items || [],
                    suggestions: data.suggestions || [],
                    latency: data.latency_ms,
                    cacheHit: data.cache_hit,
                  });
                  break;

                case 'complete':
                  onComplete({
                    items: data.items || [],
                    suggestions: data.suggestions || [],
                    stats: data.stats,
                    processingTime: data.processing_time_ms,
                    routing: data.routing,
                  });
                  break;

                case 'error':
                  onError(new Error(data.message));
                  break;
              }
            } catch (parseError) {
              console.warn('[StreamClient] Failed to parse SSE data:', parseError);
            }
          }
        }
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('[StreamClient] Stream error:', error);
        onError(error);
      }
    }
  })();

  // Return abort function
  return () => controller.abort();
}

/**
 * Fallback: Non-streaming process for browsers that don't support ReadableStream
 * Uses the regular /process-inbox-v2 endpoint
 */
export async function processNonStream(text, callbacks = {}) {
  const { onComplete = () => {}, onError = () => {} } = callbacks;

  try {
    const token = await getAuthToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_URL}/api/ai/process-inbox-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    onComplete({
      items: data.items || [],
      suggestions: data.proactive_suggestions || [],
      stats: data.stats,
      processingTime: data.processing_time_ms,
    });

    return data;
  } catch (error) {
    console.error('[StreamClient] Non-stream error:', error);
    onError(error);
    throw error;
  }
}

/**
 * Smart process: Uses streaming if supported, falls back to regular request
 */
export function processInbox(text, callbacks = {}) {
  // Check if streaming is supported
  const supportsStreaming =
    typeof ReadableStream !== 'undefined' && typeof TextDecoder !== 'undefined';

  if (supportsStreaming) {
    return processStream(text, callbacks);
  } else {
    // Fallback returns a promise, wrap in abort-compatible interface
    const abortController = { aborted: false };
    processNonStream(text, callbacks).catch(() => {});
    return () => {
      abortController.aborted = true;
    };
  }
}

/**
 * Get pending suggestions
 */
export async function getSuggestions() {
  try {
    const token = await getAuthToken();
    if (!token) return { suggestions: [] };

    const response = await fetch(`${API_URL}/api/ai/suggestions`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) return { suggestions: [] };

    return await response.json();
  } catch (error) {
    console.error('[StreamClient] Get suggestions error:', error);
    return { suggestions: [] };
  }
}

/**
 * Send feedback on a suggestion
 */
export async function sendSuggestionFeedback(suggestionId, action) {
  try {
    const token = await getAuthToken();
    if (!token) return { success: false };

    const response = await fetch(`${API_URL}/api/ai/suggestion-feedback/${suggestionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });

    return await response.json();
  } catch (error) {
    console.error('[StreamClient] Suggestion feedback error:', error);
    return { success: false };
  }
}

export default {
  processStream,
  processNonStream,
  processInbox,
  getSuggestions,
  sendSuggestionFeedback,
};
