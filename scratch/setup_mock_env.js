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

const elementsByIdMap = new Map();

function createMockElement(tag = 'div') {
  const listeners = {};
  let _innerHtml = '';
  let _id = '';
  const el = {
    tagName: (tag || 'DIV').toUpperCase(),
    className: '',
    dataset: {},
    style: {},
    children: [],
    parentElement: null,
    width: 600,
    height: 420,
    addEventListener(event, fn) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(h => h !== fn);
      }
    },
    dispatchEvent(event) {
      const type = typeof event === 'string' ? event : event?.type;
      if (listeners[type]) {
        listeners[type].forEach(fn => fn(event));
      }
      return true;
    },
    click() {
      if (listeners['click']) {
        listeners['click'].forEach(fn => fn({ type: 'click', target: el }));
      }
    },
    get innerHTML() {
      return _innerHtml;
    },
    set innerHTML(val) {
      _innerHtml = String(val);
      const idMatches = [..._innerHtml.matchAll(/\bid=["']([^"']+)["']/g)];
      for (const m of idMatches) {
        const id = m[1];
        if (!elementsByIdMap.has(id)) {
          const childEl = createMockElement('div');
          childEl.id = id;
          childEl.parentElement = el;
          elementsByIdMap.set(id, childEl);
        }
      }
    },
    appendChild(child) {
      if (child) {
        child.parentElement = el;
        el.children.push(child);
        if (child.id) elementsByIdMap.set(child.id, child);
      }
      return child;
    },
    removeChild(child) {
      if (child) {
        el.children = el.children.filter(c => c !== child);
        if (child.id) elementsByIdMap.delete(child.id);
      }
      return child;
    },
    remove() {
      if (el.parentElement && typeof el.parentElement.removeChild === 'function') {
        el.parentElement.removeChild(el);
      }
      if (el.id) elementsByIdMap.delete(el.id);
    },
    setAttribute(name, val) {
      if (name === 'id') el.id = val;
      else if (name === 'class') el.className = val;
      else el[name] = val;
    },
    getAttribute(name) {
      if (name === 'id') return el.id;
      if (name === 'class') return el.className;
      return el[name] || null;
    },
    removeAttribute(name) {
      delete el[name];
    },
    classList: {
      add(...cls) {
        const set = new Set((el.className || '').split(' ').filter(Boolean));
        cls.forEach(c => set.add(c));
        el.className = [...set].join(' ');
      },
      remove(...cls) {
        const set = new Set((el.className || '').split(' ').filter(Boolean));
        cls.forEach(c => set.delete(c));
        el.className = [...set].join(' ');
      },
      contains(c) {
        return (el.className || '').split(' ').includes(c);
      },
      toggle(c) {
        if ((el.className || '').split(' ').includes(c)) {
          this.remove(c);
        } else {
          this.add(c);
        }
      }
    },
    focus() {},
    blur() {},
    replaceChild(newChild, oldChild) {
      el.removeChild(oldChild);
      el.appendChild(newChild);
      return newChild;
    },
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
      measureText: (text) => ({ width: (text || '').length * 8 }),
      fillText: () => {},
      strokeText: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      getImageData: () => ({ data: new Uint8ClampedArray(64 * 48 * 4) })
    })
  };

  Object.defineProperty(el, 'id', {
    get: () => _id,
    set: (val) => {
      if (_id && elementsByIdMap.get(_id) === el) {
        elementsByIdMap.delete(_id);
      }
      _id = String(val);
      if (_id) {
        elementsByIdMap.set(_id, el);
      }
    }
  });

  return el;
}

if (typeof globalThis.document === 'undefined' || !globalThis.document._isEnhancedMock) {
  globalThis.document = {
    _isEnhancedMock: true,
    createElement: (tag) => createMockElement(tag),
    addEventListener: () => {},
    removeEventListener: () => {},
    getElementById: (id) => elementsByIdMap.get(id) || null,
    querySelector: (sel) => {
      if (sel && sel.startsWith('#')) {
        return elementsByIdMap.get(sel.substring(1)) || null;
      }
      return null;
    },
    querySelectorAll: (sel) => {
      const el = globalThis.document.querySelector(sel);
      return el ? [el] : [];
    },
    documentElement: { clientWidth: 1024, clientHeight: 768 },
    body: createMockElement('body')
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
