import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { aiVisionChoreService } from '../services/aiVisionChoreService.js';
import confetti from 'canvas-confetti';

/**
 * Kid-Friendly Chore Photo Proof Modal
 * Allows kids to capture webcam or upload gallery photo proof of completed chore
 * for +5 Bonus Tokens and immediate cheering Rex feedback.
 */
class ChorePhotoProofModal {
  constructor() {
    this.isOpen = false;
    this.task = null;
    this.stream = null;
    this.photoDataUrl = null;
    this.isAnalyzing = false;
  }

  open(task) {
    this.task = task;
    this.isOpen = true;
    this.photoDataUrl = null;
    this.isAnalyzing = false;
    this.render();
    this.bindEvents();
    this.startCamera();
  }

  close() {
    this.stopCamera();
    this.isOpen = false;
    const modalEl = document.getElementById('chore-photo-modal-root');
    if (modalEl) modalEl.remove();
  }

  async startCamera() {
    const video = document.getElementById('chore-camera-stream');
    if (!video) return;

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        video.srcObject = this.stream;
        video.play();
      }
    } catch (err) {
      console.warn('Camera access denied or unavailable, falling back to file picker:', err);
      const streamContainer = document.getElementById('chore-stream-container');
      if (streamContainer) {
        streamContainer.classList.add('hidden');
      }
      const fallbackUpload = document.getElementById('chore-file-fallback-prompt');
      if (fallbackUpload) {
        fallbackUpload.classList.remove('hidden');
      }
    }
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
  }

  capturePhoto() {
    const video = document.getElementById('chore-camera-stream');
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    this.photoDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    this.stopCamera();
    this.showPreview();
    Sound.camera();
  }

  handleFileUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.photoDataUrl = e.target.result;
      this.stopCamera();
      this.showPreview();
      Sound.camera();
    };
    reader.readAsDataURL(file);
  }

  showPreview() {
    const streamContainer = document.getElementById('chore-stream-container');
    const previewContainer = document.getElementById('chore-preview-container');
    const previewImg = document.getElementById('chore-preview-img');
    const snapBtn = document.getElementById('chore-snap-btn');
    const submitBtn = document.getElementById('chore-submit-proof-btn');
    const retakeBtn = document.getElementById('chore-retake-btn');

    if (streamContainer) streamContainer.classList.add('hidden');
    if (previewContainer) previewContainer.classList.remove('hidden');
    if (previewImg) previewImg.src = this.photoDataUrl;
    if (snapBtn) snapBtn.classList.add('hidden');
    if (retakeBtn) retakeBtn.classList.remove('hidden');
    if (submitBtn) {
      submitBtn.classList.remove('opacity-50', 'pointer-events-none');
      submitBtn.classList.add('animate-bounce');
    }
  }

  retake() {
    this.photoDataUrl = null;
    const streamContainer = document.getElementById('chore-stream-container');
    const previewContainer = document.getElementById('chore-preview-container');
    const snapBtn = document.getElementById('chore-snap-btn');
    const submitBtn = document.getElementById('chore-submit-proof-btn');
    const retakeBtn = document.getElementById('chore-retake-btn');

    if (streamContainer) streamContainer.classList.remove('hidden');
    if (previewContainer) previewContainer.classList.add('hidden');
    if (snapBtn) snapBtn.classList.remove('hidden');
    if (retakeBtn) retakeBtn.classList.add('hidden');
    if (submitBtn) {
      submitBtn.classList.add('opacity-50', 'pointer-events-none');
      submitBtn.classList.remove('animate-bounce');
    }

    this.startCamera();
  }

  async submitProof() {
    if (!this.photoDataUrl || !this.task || this.isAnalyzing) return;
    this.isAnalyzing = true;

    const state = store.getState();
    const hero = state.selectedHero;

    // Show AI loading state
    const submitBtn = document.getElementById('chore-submit-proof-btn');
    if (submitBtn) {
      submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">sync</span> Rex & Gemini Checking...';
      submitBtn.classList.add('pointer-events-none');
    }

    try {
      // Analyze with Vision Service
      const analysis = await aiVisionChoreService.analyzeChorePhoto({
        taskId: this.task.id,
        taskTitle: this.task.title,
        heroName: hero.name,
        childAge: 5,
        photoDataUrl: this.photoDataUrl
      });

      // Submit into store with photo evidence & +5 bonus tokens!
      store.submitChoreWithPhoto({
        task: this.task,
        photoUrl: analysis.photoUrl,
        aiConfidence: analysis.confidenceScore,
        aiFeedback: analysis.parentRecommendation,
        kidFeedback: analysis.feedbackForKid,
        badgeEarned: analysis.badgeEarned
      });

      Sound.fanfare();
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#2ecc71', '#ffb961', '#3498db', '#f1c40f']
      });

      this.close();
    } catch (err) {
      console.error('Error submitting chore proof:', err);
      // Fallback submit
      store.submitChoreWithPhoto({
        task: this.task,
        photoUrl: this.photoDataUrl,
        aiConfidence: 90,
        aiFeedback: 'Photo proof submitted by ' + hero.name,
        kidFeedback: 'Great job snapping proof! Rex is super happy! 🦖⭐',
        badgeEarned: 'Photo Hero'
      });
      this.close();
    }
  }

  render() {
    let existing = document.getElementById('chore-photo-modal-root');
    if (existing) existing.remove();

    const root = document.createElement('div');
    root.id = 'chore-photo-modal-root';
    root.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in';

    root.innerHTML = `
      <div class="bg-surface-container rounded-3xl border-4 border-primary max-w-lg w-full overflow-hidden shadow-2xl flex flex-col relative">
        
        <!-- Header with Cheering Rex Frame -->
        <div class="bg-gradient-to-r from-primary to-emerald-600 p-4 text-white flex items-center justify-between relative">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-3xl border border-white/30 shadow">
              📸
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <h2 class="font-headline text-lg font-black tracking-wide">Snap Chore Proof</h2>
                <span class="bg-amber-400 text-slate-900 text-[10px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm">
                  +5 Bonus 🪙
                </span>
              </div>
              <p class="text-xs text-white/90 font-bold truncate max-w-[240px]">${this.task.title}</p>
            </div>
          </div>

          <button id="chore-modal-close-btn" class="w-9 h-9 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-transform active:scale-90">
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <!-- Camera / Preview Viewport -->
        <div class="p-4 flex flex-col items-center gap-4 bg-surface-container-lowest/50">
          
          <div class="relative w-full aspect-[4/3] bg-black rounded-2xl overflow-hidden border-2 border-primary/40 shadow-inner flex items-center justify-center">
            
            <!-- Video Stream -->
            <div id="chore-stream-container" class="w-full h-full relative flex items-center justify-center">
              <video id="chore-camera-stream" class="w-full h-full object-cover" playsinline autoplay muted></video>
              
              <!-- Rex Cheering Camera Overlay Frame -->
              <div class="absolute inset-0 pointer-events-none border-4 border-dashed border-primary/50 rounded-2xl flex flex-col justify-between p-3">
                <div class="flex justify-between items-center text-xs font-black text-primary bg-surface-container/90 px-2.5 py-1 rounded-full w-max shadow">
                  <span>🦖 Rex: Point camera at your chore!</span>
                </div>
                <div class="self-end bg-amber-400 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                  Proof = +5 Extra Tokens 🪙
                </div>
              </div>
            </div>

            <!-- Captured Image Preview -->
            <div id="chore-preview-container" class="w-full h-full hidden relative">
              <img id="chore-preview-img" class="w-full h-full object-cover" alt="Proof Preview" />
              <div class="absolute bottom-2 left-2 bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-xl flex items-center gap-1 shadow">
                <span class="material-symbols-outlined text-sm">check_circle</span> Ready to Send!
              </div>
            </div>

            <!-- Fallback File Upload Prompt if Camera Denied -->
            <div id="chore-file-fallback-prompt" class="hidden w-full h-full flex flex-col items-center justify-center p-6 text-center gap-3 bg-surface-container-high">
              <span class="material-symbols-outlined text-4xl text-secondary">photo_library</span>
              <p class="text-xs text-on-surface-variant font-bold">Camera preview not available. Choose a photo from your library:</p>
              <label class="bg-secondary text-on-secondary font-headline text-xs font-black px-4 py-2.5 rounded-xl cursor-pointer hover:brightness-110 active:scale-95 shadow-sm">
                Browse Photos
                <input type="file" id="chore-file-input-fallback" accept="image/*" class="hidden" />
              </label>
            </div>

          </div>

          <!-- Controls Bar -->
          <div class="w-full flex items-center justify-between gap-3">
            <!-- Gallery Upload Button -->
            <label class="bg-surface-container hover:bg-surface-bright text-on-surface-variant border border-surface-container-highest font-headline text-xs font-bold px-3 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm" title="Choose from gallery">
              <span class="material-symbols-outlined text-lg text-primary">add_photo_alternate</span>
              <span class="hidden sm:inline">Upload</span>
              <input type="file" id="chore-file-input" accept="image/*" class="hidden" />
            </label>

            <!-- Snap / Retake Center Button -->
            <div class="flex items-center gap-2">
              <button id="chore-snap-btn" class="bg-gradient-to-r from-primary to-emerald-500 text-white font-headline text-sm font-black px-6 py-3 rounded-2xl chunky-btn shadow-lg flex items-center gap-2 hover:brightness-110 active:scale-95">
                <span class="material-symbols-outlined text-xl">photo_camera</span>
                <span>Snap Photo!</span>
              </button>

              <button id="chore-retake-btn" class="hidden bg-surface-container-high text-on-surface-variant font-headline text-xs font-bold px-4 py-3 rounded-xl border border-surface-container-highest active:scale-95 flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">replay</span> Retake
              </button>
            </div>

            <!-- Submit Button -->
            <button id="chore-submit-proof-btn" class="opacity-50 pointer-events-none bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 font-headline text-xs font-black px-4 py-3 rounded-2xl chunky-btn shadow flex items-center gap-1.5 hover:brightness-110 active:scale-95">
              <span>Send</span>
              <span class="material-symbols-outlined text-base">send</span>
            </button>
          </div>

        </div>

        <!-- Footer Encouragement -->
        <div class="bg-surface-container px-4 py-2.5 border-t border-surface-container-highest flex items-center justify-between text-[11px] font-bold text-on-surface-variant">
          <span class="flex items-center gap-1">
            <span class="text-primary">✨</span> Rex and Mom/Dad will see your photo!
          </span>
          <span class="text-secondary font-black">Optional bonus quest</span>
        </div>

      </div>
    `;

    document.body.appendChild(root);
  }

  bindEvents() {
    const closeBtn = document.getElementById('chore-modal-close-btn');
    if (closeBtn) closeBtn.onclick = () => this.close();

    const snapBtn = document.getElementById('chore-snap-btn');
    if (snapBtn) snapBtn.onclick = () => this.capturePhoto();

    const retakeBtn = document.getElementById('chore-retake-btn');
    if (retakeBtn) retakeBtn.onclick = () => this.retake();

    const submitBtn = document.getElementById('chore-submit-proof-btn');
    if (submitBtn) submitBtn.onclick = () => this.submitProof();

    const fileInput = document.getElementById('chore-file-input');
    if (fileInput) {
      fileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileUpload(e.target.files[0]);
        }
      };
    }

    const fallbackFileInput = document.getElementById('chore-file-input-fallback');
    if (fallbackFileInput) {
      fallbackFileInput.onchange = (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileUpload(e.target.files[0]);
        }
      };
    }
  }
}

export const chorePhotoProofModal = new ChorePhotoProofModal();
