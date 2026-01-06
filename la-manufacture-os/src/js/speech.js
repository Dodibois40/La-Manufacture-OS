import { toast } from './utils.js';

export const initSpeechToText = () => {
    const micBtn = document.getElementById('micBtn');
    const inbox = document.getElementById('inbox');

    if (!micBtn || !inbox) return;

    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        micBtn.style.opacity = '0.3';
        micBtn.title = 'Dictée non supportée par ce navigateur';
        micBtn.addEventListener('click', () => {
            toast('Dictée non supportée. Utilise Chrome ou Edge.');
        });
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = true;
    recognition.interimResults = true;

    let isListening = false;
    let finalTranscript = '';

    micBtn.addEventListener('click', () => {
        if (isListening) {
            recognition.stop();
            return;
        }

        finalTranscript = inbox.value;
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
        micBtn.textContent = '🔴';
        toast('🎤 Parle...');
    };

    recognition.onend = () => {
        isListening = false;
        micBtn.classList.remove('listening');
        micBtn.textContent = '🎤';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                // Add each sentence on a new line for easy task separation
                finalTranscript += transcript.trim() + '\n';
            } else {
                interimTranscript = transcript;
            }
        }

        // Show real-time transcription
        inbox.value = finalTranscript + interimTranscript;
        inbox.scrollTop = inbox.scrollHeight;
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        isListening = false;
        micBtn.classList.remove('listening');
        micBtn.textContent = '🎤';

        if (event.error === 'not-allowed') {
            toast('Autorise le micro dans ton navigateur');
        } else if (event.error === 'no-speech') {
            toast('Pas de voix détectée');
        } else {
            toast('Erreur: ' + event.error);
        }
    };

    // Stop on blur (user leaves page)
    window.addEventListener('blur', () => {
        if (isListening) recognition.stop();
    });
};
