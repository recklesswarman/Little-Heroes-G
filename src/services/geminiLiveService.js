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
    if (this.ws && this.ws.readyState === WebSocket.OPEN && text) {
      this.ws.send(JSON.stringify({ text }));
    }
  }

  async connect(preferredPetId = null) {
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    const activePet = preferredPetId || store.getActivePet?.()?.id || 'rex';
    const petName = store.getActivePet?.()?.name || 'Rex the Dino';
    this.updateStatus('connecting', `Connecting to ${petName}...`);

    try {
      // 1. Initialize Audio Output Context for 24kHz PCM Playback
      if (!this.audioOutputContext || this.audioOutputContext.state === 'closed') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioOutputContext = new AudioContextClass({ sampleRate: 24000 });
      }
      if (this.audioOutputContext.state === 'suspended') {
        await this.audioOutputContext.resume().catch(() => {});
      }

      // 2. Connect to server-side Gemini 3.8 Live WebSocket bridge
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/gemini/live?pet=${encodeURIComponent(activePet)}`;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Connected to server bridge
        this.isConnected = true;
      };

      this.ws.onmessage = (event) => {
        this.handleServerMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.warn('Gemini Live WebSocket error:', error);
        this.updateStatus('error', 'Voice connection encountered a hiccup.');
      };

      this.ws.onclose = (event) => {
        console.log('Gemini Live WebSocket closed:', event.code, event.reason);
        this.cleanup();
        this.updateStatus('idle', `${petName} is resting. Tap to talk!`);
      };
    } catch (err) {
      console.error('Failed to connect to Gemini Live:', err);
      this.cleanup();
      this.updateStatus('error', err.message || 'Microphone or network error.');
    }
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
          this.updateStatus('listening', `${petName} is listening! Speak now!`);
          try { Sound.chirp(); } catch {}
          if (this.currentQuestContext) {
            this.sendQuestContextUpdate(this.currentQuestContext);
          }
        }).catch(err => {
          this.updateStatus('error', 'Microphone: ' + err.message);
        });
        return;
      }

      // 2. Interruption Handling (Barge-in: child spoke while model was speaking)
      if (data.interrupted) {
        this.stopAudioPlayback();
        this.isSpeaking = false;
        const petName = store.getActivePet?.()?.name || 'Rex';
        this.updateStatus('listening', `${petName} is listening!`);
        return;
      }

      // 3. Audio Chunk from Gemini 3.8 Live (24kHz PCM)
      if (data.audio) {
        this.playAudioChunk(data.audio);
      }

      // 4. Transcription Text
      if (data.text) {
        store.setLiveRexState({ lastRexTranscript: data.text });
        if (this.onTranscriptCallback) {
          this.onTranscriptCallback(data.text, 'rex');
        }
      }

      // 5. Turn Complete
      if (data.turnComplete) {
        // Handled naturally when audio sources finish
      }

      // 6. Error status from server
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

      this.activeAudioSources.push(source);
      this.isSpeaking = true;
      const petName = store.getActivePet?.()?.name || 'Rex';
      this.updateStatus('speaking', `${petName} is talking!`);

      source.onended = () => {
        const idx = this.activeAudioSources.indexOf(source);
        if (idx !== -1) this.activeAudioSources.splice(idx, 1);
        if (this.activeAudioSources.length === 0) {
          this.isSpeaking = false;
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

  // Quick Chat interaction using server-side Gemini 3.5 Flash / 3.1 Flash Lite proxy
  async askRexChat(promptText, speedMode = 'smart') {
    if (!promptText || !promptText.trim()) return;

    const petId = store.getActivePet?.()?.id || 'rex';
    const petName = store.getActivePet?.()?.name || 'Rex the Dino';
    const childName = store.getState().selectedHero?.name || 'Little Hero';

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
          childName
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
          store.toggleHabitIsland(result.awardedHabit);
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
      console.warn('Chat error, falling back to local voice prompt:', err);
      const fallback = `*Happy roar!* You are doing super, Little Hero! Let's do our quests together!`;
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
