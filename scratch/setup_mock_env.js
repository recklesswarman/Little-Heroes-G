// setup_mock_env.js
// Polyfills headless environment for Node.js test execution

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, params = {}) {
      this.type = type;
      this.detail = params.detail || {};
    }
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    devicePixelRatio: 1,
    location: { href: 'http://localhost/' },
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32'
    }
  };
} else {
  if (!globalThis.window.dispatchEvent) {
    globalThis.window.dispatchEvent = () => true;
  }
  if (!globalThis.window.navigator) {
    globalThis.window.navigator = {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      platform: 'Win32'
    };
  }
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => ({
      tagName: tag,
      id: '',
      className: '',
      style: {},
      getContext: () => ({
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        save: () => {},
        restore: () => {},
        scale: () => {},
        translate: () => {},
        rotate: () => {},
        roundRect: () => {},
        drawImage: () => {},
        setTransform: () => {},
        resetTransform: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        getImageData: () => ({ data: new Uint8ClampedArray(64 * 48 * 4) })
      }),
      parentElement: null,
      replaceChild: () => {},
      width: 600,
      height: 420
    }),
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    documentElement: { clientWidth: 1024, clientHeight: 768 },
    body: {
      appendChild: () => {},
      removeChild: () => {}
    }
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  const storeMap = {};
  globalThis.localStorage = {
    getItem: (k) => storeMap[k] || null,
    setItem: (k, v) => { storeMap[k] = String(v); },
    removeItem: (k) => { delete storeMap[k]; },
    clear: () => { Object.keys(storeMap).forEach(k => delete storeMap[k]); }
  };
}

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 16);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
}
