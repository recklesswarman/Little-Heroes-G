import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';
import { store } from '../state/store.js';

let activeParticles = [];
let animFrameId = null;
let canvas = null;
let ctx = null;
let isOverlayActive = false;
let poppedStarsCount = 0;
let lastPointerPos = null;

class InteractiveParticle {
  constructor(w, h) {
    this.reset(w, h, true);
  }

  reset(w, h, initial = false) {
    this.x = Math.random() * w;
    this.y = initial ? Math.random() * (h * 0.8) + (h * 0.1) : h + 20;
    this.vx = (Math.random() - 0.5) * 1.5;
    this.vy = -(Math.random() * 1.8 + 0.8); // Gentle upward float
    this.size = Math.random() * 18 + 16;   // 16px to 34px - easy for toddlers to touch
    this.rotation = Math.random() * Math.PI * 2;
    this.vRot = (Math.random() - 0.5) * 0.04;
    this.type = Math.random() > 0.4 ? 'star' : Math.random() > 0.5 ? 'gem' : 'bubble';
    this.color = ['#54e98a', '#ffb961', '#3498db', '#f1c40f', '#e056fd', '#ff7675'][Math.floor(Math.random() * 6)];
    this.opacity = 0.95;
    this.isPopped = false;
  }

  update(w, h) {
    this.x += this.vx;
    this.y += this.vy;
    this.rotation += this.vRot;

    // Soft wall bounce
    if (this.x < 20) {
      this.x = 20;
      this.vx *= -0.7;
    } else if (this.x > w - 20) {
      this.x = w - 20;
      this.vx *= -0.7;
    }

    // Respawn from bottom if floated past top
    if (this.y < -40) {
      this.reset(w, h);
    }
  }

  draw(context) {
    if (this.isPopped) return;
    context.save();
    context.translate(this.x, this.y);
    context.rotate(this.rotation);
    context.globalAlpha = this.opacity;

    // Glowing shadow
    context.shadowColor = this.color;
    context.shadowBlur = 12;

    if (this.type === 'star') {
      this.drawStar(context, 0, 0, 5, this.size, this.size * 0.45, this.color);
    } else if (this.type === 'gem') {
      this.drawGem(context, 0, 0, this.size, this.color);
    } else {
      this.drawBubble(context, 0, 0, this.size * 0.8, this.color);
    }

    context.restore();
  }

  drawStar(context, cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    context.beginPath();
    context.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      context.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      context.lineTo(x, y);
      rot += step;
    }
    context.lineTo(cx, cy - outerRadius);
    context.closePath();
    context.fillStyle = color;
    context.fill();

    // Star core gleam
    context.beginPath();
    context.arc(cx, cy, innerRadius * 0.5, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();
  }

  drawGem(context, cx, cy, size, color) {
    context.beginPath();
    context.moveTo(cx, cy - size);
    context.lineTo(cx + size * 0.8, cy);
    context.lineTo(cx, cy + size);
    context.lineTo(cx - size * 0.8, cy);
    context.closePath();
    context.fillStyle = color;
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 2;
    context.stroke();
  }

  drawBubble(context, cx, cy, radius, color) {
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fillStyle = color + '44';
    context.fill();
    context.strokeStyle = color;
    context.lineWidth = 2.5;
    context.stroke();

    // Bubble highlight
    context.beginPath();
    context.arc(cx - radius * 0.35, cy - radius * 0.35, radius * 0.25, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();
  }
}

const CELEBRATION_DURATION_SECONDS = 15;
let celebrationTimerInterval = null;
let celebrationAutoCloseTimeout = null;
let celebrationSecondsRemaining = CELEBRATION_DURATION_SECONDS;

export function triggerInteractiveCelebration(particleCount = 50) {
  isOverlayActive = true;
  poppedStarsCount = 0;
  celebrationSecondsRemaining = CELEBRATION_DURATION_SECONDS;

  if (celebrationTimerInterval) {
    clearInterval(celebrationTimerInterval);
    celebrationTimerInterval = null;
  }
  if (celebrationAutoCloseTimeout) {
    clearTimeout(celebrationAutoCloseTimeout);
    celebrationAutoCloseTimeout = null;
  }

  let overlay = document.getElementById('interactive-celebration-container');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'interactive-celebration-container';
    overlay.className = 'fixed inset-0 z-50 pointer-events-auto flex flex-col justify-between p-4 overflow-hidden animate-fade-in select-none';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <!-- Top Pop Counter & Encouragement -->
    <div class="flex items-center justify-between pointer-events-none z-10 max-w-xl mx-auto w-full gap-2">
      <div class="flex items-center gap-2">
        <div class="bg-surface-container/90 backdrop-blur-md border-2 border-primary/50 px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2">
          <span class="text-xl animate-bounce">✨</span>
          <span class="font-headline text-xs sm:text-sm font-black text-primary">
            Swipe & Pop the Stars!
          </span>
          <span id="pop-counter-badge" class="bg-primary text-on-primary font-black text-xs px-2 py-0.5 rounded-full shadow">
            ${poppedStarsCount} Popped
          </span>
        </div>

        <!-- 15-Second Timed Super Hero Celebration Countdown -->
        <div class="bg-amber-400 text-amber-950 border-2 border-amber-300 font-headline text-xs sm:text-sm font-black px-3 py-2 rounded-2xl shadow-xl flex items-center gap-1">
          <span class="material-symbols-outlined text-sm">timer</span>
          <span id="celebration-timer-display">${celebrationSecondsRemaining}s</span>
        </div>
      </div>

      <button id="interactive-celebration-close-btn" class="pointer-events-auto bg-surface-container-highest hover:bg-surface-bright text-on-surface font-headline text-xs font-black px-3.5 py-2 rounded-xl border border-surface-bright chunky-btn-sm active:scale-95 shadow">
        Done ✨
      </button>
    </div>

    <!-- Interactive Canvas Layer -->
    <canvas id="interactive-celebration-canvas" class="absolute inset-0 w-full h-full cursor-pointer touch-none"></canvas>

    <!-- Floating pop popup layer -->
    <div id="interactive-pop-floating-layer" class="absolute inset-0 pointer-events-none overflow-hidden"></div>
  `;

  canvas = document.getElementById('interactive-celebration-canvas');
  if (canvas) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx = canvas.getContext('2d');

    activeParticles = [];
    for (let i = 0; i < particleCount; i++) {
      activeParticles.push(new InteractiveParticle(canvas.width, canvas.height));
    }

    startAnimationLoop();
    attachParticleInteractionListeners();
  }

  // Active 15-second countdown timer
  celebrationTimerInterval = setInterval(() => {
    celebrationSecondsRemaining--;
    const timerElem = document.getElementById('celebration-timer-display');
    if (timerElem) {
      timerElem.textContent = `${Math.max(0, celebrationSecondsRemaining)}s`;
    }
    if (celebrationSecondsRemaining <= 0) {
      if (celebrationTimerInterval) {
        clearInterval(celebrationTimerInterval);
        celebrationTimerInterval = null;
      }
    }
  }, 1000);

  // Automatically close the popups after exactly 15 seconds
  celebrationAutoCloseTimeout = setTimeout(() => {
    closeInteractiveCelebration();
    if (store && store.getState().rewardModal) {
      store.closeReward();
    }
  }, CELEBRATION_DURATION_SECONDS * 1000);

  // Close button listener
  const closeBtn = document.getElementById('interactive-celebration-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      Sound.pop();
      closeInteractiveCelebration();
      if (store && store.getState().rewardModal) {
        store.closeReward();
      }
    });
  }

  // Cheerful Rex voice prompt for kids to pop particles
  if (store.isEasyMode()) {
    speakRex("Super hero celebration! Pop all the glowing stars with your fingers!");
  }
}

function startAnimationLoop() {
  if (animFrameId) cancelAnimationFrame(animFrameId);

  function loop() {
    if (!isOverlayActive || !canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of activeParticles) {
      p.update(canvas.width, canvas.height);
      p.draw(ctx);
    }

    animFrameId = requestAnimationFrame(loop);
  }

  animFrameId = requestAnimationFrame(loop);
}

function attachParticleInteractionListeners() {
  if (!canvas) return;

  const handlePointer = (clientX, clientY, isSwipe = false) => {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const touchRadius = isSwipe ? 65 : 45;

    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      if (p.isPopped) continue;

      const dist = Math.hypot(p.x - x, p.y - y);

      if (dist < touchRadius) {
        if (isSwipe) {
          // Push away with swipe velocity
          const angle = Math.atan2(p.y - y, p.x - x);
          p.vx += Math.cos(angle) * 7;
          p.vy += Math.sin(angle) * 7;
        } else {
          // Direct Pop!
          popParticle(p, x, y);
          break; // Pop one per tap
        }
      }
    }
  };

  // Pointer Down = Direct Pop
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    lastPointerPos = { x: e.clientX, y: e.clientY };
    handlePointer(e.clientX, e.clientY, false);
  });

  // Pointer Move = Swipe Away with Fluid Physics
  canvas.addEventListener('pointermove', (e) => {
    if (e.buttons > 0 || e.pointerType === 'touch') {
      e.preventDefault();
      handlePointer(e.clientX, e.clientY, true);
      lastPointerPos = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener('resize', () => {
    if (canvas && isOverlayActive) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
  });
}

function popParticle(particle, clickX, clickY) {
  particle.isPopped = true;
  poppedStarsCount++;

  // Audio pop
  if (poppedStarsCount % 3 === 0) {
    Sound.bubble();
  } else if (poppedStarsCount % 2 === 0) {
    Sound.chirp();
  } else {
    Sound.pop();
  }

  // Update badge counter
  const badge = document.getElementById('pop-counter-badge');
  if (badge) {
    badge.textContent = `${poppedStarsCount} Popped!`;
    badge.classList.add('scale-125');
    setTimeout(() => badge.classList.remove('scale-125'), 150);
  }

  // Spawn floating score label (+1 Star! ✨)
  const floatLayer = document.getElementById('interactive-pop-floating-layer');
  if (floatLayer) {
    const floatEl = document.createElement('div');
    floatEl.className = 'absolute font-headline text-sm font-black text-amber-300 drop-shadow-md select-none pointer-events-none transition-all duration-700 ease-out';
    floatEl.style.left = `${clickX - 25}px`;
    floatEl.style.top = `${clickY - 20}px`;
    floatEl.innerHTML = '+1 Star! ✨';

    floatLayer.appendChild(floatEl);

    requestAnimationFrame(() => {
      floatEl.style.transform = 'translateY(-40px) scale(1.2)';
      floatEl.style.opacity = '0';
    });

    setTimeout(() => floatEl.remove(), 750);
  }

  // Respawn particle after a short delay so celebration stays full and fun
  setTimeout(() => {
    if (canvas) {
      particle.reset(canvas.width, canvas.height);
    }
  }, 900);

  // Check milestone callouts
  if (poppedStarsCount === 10) {
    Sound.taskCompleteFanfare();
    if (store.isEasyMode()) {
      speakRex("Woohoo! 10 stars popped! You are a super popper!");
    }
  }
}

export function closeInteractiveCelebration() {
  isOverlayActive = false;
  if (celebrationTimerInterval) {
    clearInterval(celebrationTimerInterval);
    celebrationTimerInterval = null;
  }
  if (celebrationAutoCloseTimeout) {
    clearTimeout(celebrationAutoCloseTimeout);
    celebrationAutoCloseTimeout = null;
  }
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
  const overlay = document.getElementById('interactive-celebration-container');
  if (overlay) {
    overlay.remove();
  }
}
