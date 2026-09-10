// Gemini Multimodal Live API Service for Rex the Dino
// Connects browser directly over low-latency bidirectional WebSocket (wss://generativelanguage.googleapis.com/ws/...)
// Streams raw microphone 16kHz PCM audio and plays back natural 24kHz audio tokens directly.

import { store } from "../state/store.js";

const DEFAULT_API_KEY = "AIzaSyA8bu_j-_7Wr1DW_dS3qHESuCFG08_i4Ic";

export class RexLiveSession {
  constructor(apiKey) {
    this.apiKey =
      apiKey ||
      (typeof import.meta !== "undefined" &&
        (import.meta.env?.VITE_GEMINI_API_KEY || import.meta.env?.VITE_FIREBASE_API_KEY)) ||
      localStorage.getItem("gemini_api_key") ||
      DEFAULT_API_KEY;

    this.ws = null;
    this.audioContext = null;
    this.mediaStream = null;
    this.processor = null;
    this.onStateChange = null;
    this.onTranscript = null;
    this.onVolume = null;

    // Continuous audio playhead for smooth PCM streaming
    this.nextAudioPlayTime = 0;
    this.activeSources = [];
    this.isActive = false;
  }

  async startSession(heroName = "Kayden") {
    try {
      this.stopSession(); // Clean up any lingering session

      // Audio context for 16kHz microphone capture and 24kHz Gemini output playback
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx({ sampleRate: 16000 });
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      this.nextAudioPlayTime = this.audioContext.currentTime;
      this.isActive = true;

      // Connect to Gemini Live bidirectional WebSocket endpoint
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = async () => {
        console.log("🦖 Rex Gemini Live WebSocket connected successfully!");
        if (this.onStateChange) this.onStateChange("listening");

        store.setLiveRexState({
          status: "listening",
          isListening: true,
          isSpeaking: false,
          statusMessage: "Rex is listening live! Speak to your dino buddy!"
        });

        // Send setup payload with Rex persona and voice choice
        const setupMessage = {
          setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: "Puck" // High-energy, playful tone for a friendly dino
                  }
                }
              }
            },
            systemInstruction: {
              parts: [
                {
                  text: `You are Rex the Dino in Little Heroes talking live to ${heroName}. Speak enthusiastically in 1 short sentence. Praise their daily habits!`
                }
              ]
            }
          }
        };

        this.ws.send(JSON.stringify(setupMessage));
        await this.startMicrophoneStream();
      };

      this.ws.onmessage = async (event) => {
        let data;
        try {
          if (event.data instanceof Blob) {
            data = JSON.parse(await event.data.text());
          } else {
            data = JSON.parse(event.data);
          }
        } catch (parseErr) {
          console.warn("Rex Live JSON parse notice:", parseErr);
          return;
        }

        // Handle barge-in / interruption
        if (data.serverContent?.interrupted) {
          this.stopAudioPlayback();
          if (this.onStateChange) this.onStateChange("listening");
          store.setLiveRexState({
            status: "listening",
            isListening: true,
            isSpeaking: false,
            statusMessage: "Rex is listening!"
          });
        }

        // Transcriptions if available
        if (data.serverContent?.inputTranscription?.text) {
          const userText = data.serverContent.inputTranscription.text;
          store.setLiveRexState({ lastUserTranscript: userText });
          if (this.onTranscript) this.onTranscript(userText, "user");
        }

        // Process all parts in modelTurn (audio chunks & text)
        const parts = data.serverContent?.modelTurn?.parts || [];
        for (const part of parts) {
          if (part.text) {
            store.setLiveRexState({ lastRexTranscript: part.text });
            if (this.onTranscript) this.onTranscript(part.text, "rex");
          }

          const audioData = part.inlineData?.data;
          if (audioData) {
            if (this.onStateChange) this.onStateChange("talking");
            store.setLiveRexState({
              status: "talking",
              isListening: false,
              isSpeaking: true,
              statusMessage: "Rex is talking live!"
            });
            this.playPCMChunk(audioData);
          }
        }

        if (data.serverContent?.turnComplete) {
          if (this.onStateChange) this.onStateChange("listening");
          store.setLiveRexState({
            status: "listening",
            isListening: true,
            isSpeaking: false,
            statusMessage: "Rex is listening! Keep chatting!"
          });
        }
      };

      this.ws.onerror = (err) => {
        console.error("Gemini Live WebSocket error:", err);
        store.setLiveRexState({
          status: "error",
          statusMessage: "Rex Live voice connection hiccup. Tap to retry!"
        });
        if (this.onStateChange) this.onStateChange("idle");
      };

      this.ws.onclose = (event) => {
        console.log("Rex Gemini Live WebSocket closed:", event.code, event.reason);
        this.stopSession();
      };
    } catch (err) {
      console.error("Failed to start Rex Live Session:", err);
      store.setLiveRexState({
        status: "error",
        statusMessage: err?.message || "Could not access microphone."
      });
      if (this.onStateChange) this.onStateChange("idle");
      throw err;
    }
  }

  async startMicrophoneStream() {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // Convert float32 microphone input to 16-bit PCM for Gemini
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);

      // Volume calculation for UI waveforms
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sum / inputData.length);
      const volumeLevel = Math.min(1, rms * 5);
      if (this.onVolume) this.onVolume(volumeLevel, "input");

      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
      }

      // Base64 encode PCM bytes
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(pcm16.buffer)));
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            realtimeInput: {
              mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: base64Audio }]
            }
          })
        );
      }
    };

    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  playPCMChunk(base64Data) {
    if (!this.audioContext || this.audioContext.state === "closed") return;

    const raw = atob(base64Data);
    const buffer = new ArrayBuffer(raw.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const pcm16 = new Int16Array(buffer);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x7fff;

    // Volume calculation for output audio
    let sum = 0;
    for (let i = 0; i < float32.length; i++) {
      sum += float32[i] * float32[i];
    }
    const rms = Math.sqrt(sum / float32.length);
    const volumeLevel = Math.min(1, rms * 4);
    if (this.onVolume) this.onVolume(volumeLevel, "output");

    const audioBuf = this.audioContext.createBuffer(1, float32.length, 24000);
    audioBuf.copyToChannel(float32, 0);

    const playSource = this.audioContext.createBufferSource();
    playSource.buffer = audioBuf;
    playSource.connect(this.audioContext.destination);

    // Schedule seamlessly on continuous playhead
    const currentTime = this.audioContext.currentTime;
    const startTime = Math.max(currentTime, this.nextAudioPlayTime);
    playSource.start(startTime);
    this.nextAudioPlayTime = startTime + audioBuf.duration;

    this.activeSources.push(playSource);

    playSource.onended = () => {
      const idx = this.activeSources.indexOf(playSource);
      if (idx !== -1) this.activeSources.splice(idx, 1);
      if (this.activeSources.length === 0) {
        if (this.onStateChange && this.isActive) {
          this.onStateChange("listening");
        }
      }
    };
  }

  stopAudioPlayback() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {}
    }
    this.activeSources = [];
    if (this.audioContext) {
      this.nextAudioPlayTime = this.audioContext.currentTime;
    }
  }

  stopSession() {
    this.isActive = false;
    this.stopAudioPlayback();
    try {
      this.processor?.disconnect();
    } catch {}
    this.processor = null;

    try {
      this.mediaStream?.getTracks().forEach((t) => t.stop());
    } catch {}
    this.mediaStream = null;

    try {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        this.ws.close();
      }
    } catch {}
    this.ws = null;

    try {
      if (this.audioContext && this.audioContext.state !== "closed") {
        this.audioContext.close();
      }
    } catch {}
    this.audioContext = null;

    if (this.onStateChange) this.onStateChange("idle");
    store.setLiveRexState({
      status: "idle",
      isListening: false,
      isSpeaking: false,
      statusMessage: "Tap Rex to talk!"
    });
  }
}

export const rexLiveSession = new RexLiveSession();
