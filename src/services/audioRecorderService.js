// Toddler-Friendly Audio Recorder & Soundwave Visualizer Service
// Captures kid microphone audio via MediaRecorder + Web Audio API AnalyserNode,
// with dual zero-cost Web Speech API transcription and raw audio blob export.

class AudioRecorderService {
  constructor() {
    this.mediaStream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.dataChunks = [];
    this.isRecording = false;
    this.startTime = 0;
    this.volumeAnimId = null;
    this.onVolumeCallback = null;
    
    // Free local speech recognition for zero-latency local transcript
    const SpeechRecognition = typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    this.recognition = SpeechRecognition ? new SpeechRecognition() : null;
    if (this.recognition) {
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }
    this.currentTranscript = '';
  }

  /**
   * Determine best supported audio mime type for this browser
   */
  getSupportedMimeType() {
    if (typeof MediaRecorder === 'undefined') return 'audio/webm';
    const candidateTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav'
    ];
    for (const t of candidateTypes) {
      if (MediaRecorder.isTypeSupported(t)) return t;
    }
    return '';
  }

  /**
   * Request microphone permission and warm up audio stream
   */
  async requestMicPermission() {
    if (this.mediaStream && this.mediaStream.active) {
      return this.mediaStream;
    }
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('MICROPHONE_UNSUPPORTED');
    }
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      return this.mediaStream;
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        throw new Error('PERMISSION_DENIED');
      }
      throw err;
    }
  }

  /**
   * Begins Hold-to-Talk audio recording with live volume visualization callback
   * @param {Function} onVolumeCallback (volume: number 0..1, freqData: Uint8Array) => void
   */
  async startRecording(onVolumeCallback = null) {
    if (this.isRecording) return;
    
    const stream = await this.requestMicPermission();
    this.isRecording = true;
    this.startTime = Date.now();
    this.dataChunks = [];
    this.currentTranscript = '';
    this.onVolumeCallback = onVolumeCallback;

    // 1. Audio Analyser for live bouncing soundwave bars
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64; // 32 frequency bins
        source.connect(this.analyser);
        this.startVisualizerLoop();
      }
    } catch (audioCtxErr) {
      console.warn('[AudioRecorder] Visualizer AudioContext notice:', audioCtxErr);
    }

    // 2. Parallel zero-cost browser SpeechRecognition
    if (this.recognition) {
      try {
        this.recognition.onresult = (event) => {
          let interim = '';
          for (let i = 0; i < event.results.length; i++) {
            interim += event.results[i][0].transcript;
          }
          if (interim.trim()) {
            this.currentTranscript = interim.trim();
          }
        };
        this.recognition.onerror = () => {};
        this.recognition.start();
      } catch {
        // Ignore speech recognition initiation conflicts
      }
    }

    // 3. MediaRecorder for clean audio blob capture
    const mimeType = this.getSupportedMimeType();
    const options = mimeType ? { mimeType } : {};
    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.dataChunks.push(e.data);
        }
      };
      this.mediaRecorder.start(100); // 100ms chunks
    } catch (recErr) {
      console.warn('[AudioRecorder] MediaRecorder start notice:', recErr);
    }
  }

  /**
   * Visualizer animation frame loop
   */
  startVisualizerLoop() {
    if (!this.analyser) return;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const update = () => {
      if (!this.isRecording) return;
      this.analyser.getByteFrequencyData(dataArray);

      // Compute average volume level normalized between 0.0 and 1.0
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / (bufferLength * 255);

      if (this.onVolumeCallback) {
        this.onVolumeCallback(avg, dataArray);
      }
      this.volumeAnimId = requestAnimationFrame(update);
    };
    this.volumeAnimId = requestAnimationFrame(update);
  }

  /**
   * Stops recording and returns the recorded audio Blob + transcript
   * @returns {Promise<{ blob: Blob|null, mimeType: string, durationMs: number, transcript: string, isAccidentalTap: boolean }>}
   */
  async stopRecording() {
    if (!this.isRecording) {
      return {
        blob: null,
        mimeType: '',
        durationMs: 0,
        transcript: '',
        isAccidentalTap: false
      };
    }

    this.isRecording = false;
    const durationMs = Date.now() - this.startTime;
    const isAccidentalTap = durationMs < 400;

    if (this.volumeAnimId) {
      cancelAnimationFrame(this.volumeAnimId);
      this.volumeAnimId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { await this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    this.analyser = null;

    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }

    return new Promise((resolve) => {
      const mimeType = this.getSupportedMimeType();
      const finish = () => {
        let blob = null;
        if (this.dataChunks.length > 0) {
          blob = new Blob(this.dataChunks, { type: mimeType || 'audio/webm' });
        }
        resolve({
          blob,
          mimeType,
          durationMs,
          transcript: this.currentTranscript,
          isAccidentalTap
        });
      };

      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = finish;
        try {
          this.mediaRecorder.stop();
        } catch {
          finish();
        }
      } else {
        finish();
      }
    });
  }

  /**
   * Aborts recording without keeping chunks
   */
  cancelRecording() {
    this.isRecording = false;
    if (this.volumeAnimId) {
      cancelAnimationFrame(this.volumeAnimId);
      this.volumeAnimId = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    if (this.recognition) {
      try { this.recognition.stop(); } catch {}
    }
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch {}
    }
    this.dataChunks = [];
  }
}

export const audioRecorder = new AudioRecorderService();
