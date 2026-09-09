// Gemini Live API & Interactions API Service for Rex the Dino
// Provides real-time bidirectional voice conversations, barge-in interruptions,
// live quest guidance, and interactive tool calls for toddlers.

import { store } from '../state/store.js';
import { voicePrompts } from '../utils/voicePrompts.js';
import { Sound } from '../audio/sfx.js';
import { triggerInteractiveCelebration } from '../components/InteractiveCelebrationOverlay.js';

const LIVE_WS_ENDPOINT = 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
const INTERACTIONS_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const DEFAULT_FALLBACK_KEY = 'AIzaSyA8bu_j-_7Wr1DW_dS3qHESuCFG08_i4Ic';

class GeminiLiveService {
  constructor() {
    this.ws = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isListening = false;
    this.isSpeaking = false;
    
    // Audio contexts & nodes
    this.audioInputContext = null;
    this.mediaStream = null;
    this.scriptProcessor = null;
    this.audioOutputContext = null;
    this.nextAudioPlayTime = 0;
    this.activeAudioSources = [];
    
    // Visualizer callbacks
    this.onVolumeCallback = null;
    this.onTranscriptCallback = null;
    this.onStatusCallback = null;
    
    // Active Quest Context
    this.currentQuestContext = null;

    // Resampling buffer
    this.inputSampleRate = 16000;
  }

  getApiKey() {
    const state = store.getState();
    return (
      state.liveRex?.geminiApiKey ||
      localStorage.getItem('gemini_api_key') ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) ||
      DEFAULT_FALLBACK_KEY
    );
  }

  getVoiceName() {
    const state = store.getState();
    return state.liveRex?.voiceName || 'Puck';
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
        ? context.options.map((opt, i) => `[Option ${String.fromCharCode(65 + i)}: "${opt}"]`).join(', ')
        : '';
      const promptText = `[GAME CONTEXT UPDATE: Child is currently playing the adventure quest "${context.gameTitle || 'Mini-Game'}", Stop ${context.currentStop || 1} of ${context.totalStops || 1}. Current question on screen: "${context.question}". Available choices: ${optionsText}. If the child says their answer, call the tool 'answerQuestChallenge'. If they ask for help, call 'giveEncouragingHint'.]`;
      
      const updateMsg = {
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text: promptText }]
            }
          ],
          turnComplete: false
        }
      };
      this.ws.send(JSON.stringify(updateMsg));
    } catch (err) {
      console.warn('Could not send live quest context update:', err);
    }
  }

  async connect() {
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;
    this.updateStatus('connecting', 'Connecting to Rex the Dino...');

    const apiKey = this.getApiKey();
    if (!apiKey) {
      this.updateStatus('error', 'Please enter a Gemini API Key in Parent Settings.');
      this.isConnecting = false;
      return;
    }

    try {
      // 1. Initialize Audio Output Context for 24kHz PCM Playback
      if (!this.audioOutputContext || this.audioOutputContext.state === 'closed') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.audioOutputContext = new AudioContextClass({ sampleRate: 24000 });
      }
      if (this.audioOutputContext.state === 'suspended') {
        await this.audioOutputContext.resume();
      }

      // 2. Connect to Gemini Live WebSocket
      const url = `${LIVE_WS_ENDPOINT}?key=${apiKey}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        this.isConnected = true;
        this.isConnecting = false;
        this.sendSetupMessage();
        await this.startMicrophone();
        this.updateStatus('listening', 'Rex is listening! Talk to Rex!');
        Sound.chirp();

        // If there is already a quest context, share it immediately
        if (this.currentQuestContext) {
          this.sendQuestContextUpdate(this.currentQuestContext);
        }
      };

      this.ws.onmessage = (event) => {
        this.handleServerMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.warn('Rex Gemini Live WebSocket error:', error);
        this.updateStatus('error', 'Rex connection encountered a hiccup.');
      };

      this.ws.onclose = (event) => {
        console.log('Rex Gemini Live WebSocket closed:', event.code, event.reason);
        this.cleanup();
        this.updateStatus('idle', 'Rex is resting. Tap to talk!');
      };
    } catch (err) {
      console.error('Failed to connect to Rex Gemini Live:', err);
      this.cleanup();
      this.updateStatus('error', err.message || 'Microphone or network error.');
    }
  }

  sendSetupMessage() {
    const voiceName = this.getVoiceName();
    const systemPrompt = `You are Rex the Dino, an adorable, enthusiastic cartoon dinosaur companion and superhero guide for toddlers (ages 3-4) in the Little Hero Adventures app!
Personality & Voice:
- You are warm, ultra-supportive, playful, and cheerful. You love roaring softly ("Rawr!"), laughing, and cheering "Super Hero Power!".
- You speak English in short, bite-sized toddler sentences (maximum 1-2 sentences at a time).
- When a toddler is playing a learning adventure (like Phonics Forest, Counting Meadow, Color Cavern, Rhyme Rocks), listen closely to what they say.
- If the toddler speaks or guesses an answer to the challenge question:
  Immediately call the tool 'answerQuestChallenge' with the 0-based optionIndex and optionText.
- If the toddler asks for a hint or sounds confused:
  Call the tool 'giveEncouragingHint' with a simple, friendly clue.
- If the child completes a challenge or says they won:
  Call the tool 'celebrateHeroicVictory' with a fun celebration cheer!
- Never break character. You are their trusted dinosaur best buddy!`;

    const setupMessage = {
      setup: {
        model: 'models/gemini-3.1-flash-live-preview',
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceName
              }
            }
          },
          thinkingConfig: {
            thinkingLevel: 'minimal'
          }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        tools: [
          {
            functionDeclarations: [
              {
                name: 'answerQuestChallenge',
                description: 'Select an answer option for the child in their current learning quest challenge when they speak the answer aloud.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    optionIndex: {
                      type: 'INTEGER',
                      description: '0-based index of the chosen option (0 for A, 1 for B, 2 for C, etc.)'
                    },
                    optionText: {
                      type: 'STRING',
                      description: 'The option text or label that was chosen'
                    },
                    explanation: {
                      type: 'STRING',
                      description: 'Brief toddler-friendly encouragement explaining the answer'
                    }
                  },
                  required: ['optionIndex']
                }
              },
              {
                name: 'giveEncouragingHint',
                description: 'Provide an encouraging, simple clue for the toddler without directly spoiling the answer.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    hintText: {
                      type: 'STRING',
                      description: 'Playful toddler hint'
                    }
                  },
                  required: ['hintText']
                }
              },
              {
                name: 'celebrateHeroicVictory',
                description: 'Trigger a burst of stars, confetti, and celebratory sound effects for the child.',
                parameters: {
                  type: 'OBJECT',
                  properties: {
                    cheeringPhrase: {
                      type: 'STRING',
                      description: 'Super celebratory phrase'
                    }
                  },
                  required: ['cheeringPhrase']
                }
              }
            ]
          }
        ]
      }
    };

    this.ws.send(JSON.stringify(setupMessage));
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

        // Send realtime audio packet
        const audioMessage = {
          realtimeInput: {
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: base64Audio
              }
            ],
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: base64Audio
            }
          }
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(audioMessage));
        }
      };

      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioInputContext.destination);
      this.isListening = true;
    } catch (err) {
      console.error('Microphone capture error:', err);
      throw new Error('Microphone permission required for Rex Live Voice.');
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
        // Parse blob
        const reader = new FileReader();
        reader.onload = () => this.handleServerMessage(reader.result);
        reader.readAsText(rawMessage);
        return;
      }

      // 1. Interruption handling (barge-in: child spoke while Rex was speaking)
      if (data.serverContent?.interrupted) {
        this.stopAudioPlayback();
        this.isSpeaking = false;
        this.updateStatus('listening', 'Rex is listening!');
      }

      // 2. Transcriptions (User or Model)
      if (data.serverContent?.inputTranscription?.text) {
        const text = data.serverContent.inputTranscription.text;
        store.setLiveRexState({ lastUserTranscript: text });
        if (this.onTranscriptCallback) this.onTranscriptCallback(text, 'user');
      }

      // 3. Audio / Model Turn Data
      const parts = data.serverContent?.modelTurn?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (part.text) {
            store.setLiveRexState({ lastRexTranscript: part.text });
            if (this.onTranscriptCallback) this.onTranscriptCallback(part.text, 'rex');
          }

          if (part.inlineData?.data && part.inlineData.mimeType?.includes('audio')) {
            this.playAudioChunk(part.inlineData.data);
          }
        }
      }

      // 4. Tool / Function Calls
      if (data.toolCall?.functionCalls) {
        this.handleToolCalls(data.toolCall.functionCalls);
      }
    } catch (err) {
      console.warn('Error parsing Rex server message:', err);
    }
  }

  handleToolCalls(functionCalls) {
    const functionResponses = [];

    for (const call of functionCalls) {
      const { id, name, args } = call;

      if (name === 'answerQuestChallenge') {
        const optIdx = typeof args.optionIndex === 'number' ? args.optionIndex : parseInt(args.optionIndex, 10);
        window.dispatchEvent(
          new CustomEvent('rex-live-answer', {
            detail: {
              optionIndex: optIdx,
              optionText: args.optionText || '',
              explanation: args.explanation || ''
            }
          })
        );
        functionResponses.push({
          id,
          name,
          response: {
            result: {
              status: 'success',
              message: `Answered option index ${optIdx}`
            }
          }
        });
      } else if (name === 'giveEncouragingHint') {
        window.dispatchEvent(
          new CustomEvent('rex-live-hint', {
            detail: { hintText: args.hintText }
          })
        );
        functionResponses.push({
          id,
          name,
          response: {
            result: {
              status: 'success',
              hintProvided: args.hintText
            }
          }
        });
      } else if (name === 'celebrateHeroicVictory') {
        triggerInteractiveCelebration();
        window.dispatchEvent(
          new CustomEvent('rex-live-celebrate', {
            detail: { phrase: args.cheeringPhrase }
          })
        );
        functionResponses.push({
          id,
          name,
          response: {
            result: {
              status: 'success',
              celebrationStarted: true
            }
          }
        });
      } else {
        functionResponses.push({
          id,
          name,
          response: {
            result: { status: 'unknown_function' }
          }
        });
      }
    }

    // Send back tool responses
    if (this.ws && this.ws.readyState === WebSocket.OPEN && functionResponses.length > 0) {
      this.ws.send(
        JSON.stringify({
          toolResponse: {
            functionResponses
          }
        })
      );
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

      // Calculate output volume for waveform
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
      this.updateStatus('speaking', 'Rex is talking!');

      source.onended = () => {
        const idx = this.activeAudioSources.indexOf(source);
        if (idx !== -1) this.activeAudioSources.splice(idx, 1);
        if (this.activeAudioSources.length === 0) {
          this.isSpeaking = false;
          if (this.isConnected && this.isListening) {
            this.updateStatus('listening', 'Rex is listening!');
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
    this.updateStatus('idle', 'Rex is resting. Tap to talk!');
    Sound.chirp();
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
    });
    if (this.onStatusCallback) {
      this.onStatusCallback(status, message);
    }
  }

  // Quick fallback and multi-modal inquiry using Gemini Interactions API (gemini-3.7-flash)
  async askRexInteractions(promptText) {
    const apiKey = this.getApiKey();
    if (!apiKey) return;

    this.updateStatus('connecting', 'Rex is thinking...');
    store.setLiveRexState({ lastUserTranscript: promptText });

    const contextText = this.currentQuestContext
      ? `Active quest: ${this.currentQuestContext.gameTitle}, Question: "${this.currentQuestContext.question}". Choices: ${JSON.stringify(this.currentQuestContext.options)}.`
      : 'Exploring the Hero Kingdom.';

    try {
      const response = await fetch(`${INTERACTIONS_API_ENDPOINT}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.7-flash',
          input: promptText,
          system_instruction: `You are Rex the Dino, a cheerful dinosaur buddy for toddlers (ages 3-4) in Little Hero Adventures. Answer in 1-2 friendly, joyful, enthusiastic sentences suitable for toddlers. Context: ${contextText}`,
          generation_config: {
            thinking_level: 'minimal'
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Interactions API HTTP error: ${response.status}`);
      }

      const result = await response.json();
      let reply = '';
      
      // Extract output text
      if (result.output_text) {
        reply = result.output_text;
      } else if (Array.isArray(result.steps)) {
        for (const step of result.steps) {
          if (step.type === 'model_output' && Array.isArray(step.content)) {
            for (const part of step.content) {
              if (part.text) reply += part.text;
            }
          }
        }
      }

      if (reply) {
        store.setLiveRexState({ lastRexTranscript: reply });
        voicePrompts.speak(reply);
        this.updateStatus('speaking', 'Rex is talking!');
      } else {
        this.updateStatus('idle', 'Rex is ready!');
      }
    } catch (err) {
      console.warn('Interactions API error, falling back to local voice prompt:', err);
      voicePrompts.speak("You can do it, little hero! Tap the right answer!");
      this.updateStatus('idle', 'Rex is ready!');
    }
  }

  // Linear resampling helper
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
