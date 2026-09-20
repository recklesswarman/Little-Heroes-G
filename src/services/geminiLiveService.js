// Gemini Live API Client Service for Rex the Dino & Pet Champions
// Provides real-time bidirectional voice conversations, barge-in interruptions,
// live quest guidance, and realistic voice responses using Gemini 3.8 Live.

import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { speakCompanion } from './voiceService.js';
import { triggerInteractiveCelebration } from '../components/InteractiveCelebrationOverlay.js';

class GeminiLiveService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isListening = false;
    this.isSpeaking = false;
    
    // Audio contexts & processing nodes
    this.audioInputContext = null;
    this.mediaStream = null;
    this.scriptProcessor = null;
    this.audioOutputContext = null;
    this.nextAudioPlayTime = 0;
    this.activeAudioSources = [];
    
    // Visualizer callbacks & event handlers
    this.onVolumeCallback = null;
    this.onTranscriptCallback = null;
    this.onStatusCallback = null;
    this.onStateChange = null;
    
    // Active Quest Context
    this.currentQuestContext = null;

    // Resampling config
    this.inputSampleRate = 16000;

    // Dual-Mode Voice: 'free' (Talk Freely hands-free) vs 'walkie' (Walkie-Talkie)
    this.voiceMode = 'free';
    this.walkieState = 'idle'; // 'idle' | 'recording'
    this.tapToInterruptRequested = false;

    // Adaptive RMS Noise Gate & Kid Buffer
    this.ambientNoiseFloor = 0.015;
    this.speechDetectedInTurn = false;
    this.lastSpeechTime = 0;
  }

  get isActive() {
    return this.isConnected;
  }

  async unlockAudio() {
    try {
      if (this.audioOutputContext && this.audioOutputContext.state === 'suspended') {
        await this.audioOutputContext.resume();
      }
      if (this.audioInputContext && this.audioInputContext.state === 'suspended') {
        await this.audioInputContext.resume();
      }
    } catch {}
  }

  setQuestContext(context) {
    this.currentQuestContext = context;
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN && context) {
      this.sendQuestContextUpdate(context);
    }
  }

  sendQuestContextUpdate(context) {
    try {
      const optionsText = Array.isArray(context.options)
        ? context.options.map((opt, i) => `[Option ${i} (${String.fromCharCode(65 + i)}): "${opt}"]`).join(', ')
        : '';
      const promptText = `[GAME CONTEXT UPDATE: Child is playing "${context.gameTitle || 'Quest'}", Question: "${context.question}". Choices: ${optionsText}. Correct answer index: ${context.correctAnswerIndex ?? 'unknown'}. Guide the child encouragingly!]`;
      
      this.sendTextMessage(promptText);
    } catch (err) {
      console.warn('Could not send live quest context update:', err);
    }
  }

  sendTextMessage(text) {
    if (!text || typeof text !== 'string') return;
    store.setLiveRexState({ lastUserTranscript: text }, true);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ text }));
    }
    // Also trigger in-game reactions for habit claims or voice actions
    try {
      import('./rexCompanionEngine.js').then(({ rexEngine }) => {
        rexEngine.tryHandleInGameSpeech(text);
      }).catch(() => {});
    } catch {}
  }

  setVoiceMode(mode) {
    this.voiceMode = mode === 'walkie' ? 'walkie' : 'free';
    this.walkieState = 'idle';
    store.setLiveRexState({ voiceMode: this.voiceMode, walkieState: this.walkieState }, true);
    const petName = store.getActivePet?.()?.name || 'Rex';
    if (this.voiceMode === 'walkie') {
      this.updateStatus('idle', `Walkie-Talkie 📻 Tap button to speak to ${petName}!`);
    } else {
      this.updateStatus('listening', `Talk Freely 🗣️ Speak anytime, ${petName} is listening!`);
    }
    try { Sound.click(); } catch {}
  }

  startWalkieRecording() {
    this.walkieState = 'recording';
    this.speechDetectedInTurn = true;
    store.setLiveRexState({ walkieState: 'recording' }, true);
    const petName = store.getActivePet?.()?.name || 'Rex';
    this.updateStatus('listening', `📻 Recording Walkie-Talkie! Speak to ${petName}...`);
    try { Sound.pop(); } catch {}
  }

  finishWalkieRecording() {
    if (this.walkieState !== 'recording') return;
    this.walkieState = 'idle';
    this.speechDetectedInTurn = false;
    store.setLiveRexState({ walkieState: 'idle' }, true);
    const petName = store.getActivePet?.()?.name || 'Rex';
    this.updateStatus('thinking', `Over and out! 📻 ${petName} is thinking...`);
    try { Sound.chirp(); } catch {}
  }

  interruptSpeech() {
    this.tapToInterruptRequested = true;
    this.stopAudioPlayback();
    const petName = store.getActivePet?.()?.name || 'Rex';
    this.updateStatus('listening', `Tap to talk! ${petName} is listening!`);
    try { Sound.chirp(); } catch {}
  }

  async connect(preferredPetId = null) {
    if (this.isConnected) return true;
    if (this.isConnecting) return false;
    this.isConnecting = true;

    const activePet = preferredPetId || store.getActivePet?.()?.id || 'rex';
    const petName = store.getActivePet?.()?.name || 'Rex the Dino';
    this.updateStatus('connecting', `Connecting to ${petName}...`);

    return new Promise((resolve, reject) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          this.cleanup();
          this.updateStatus('error', `Connection timed out. Tap to retry!`);
          reject(new Error('Connection timed out'));
        }
      }, 6000);

      try {
        // 1. Initialize Audio Output Context for 24kHz PCM Playback
        if (!this.audioOutputContext || this.audioOutputContext.state === 'closed') {
          const AudioContextClass = window.AudioContext || window.webkitAudioContext;
          if (AudioContextClass) {
            this.audioOutputContext = new AudioContextClass({ sampleRate: 24000 });
          }
        }
        if (this.audioOutputContext && this.audioOutputContext.state === 'suspended') {
          this.audioOutputContext.resume().catch(() => {});
        }

        // 2. Connect to server-side Gemini 3.1 Live WebSocket bridge
        const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
        const host = (typeof window !== 'undefined' && window.location.host) ? window.location.host : 'localhost:3000';
        const storedKey = store.getState()?.liveRex?.geminiApiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : '') || '';
        const keyParam = storedKey ? `&apiKey=${encodeURIComponent(storedKey)}` : '';
        const wsUrl = `${protocol}//${host}/api/gemini/live?pet=${encodeURIComponent(activePet)}${keyParam}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          // Connected to server bridge, waiting for handshake
        };

        this.ws.onmessage = (event) => {
          try {
            let data = event.data;
            if (typeof data === 'string') data = JSON.parse(data);
            if (data && data.status === 'ready') {
              clearTimeout(timer);
              if (!resolved) {
                resolved = true;
                this.isConnected = true;
                this.isConnecting = false;
                this.startMicrophone().then(() => {
                  this.updateStatus('listening', `${petName} is listening! Speak now!`);
                  try { Sound.chirp(); } catch {}
                  if (this.currentQuestContext) {
                    this.sendQuestContextUpdate(this.currentQuestContext);
                  }
                  resolve(true);
                }).catch(err => {
                  console.warn('Microphone permission notice:', err);
                  this.updateStatus('idle', `${petName} is ready! Tap to talk.`);
                  resolve(true);
                });
              }
              return;
            }
          } catch {}
          this.handleServerMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.warn('Gemini Live WebSocket error:', error);
          clearTimeout(timer);
          if (!resolved) {
            resolved = true;
            this.cleanup();
            this.updateStatus('error', 'Voice connection encountered a hiccup.');
            reject(new Error('WebSocket connection error'));
          }
        };

        this.ws.onclose = (event) => {
          console.log('Gemini Live WebSocket closed:', event.code, event.reason);
          clearTimeout(timer);
          this.cleanup();
          this.updateStatus('idle', `${petName} is resting. Tap to talk!`);
          if (!resolved) {
            resolved = true;
            reject(new Error('WebSocket closed before ready'));
          }
        };
      } catch (err) {
        clearTimeout(timer);
        this.cleanup();
        this.updateStatus('error', err.message || 'Microphone or network error.');
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      }
    });
  }

  async startMicrophone() {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.audioInputContext = new AudioContextClass();
      this.inputSampleRate = this.audioInputContext.sampleRate;

      const source = this.audioInputContext.createMediaStreamSource(this.mediaStream);
      // Process chunks of 4096 samples (~90ms at 44.1k/48k)
      this.scriptProcessor = this.audioInputContext.createScriptProcessor(4096, 1, 1);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected || !this.isListening) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);
        
        // Calculate RMS volume for visualizer
        let sumSquares = 0;
        for (let i = 0; i < inputChannelData.length; i++) {
          sumSquares += inputChannelData[i] * inputChannelData[i];
        }
        const rms = Math.sqrt(sumSquares / inputChannelData.length);
        const volumeLevel = Math.min(1, rms * 5);
        if (this.onVolumeCallback) {
          this.onVolumeCallback(volumeLevel, 'input');
        }

        // Tap-to-Interrupt Safeguard:
        // When Rex is actively speaking aloud, do NOT stream mic audio to avoid background noise/echo
        // triggering premature barge-in interruption. Child must tap avatar/pause button to interrupt.
        if (this.isSpeaking) {
          return;
        }

        // Adaptive Noise Gate Logic:
        // When quiet, dynamically adapt the ambient noise floor
        if (rms < this.ambientNoiseFloor * 1.5) {
          this.ambientNoiseFloor = this.ambientNoiseFloor * 0.95 + rms * 0.05;
        }
        const speechThreshold = Math.max(0.022, this.ambientNoiseFloor * 2.2);

        // Mode-Specific Handling
        if (this.voiceMode === 'walkie') {
          // Walkie-talkie mode: only stream when explicitly in recording state
          if (this.walkieState !== 'recording') {
            return;
          }
        } else {
          // 'free' mode: Talk Freely with adaptive VAD & 1.8-second kid silence buffer
          if (rms >= speechThreshold) {
            this.speechDetectedInTurn = true;
            this.lastSpeechTime = Date.now();
          } else if (this.speechDetectedInTurn) {
            if (Date.now() - this.lastSpeechTime >= 1800) {
              this.speechDetectedInTurn = false;
              const petName = store.getActivePet?.()?.name || 'Rex';
              this.updateStatus('thinking', `${petName} is thinking...`);
            }
          }
        }

        // Downsample input from hardware sample rate to 16,000 Hz PCM
        const downsampled = this.downsampleBuffer(inputChannelData, this.inputSampleRate, 16000);
        const pcm16Buffer = this.floatTo16BitPCM(downsampled);
        const base64Audio = this.arrayBufferToBase64(pcm16Buffer);

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioInputContext.destination);
      this.isListening = true;
    } catch (err) {
      console.error('Microphone capture error:', err);
      throw new Error('Microphone permission required for Live Voice.');
    }
  }

  stopMicrophone() {
    this.isListening = false;
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch {}
      this.scriptProcessor = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioInputContext && this.audioInputContext.state !== 'closed') {
      try {
        this.audioInputContext.close();
      } catch {}
      this.audioInputContext = null;
    }
  }

  handleServerMessage(rawMessage) {
    try {
      let data = rawMessage;
      if (typeof rawMessage === 'string') {
        data = JSON.parse(rawMessage);
      } else if (rawMessage instanceof Blob) {
        const reader = new FileReader();
        reader.onload = () => this.handleServerMessage(reader.result);
        reader.readAsText(rawMessage);
        return;
      }

      // 1. Initial Handshake Ready
      if (data.status === 'ready') {
        this.isConnecting = false;
        this.startMicrophone().then(() => {
          const petName = store.getActivePet?.()?.name || 'Rex';
          const msg = this.voiceMode === 'walkie'
            ? `Walkie-Talkie 📻 Tap button to speak to ${petName}!`
            : `Talk Freely 🗣️ Speak anytime, ${petName} is listening!`;
          this.updateStatus(this.voiceMode === 'walkie' ? 'idle' : 'listening', msg);
          try { Sound.chirp(); } catch {}
          if (this.currentQuestContext) {
            this.sendQuestContextUpdate(this.currentQuestContext);
          }
        }).catch(err => {
          this.updateStatus('error', 'Microphone: ' + err.message);
        });
        return;
      }

      // 2. Interruption Handling (Tap-to-Interrupt Only safeguard)
      if (data.interrupted) {
        if (this.tapToInterruptRequested) {
          this.tapToInterruptRequested = false;
          this.stopAudioPlayback();
          this.isSpeaking = false;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('companion-speech-end', { detail: { petId: store.getActivePet?.()?.id || 'rex' } }));
          }
          const petName = store.getActivePet?.()?.name || 'Rex';
          this.updateStatus('listening', `${petName} is listening!`);
        }
        return;
      }

      // 3. Audio Chunk from Gemini Live (24kHz PCM)
      if (data.audio) {
        this.playAudioChunk(data.audio);
      }

      // 4. Transcription Text from Rex
      if (data.text) {
        store.setLiveRexState({ lastRexTranscript: data.text }, true);
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(data.text, 'rex');
        }
      }

      // 5. User spoken text from Gemini Live
      if (data.userText) {
        store.setLiveRexState({ lastUserTranscript: data.userText }, true);
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(data.userText, 'user');
        }
        // In-game actions (e.g. Toothbrush battle commands, dance party moves, habit completion)
        try {
          import('./rexCompanionEngine.js').then(({ rexEngine }) => {
            rexEngine.tryHandleInGameSpeech(data.userText);
          }).catch(() => {});
        } catch {}
      }

      // 6. Turn Complete
      if (data.turnComplete) {
        // Handled naturally when audio sources finish
      }

      // 7. Error status from server
      if (data.error) {
        console.warn('Gemini Live server error:', data.error);
        this.updateStatus('error', data.error);
      }
    } catch (err) {
      console.warn('Error parsing server message:', err);
    }
  }

  playAudioChunk(base64Data) {
    try {
      if (!this.audioOutputContext || this.audioOutputContext.state === 'closed') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioOutputContext = new AudioContextClass({ sampleRate: 24000 });
      }

      const pcm16Data = this.base64ToInt16Array(base64Data);
      const float32Data = new Float32Array(pcm16Data.length);
      for (let i = 0; i < pcm16Data.length; i++) {
        float32Data[i] = pcm16Data[i] / 32768.0;
      }

      // Calculate output volume for waveform bars
      let sumSquares = 0;
      for (let i = 0; i < float32Data.length; i++) {
        sumSquares += float32Data[i] * float32Data[i];
      }
      const rms = Math.sqrt(sumSquares / float32Data.length);
      const volumeLevel = Math.min(1, rms * 4);
      if (this.onVolumeCallback) {
        this.onVolumeCallback(volumeLevel, 'output');
      }

      const audioBuffer = this.audioOutputContext.createBuffer(1, float32Data.length, 24000);
      audioBuffer.getChannelData(0).set(float32Data);

      const source = this.audioOutputContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioOutputContext.destination);

      const currentTime = this.audioOutputContext.currentTime;
      const startTime = Math.max(currentTime, this.nextAudioPlayTime);
      source.start(startTime);
      this.nextAudioPlayTime = startTime + audioBuffer.duration;

      const wasEmpty = this.activeAudioSources.length === 0;
      this.activeAudioSources.push(source);
      this.isSpeaking = true;
      const petName = store.getActivePet?.()?.name || 'Rex';
      this.updateStatus('speaking', `${petName} is talking!`);

      if (wasEmpty && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('companion-speech-start', {
          detail: { petId: store.getActivePet?.()?.id || 'rex' }
        }));
      }

      source.onended = () => {
        const idx = this.activeAudioSources.indexOf(source);
        if (idx !== -1) this.activeAudioSources.splice(idx, 1);
        if (this.activeAudioSources.length === 0) {
          this.isSpeaking = false;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('companion-speech-end', {
              detail: { petId: store.getActivePet?.()?.id || 'rex' }
            }));
          }
          if (this.isConnected && this.isListening) {
            this.updateStatus('listening', `${petName} is listening!`);
          }
        }
      };
    } catch (err) {
      console.warn('Error playing live audio chunk:', err);
    }
  }

  stopAudioPlayback() {
    for (const source of this.activeAudioSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeAudioSources = [];
    if (this.audioOutputContext) {
      this.nextAudioPlayTime = this.audioOutputContext.currentTime;
    }
    this.isSpeaking = false;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('companion-speech-end', {
        detail: { petId: store.getActivePet?.()?.id || 'rex' }
      }));
    }
  }

  disconnect() {
    this.cleanup();
    const petName = store.getActivePet?.()?.name || 'Rex the Dino';
    this.updateStatus('idle', `${petName} is resting. Tap to talk!`);
    try { Sound.chirp(); } catch {}
  }

  cleanup() {
    this.stopMicrophone();
    this.stopAudioPlayback();
    this.isConnected = false;
    this.isConnecting = false;
    this.isListening = false;
    this.isSpeaking = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  updateStatus(status, message) {
    store.setLiveRexState({
      status,
      statusMessage: message,
      isConnected: this.isConnected,
      isListening: this.isListening,
      isSpeaking: this.isSpeaking
    }, true);
    if (this.onStatusCallback) {
      this.onStatusCallback(status, message);
    }
    if (this.onStateChange) {
      this.onStateChange(status);
    }
  }

  async askRexInteractions(promptText) {
    return this.askRexChat(promptText, 'smart');
  }

  // Quick Chat interaction using server-side Gemini 3.7 Flash / 3.1 Flash Lite proxy
  async askRexChat(promptText, speedMode = 'smart') {
    if (!promptText || !promptText.trim()) return;

    const petId = store.getActivePet?.()?.id || 'rex';
    const petName = store.getActivePet?.()?.name || 'Rex the Dino';
    const childName = store.getState().selectedHero?.name || 'Little Hero';
    const storedKey = store.getState()?.liveRex?.geminiApiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : '') || '';

    this.updateStatus('connecting', `${petName} is thinking...`);
    store.setLiveRexState({ lastUserTranscript: promptText }, true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: promptText,
          petId,
          speedMode,
          childName,
          apiKey: storedKey
        })
      });

      if (!response.ok) {
        throw new Error(`Chat HTTP error: ${response.status}`);
      }

      const result = await response.json();
      if (result && result.reply) {
        store.setLiveRexState({ lastRexTranscript: result.reply }, true);

        // If a habit was completed, auto-award it
        if (result.awardedHabit) {
          store.claimCompanionHabit(result.awardedHabit);
          triggerInteractiveCelebration();
        }

        // Speak aloud using realistic kid-friendly voice
        speakCompanion(result.reply, petId, () => {
          this.updateStatus('idle', `${petName} is ready!`);
        });
        this.updateStatus('speaking', `${petName} is talking!`);
        return result.reply;
      }
    } catch (err) {
      console.warn('Chat error, falling back to rich local voice prompt:', err);
      const clean = promptText.toLowerCase();
      let fallback = `*Happy roar!* You are doing super, Little Hero! Let's do our quests together!`;

      if (/joke/i.test(clean)) {
        const jokes = [
          "What do you call a sleeping dinosaur? A dino-snore! *Hahaha!* 🦖💤",
          "Why did the T-Rex cross the road? To catch the super hero bus! *Giggle!* 🚌🦖",
          "What is a dinosaur's favorite school subject? His-tree-history! *Roar!* 📚🦕"
        ];
        fallback = jokes[Math.floor(Math.random() * jokes.length)];
      } else if (/teeth|brush/i.test(clean)) {
        const res = store.claimCompanionHabit('teeth');
        fallback = `*Sparkle smile!* +${res.coins} Coins! Scrub round and round, top and bottom! Clean teeth give you super hero strength! 🪥✨`;
        triggerInteractiveCelebration();
      } else if (/water|drink/i.test(clean)) {
        const res = store.claimCompanionHabit('water');
        fallback = `*Gulp gulp!* +${res.coins} Coins! Super hero hydration! Cold fresh water powers up your brain and muscles! 💧🦖`;
        triggerInteractiveCelebration();
      } else if (/toy|clean/i.test(clean)) {
        const res = store.claimCompanionHabit('toys');
        fallback = `*Tidy champion!* +${res.coins} Coins! All toys safely in their home! Great teamwork, Little Hero! 🧸⭐`;
        triggerInteractiveCelebration();
      } else if (/snack|fruit|eat/i.test(clean)) {
        const res = store.claimCompanionHabit('snack');
        fallback = `*Crunch crunch!* +${res.coins} Coins! Yummy vitamins! Healthy snacks give you unstoppable dinosaur energy! 🍎🥦`;
        triggerInteractiveCelebration();
      } else if (/bedtime|story|sleep/i.test(clean)) {
        fallback = `Once upon a time, a brave little hero flew across the starry sky with their dinosaur buddy, dreaming happy dreams. Close your eyes, superhero! 🌙⭐`;
      } else if (/hint|help|clue/i.test(clean)) {
        fallback = `*Dino clue!* Look carefully at the bright colors and shapes on your screen! You've got this! 🌟🦖`;
      }

      store.setLiveRexState({ lastRexTranscript: fallback }, true);
      speakCompanion(fallback, petId);
      this.updateStatus('idle', `${petName} is ready!`);
      return fallback;
    }
  }

  // Linear resampling helper from input rate to 16kHz
  downsampleBuffer(buffer, inputSampleRate, outputSampleRate = 16000) {
    if (inputSampleRate === outputSampleRate) return buffer;
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  floatTo16BitPCM(float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    let offset = 0;
    for (let i = 0; i < float32Array.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }

  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToInt16Array(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Int16Array(bytes.buffer);
  }
}

export const geminiLiveService = new GeminiLiveService();
