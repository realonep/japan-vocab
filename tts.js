// TTS Module for Japanese AI Learning App
// Shared between index.html and grammar.html

const TTS = (function() {
    const API_URL = 'https://japan-api.garagehousekr.workers.dev';
    const CACHE_NAME = 'japanese-tts-cache';
    const CACHE_VERSION = 1;
    const CACHE_EXPIRY_DAYS = 7;
    
    let db = null;
    let currentVoice = 'ja-JP-Neural2-B';
    let statusCallback = null;
    let activeAudio = null;
    let activeAudioUrl = null;

    // Initialize IndexedDB
    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(CACHE_NAME, CACHE_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                db = request.result;
                resolve(db);
            };
            request.onupgradeneeded = (event) => {
                const database = event.target.result;
                if (!database.objectStoreNames.contains('audio')) {
                    const objectStore = database.createObjectStore('audio', { keyPath: 'text' });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
            };
        });
    }

    // Get cached audio
    async function getCachedAudio(text) {
        if (!db) return null;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['audio'], 'readonly');
            const objectStore = transaction.objectStore('audio');
            const request = objectStore.get(text);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    const now = Date.now();
                    const age = now - result.timestamp;
                    const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
                    if (age < maxAge) {
                        resolve(result.audioBlob);
                    } else {
                        deleteCachedAudio(text);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Save audio to cache
    async function saveCachedAudio(text, audioBlob) {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['audio'], 'readwrite');
            const objectStore = transaction.objectStore('audio');
            const data = { text, audioBlob, timestamp: Date.now() };
            const request = objectStore.put(data);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Delete cached audio
    async function deleteCachedAudio(text) {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['audio'], 'readwrite');
            const objectStore = transaction.objectStore('audio');
            const request = objectStore.delete(text);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Clean old cache entries
    async function cleanOldCache() {
        if (!db) return;
        const transaction = db.transaction(['audio'], 'readwrite');
        const objectStore = transaction.objectStore('audio');
        const index = objectStore.index('timestamp');
        const now = Date.now();
        const maxAge = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        index.openCursor().onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                const age = now - cursor.value.timestamp;
                if (age > maxAge) cursor.delete();
                cursor.continue();
            }
        };
    }

    // Clear all cached audio
    async function clearAllCache() {
        if (!db) return Promise.reject('Cache not initialized');
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['audio'], 'readwrite');
            const objectStore = transaction.objectStore('audio');
            const request = objectStore.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Update status message
    function setStatus(message) {
        if (statusCallback) {
            statusCallback(message);
        }
    }

    function releaseActiveAudio() {
        if (activeAudio) {
            activeAudio.pause();
            activeAudio.onended = null;
            activeAudio.onerror = null;
            activeAudio.src = '';
            activeAudio = null;
        }
        if (activeAudioUrl) {
            URL.revokeObjectURL(activeAudioUrl);
            activeAudioUrl = null;
        }
    }

    function stop() {
        releaseActiveAudio();
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
    }

    function playBlobAudio(audioBlob) {
        releaseActiveAudio();
        activeAudioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(activeAudioUrl);
        activeAudio = audio;
        audio.onended = () => releaseActiveAudio();
        audio.onerror = () => releaseActiveAudio();
        return audio.play();
    }

    // Browser TTS (Web Speech API)
    function speakBrowser(text, btnElement) {
        if (!('speechSynthesis' in window)) {
            setStatus("❌ Browser TTS not supported");
            return;
        }

        stop();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ja-JP';
        utterance.rate = 0.9;
        utterance.pitch = 1;

        const voices = window.speechSynthesis.getVoices();
        const japaneseVoice = voices.find(v => v.lang.startsWith('ja'));
        if (japaneseVoice) {
            utterance.voice = japaneseVoice;
        }

        const originalContent = btnElement.innerHTML;
        btnElement.disabled = true;
        btnElement.innerHTML = `<svg class="loading-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;
        setStatus("🔊 Speaking...");

        utterance.onend = () => {
            btnElement.disabled = false;
            btnElement.innerHTML = originalContent;
            setStatus("TTS Ready");
        };

        utterance.onerror = (e) => {
            btnElement.disabled = false;
            btnElement.innerHTML = originalContent;
            setStatus("❌ Speech Error");
            console.error('Speech error:', e);
        };

        window.speechSynthesis.speak(utterance);
    }

    // Google Cloud TTS via Cloudflare Worker
    async function speakAI(text, btnElement) {
        const originalContent = btnElement.innerHTML;
        btnElement.disabled = true;
        btnElement.innerHTML = `<svg class="loading-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`;

        // Check cache first
        try {
            const cachedBlob = await getCachedAudio(text);
            if (cachedBlob) {
                setStatus("Playing from Cache 🚀");
                await playBlobAudio(cachedBlob);
                btnElement.disabled = false;
                btnElement.innerHTML = originalContent;
                setTimeout(() => setStatus("TTS Ready"), 1500);
                return;
            }
        } catch (err) {
            console.warn('Cache read failed:', err);
        }

        setStatus("🤖 AI Generating Audio...");

        const callTTS = async (retryCount = 0) => {
            try {
                const response = await fetch(`${API_URL}/tts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input: { text: text },
                        voice: {
                            languageCode: 'ja-JP',
                            name: currentVoice
                        },
                        audioConfig: {
                            audioEncoding: 'MP3'
                        }
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    console.error('Google TTS API Error:', response.status, errorData);
                    throw new Error(`API ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
                }

                const data = await response.json();

                if (!data.audioContent) {
                    throw new Error('No audio data in response');
                }

                // Convert base64 to blob
                const binaryString = atob(data.audioContent);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const audioBlob = new Blob([bytes], { type: 'audio/mp3' });

                // Save to cache
                try {
                    await saveCachedAudio(text, audioBlob);
                    setStatus("Cached & Playing ✓");
                } catch (err) {
                    console.warn('Cache save failed:', err);
                    setStatus("Playing (Cache Failed)");
                }

                await playBlobAudio(audioBlob);

                setTimeout(() => setStatus("TTS Ready"), 2000);
            } catch (error) {
                if (retryCount < 3) {
                    const delay = Math.pow(2, retryCount) * 1000;
                    setStatus(`Retrying... (${retryCount + 1}/3)`);
                    await new Promise(r => setTimeout(r, delay));
                    return callTTS(retryCount + 1);
                }
                console.error('Google TTS Error:', error);
                setStatus(`❌ ${error.message}`);
                setTimeout(() => setStatus("TTS Ready"), 3000);
            } finally {
                btnElement.disabled = false;
                btnElement.innerHTML = originalContent;
            }
        };

        await callTTS();
    }

    // Main speak function
    function speak(text, btnElement, mode = 'ai') {
        if (mode === 'browser') {
            speakBrowser(text, btnElement);
        } else {
            speakAI(text, btnElement);
        }
    }

    // Initialize
    async function init(onStatusChange) {
        statusCallback = onStatusChange;
        try {
            await initDB();
            await cleanOldCache();
            console.log('🎵 TTS Cache system initialized');
            return true;
        } catch (err) {
            console.error('TTS init failed:', err);
            return false;
        }
    }

    // Set voice
    function setVoice(voice) {
        currentVoice = voice;
    }

    // Get current voice
    function getVoice() {
        return currentVoice;
    }

    // Public API
    return {
        init,
        speak,
        stop,
        setVoice,
        getVoice,
        clearCache: clearAllCache,
        speakBrowser,
        speakAI
    };
})();

// Load voices for browser TTS
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
