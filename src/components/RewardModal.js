import { store } from '../state/store.js';
import { Sound } from '../audio/sfx.js';
import { speakRex } from '../services/voiceService.js';

let shaderAnimationId = null;

function generateCelebrationIcon(reward) {
  if (!reward) {
    return `<span class="material-symbols-outlined text-6xl sm:text-7xl text-primary drop-shadow-[0_4px_12px_rgba(84,233,138,0.5)] z-10" style="font-variation-settings: 'FILL' 1;">military_tech</span>`;
  }

  // 1. If an explicit image URL is provided (e.g. task image, reward image, pet avatar)
  if (reward.image) {
    return `
      <img 
        src="${reward.image}" 
        alt="${reward.title || 'Celebration'}" 
        class="w-28 h-28 sm:w-32 sm:h-32 object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] z-10 animate-pulse-subtle"
        onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';"
      />
      <div class="hidden w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-surface-container-highest/80 border-2 border-primary/40 items-center justify-center shadow-lg z-10 text-primary">
        <span class="material-symbols-outlined text-6xl sm:text-7xl" style="font-variation-settings: 'FILL' 1;">
          ${reward.icon || 'military_tech'}
        </span>
      </div>
    `;
  }

  // 2. If an icon name is provided or deduce from title / message
  let iconName = reward.icon;
  if (!iconName) {
    const text = ((reward.title || '') + ' ' + (reward.message || '')).toLowerCase();
    if (text.includes('brush') || text.includes('tooth') || text.includes('dentist')) {
      iconName = 'dentistry';
    } else if (text.includes('pet') || text.includes('bath') || text.includes('wash') || text.includes('dry') || text.includes('dragon')) {
      iconName = 'pets';
    } else if (text.includes('habit')) {
      iconName = 'military_tech';
    } else if (text.includes('chore') || text.includes('task') || text.includes('clean') || text.includes('room')) {
      iconName = 'task_alt';
    } else if (text.includes('reward') || text.includes('screen time') || text.includes('treat') || text.includes('prize')) {
      iconName = 'featured_seasonal_and_gifts';
    } else if (text.includes('gear') || text.includes('armor') || text.includes('sword') || text.includes('shield') || text.includes('locker')) {
      iconName = 'shield';
    } else if (text.includes('theme') || text.includes('color')) {
      iconName = 'palette';
    } else if (text.includes('coin') || text.includes('token') || text.includes('price')) {
      iconName = 'generating_tokens';
    } else if (text.includes('battle') || text.includes('boss')) {
      iconName = 'swords';
    } else if (text.includes('dance') || text.includes('party')) {
      iconName = 'music_note';
    } else if (text.includes('escape')) {
      iconName = 'warning';
    } else {
      iconName = 'emoji_events';
    }
  }

  const isWarning = iconName === 'warning' || reward.title?.includes('Escaped') || reward.title?.includes('Declined');
  const iconColor = isWarning ? 'text-secondary' : 'text-primary';
  const glowColor = isWarning ? 'rgba(255,185,97,0.6)' : 'rgba(84,233,138,0.6)';

  return `
    <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-surface-container-highest/75 border-2 ${isWarning ? 'border-secondary/50' : 'border-primary/50'} flex items-center justify-center shadow-inner z-10 ${iconColor}">
      <span class="material-symbols-outlined text-5xl sm:text-6xl drop-shadow-[0_4px_16px_${glowColor}]" style="font-variation-settings: 'FILL' 1;">
        ${iconName}
      </span>
    </div>
  `;
}

export function renderRewardModal() {
  const state = store.getState();
  const reward = state.rewardModal;
  if (!reward) return '';

  const isEscaped = reward.title?.includes('Escaped');
  const isDeclined = reward.title?.includes('Declined') || reward.title?.includes('Rejected');

  const titleColor = isEscaped 
    ? 'text-secondary' 
    : isDeclined 
    ? 'text-error' 
    : 'text-primary-fixed';
    
  const btnClass = isEscaped 
    ? 'bg-secondary text-on-secondary border-b-8 border-[#663e00]' 
    : isDeclined 
    ? 'bg-surface-container-highest text-on-surface border-b-6 border-surface-container' 
    : 'bg-primary text-on-primary chunky-button-primary';
    
  const btnText = isEscaped 
    ? 'TRY AGAIN NEXT TIME!' 
    : isDeclined 
    ? 'OK, GOT IT' 
    : 'COOL!';

  const centerContentHtml = generateCelebrationIcon(reward);

  return `
    <div id="reward-modal-backdrop" class="fixed inset-0 bg-background/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in select-none overflow-hidden">
      
      <!-- Celebration Shader Background (Transparent WebGL Canvas Animation) -->
      <div class="absolute inset-0 z-0 pointer-events-none">
        <canvas id="reward-celebration-canvas" class="w-full h-full block bg-transparent"></canvas>
      </div>

      <!-- Modal Overlay Container -->
      <div class="relative z-10 w-full max-w-md px-margin-mobile flex flex-col items-center justify-center h-full">
        
        <!-- Reward Card Container (Stitch Design Specification) -->
        <div class="bg-surface-container-high rounded-4xl p-6 sm:p-8 w-full flex flex-col items-center justify-center shadow-[0_12px_0_0_#121d26] border-2 border-outline-variant relative overflow-hidden text-center animate-scale-up">
          
          <!-- Confetti/Stars Decorative Elements (Purely CSS/HTML) -->
          <div class="absolute top-4 left-4 text-secondary rotate-12 pointer-events-none">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1; font-size: 32px;">star</span>
          </div>
          <div class="absolute top-10 right-6 text-primary rotate-[25deg] pointer-events-none">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1; font-size: 24px;">arrow_back_ios_new</span>
          </div>
          <div class="absolute bottom-20 left-6 text-tertiary -rotate-12 pointer-events-none">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1; font-size: 28px;">auto_awesome</span>
          </div>
          <div class="absolute bottom-24 right-5 text-secondary rotate-45 pointer-events-none">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1; font-size: 22px;">star</span>
          </div>

          <!-- Headline -->
          <h1 class="font-headline-lg-mobile text-2xl sm:text-3xl font-black ${titleColor} mb-6 text-center uppercase tracking-wide drop-shadow-lg">
            ${reward.title || 'AWESOME JOB!'}
          </h1>

          <!-- 3D Celebration Portal Circle with Generated Task / Reward Icon -->
          <div class="relative w-44 h-44 sm:w-48 sm:h-48 mb-6 animate-float glow-effect rounded-full bg-surface-container flex items-center justify-center overflow-hidden">
            <!-- Inner highlight/bevel for sticker container -->
            <div class="absolute inset-0 rounded-full border-4 border-surface-bright shadow-inner z-0 pointer-events-none"></div>
            
            <!-- Rendered Generated Icon/Image for Whatever is Being Celebrated -->
            ${centerContentHtml}
          </div>

          <!-- Message Body -->
          <p class="font-body-md text-xs sm:text-sm font-bold text-on-surface mb-6 px-2 leading-relaxed whitespace-pre-line">
            ${reward.message || 'You completed an awesome heroic adventure! Keep up the great work!'}
          </p>

          <!-- Reward Value / Habit Coins (Glass Pill) -->
          ${
            reward.coins > 0 || reward.xp > 0
              ? `
            <div class="glass-pill rounded-full px-5 sm:px-6 py-2.5 flex items-center justify-center gap-3 mb-6 border border-secondary/30">
              <div class="bg-secondary text-on-secondary rounded-full p-1 flex items-center justify-center shadow-inner">
                <span class="material-symbols-outlined text-base sm:text-lg" style="font-variation-settings: 'FILL' 1;">generating_tokens</span>
              </div>
              <span class="font-headline text-xl sm:text-2xl text-secondary font-black">+${reward.coins || 50}</span>
              <span class="font-headline text-xs sm:text-sm text-on-surface font-bold uppercase tracking-wider">Habit Coins</span>
              ${
                reward.xp > 0
                  ? `
                <div class="w-px h-5 bg-white/20"></div>
                <div class="flex items-center gap-1 text-primary font-headline text-xs sm:text-sm font-black">
                  <span class="material-symbols-outlined text-base">bolt</span>
                  +${reward.xp} XP
                </div>
              `
                  : ''
              }
            </div>
          `
              : ''
          }

          <!-- Action Button (Chunky Button with Shine Sweep Effect) -->
          <button id="reward-modal-cool-btn" class="w-full ${btnClass} font-headline-lg-mobile text-base sm:text-lg font-black rounded-xl py-3.5 uppercase tracking-widest relative overflow-hidden group hover:brightness-110 active:scale-98 transition-all">
            <span class="relative z-10">${btnText}</span>
            <!-- Button shine effect -->
            <div class="absolute top-0 left-[-100%] w-1/2 h-full bg-white/20 skew-x-[-20deg] group-hover:left-[200%] transition-all duration-700 ease-in-out"></div>
          </button>

        </div>
      </div>
    </div>
  `;
}

function initCelebrationShader(canvas) {
  if (!canvas) return;
  try {
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true }) || 
               canvas.getContext('experimental-webgl', { alpha: true });
    if (!gl) return;

    function resize() {
      const w = canvas.clientWidth || window.innerWidth || 390;
      const h = canvas.clientHeight || window.innerHeight || 884;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    resize();

    const vs = `
      attribute vec2 a_position;
      varying vec2 v_texCoord;
      void main() {
        v_texCoord = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fs = `
      precision highp float;
      varying vec2 v_texCoord;
      uniform float u_time;
      uniform vec2 u_resolution;

      void main() {
        vec2 uv = v_texCoord;
        vec2 center = vec2(0.5, 0.5);
        
        // Confetti-like floating sparkles
        float particles = 0.0;
        for(float i = 0.0; i < 18.0; i++) {
          float angle = i * 0.349 + u_time * 0.45;
          vec2 p = center + vec2(cos(angle), sin(angle)) * (0.3 + 0.12 * sin(u_time + i));
          particles += 0.007 / (distance(uv, p) + 0.002);
        }
        
        // Radiant golden celebration rays
        float rays = pow(0.5 + 0.5 * sin(atan(uv.y - 0.5, uv.x - 0.5) * 10.0 + u_time * 1.8), 8.0);
        
        // Transparent background: alpha is calculated directly from rays and sparkles
        float intensity = clamp(rays * 0.45 + particles * 0.65, 0.0, 1.0);
        float alpha = smoothstep(0.06, 0.65, intensity) * 0.8;
        
        vec3 rayCol = vec3(1.0, 0.82, 0.28);
        vec3 sparkleCol = vec3(0.33, 0.95, 0.55);
        vec3 col = mix(rayCol, sparkleCol, clamp(particles * 0.8, 0.0, 1.0));
        
        gl_FragColor = vec4(col * alpha, alpha);
      }
    `;

    function createShader(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, createShader(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, createShader(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const pos = gl.getAttribLocation(prog, 'a_position');
    gl.enableVertexAttribArray(pos);
    gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uRes = gl.getUniformLocation(prog, 'u_resolution');

    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    let startTime = performance.now();

    function renderFrame() {
      if (!document.getElementById('reward-modal-backdrop')) {
        return;
      }
      resize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const elapsed = (performance.now() - startTime) * 0.001;
      if (uTime) gl.uniform1f(uTime, elapsed);
      if (uRes) gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      shaderAnimationId = requestAnimationFrame(renderFrame);
    }

    if (shaderAnimationId) {
      cancelAnimationFrame(shaderAnimationId);
    }
    shaderAnimationId = requestAnimationFrame(renderFrame);

  } catch (e) {
    console.warn("Celebration shader initialization notice:", e.message);
  }
}

export function attachRewardModalListeners() {
  const backdrop = document.getElementById('reward-modal-backdrop');
  if (!backdrop) {
    if (shaderAnimationId) {
      cancelAnimationFrame(shaderAnimationId);
      shaderAnimationId = null;
    }
    return;
  }

  // Initialize WebGL celebration shader with transparent background
  const canvas = document.getElementById('reward-celebration-canvas');
  if (canvas) {
    initCelebrationShader(canvas);
  }

  // Trigger Rex's celebratory voice line
  const reward = store.getState().rewardModal;
  if (reward && reward.isOpen && !reward.hasSpokenCelebration) {
    reward.hasSpokenCelebration = true;
    const title = (reward.title || '').toLowerCase();
    if (!title.includes('escaped') && !title.includes('declined')) {
      speakRex("Yay! You did it! Super hero power!");
    }
  }

  const coolBtn = document.getElementById('reward-modal-cool-btn');
  if (coolBtn) {
    coolBtn.addEventListener('click', () => {
      Sound.click();
      if (shaderAnimationId) {
        cancelAnimationFrame(shaderAnimationId);
        shaderAnimationId = null;
      }
      store.closeReward();
    });
  }

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      if (shaderAnimationId) {
        cancelAnimationFrame(shaderAnimationId);
        shaderAnimationId = null;
      }
      store.closeReward();
    }
  });
}
