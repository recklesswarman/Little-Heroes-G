// setup_mock_env.js
// Polyfills headless environment for Node.js test execution

if (typeof globalThis.Image === 'undefined') {
  globalThis.Image = class Image {
    constructor() {
      this.src = '';
      this.width = 100;
      this.height = 100;
      this.onload = null;
      this.onerror = null;
    }
  };
}

if (typeof globalThis.CustomEvent === 'undefined') {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, params = {}) {
      this.type = type;
      this.detail = params.detail || {};
      this.bubbles = Boolean(params.bubbles);
    }
  };
}

if (typeof globalThis.MouseEvent === 'undefined') {
  globalThis.MouseEvent = class MouseEvent {
    constructor(type, params = {}) {
      this.type = type;
      this.clientX = params.clientX || 0;
      this.clientY = params.clientY || 0;
      this.bubbles = Boolean(params.bubbles);
    }
  };
}

if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = class PointerEvent extends (globalThis.MouseEvent || Object) {
    constructor(type, params = {}) {
      super(type, params);
      this.pointerId = params.pointerId || 1;
      this.pointerType = params.pointerType || 'touch';
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
const allMockElements = [];

function matchMockSelector(el, sel) {
  if (!sel || !el) return false;
  sel = sel.trim();
  if (sel.startsWith('#')) return el.id === sel.slice(1);
  if (sel.startsWith('.')) {
    const bracketIdx = sel.indexOf('[');
    if (bracketIdx === -1) {
      return (el.className || '').split(/\s+/).includes(sel.slice(1));
    }
    const cls = sel.slice(1, bracketIdx);
    if (!(el.className || '').split(/\s+/).includes(cls)) return false;
    const rest = sel.slice(bracketIdx);
    const m = rest.match(/\[([a-zA-Z0-9-_:]+)=["']?([^"']+)["']?\]/);
    if (m) {
      return el.getAttribute(m[1]) === m[2];
    }
    return true;
  }
  if (sel.startsWith('[')) {
    const m = sel.match(/\[([a-zA-Z0-9-_:]+)=["']?([^"']+)["']?\]/);
    if (m) {
      return el.getAttribute(m[1]) === m[2];
    }
    // Presence-only attribute selector, e.g. "[data-launch-game]" with no
    // "=value" -- matches any element that has the attribute set at all.
    const presenceMatch = sel.match(/^\[([a-zA-Z0-9-_:]+)\]$/);
    if (presenceMatch) {
      return el.getAttribute(presenceMatch[1]) !== null;
    }
  }
  return (el.tagName || '').toLowerCase() === sel.toLowerCase();
}

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
        const evt = { type: 'click', target: el, stopPropagation: () => {} };
        listeners['click'].forEach(fn => fn(evt));
      }
    },
    get textContent() {
      return el._textContent !== undefined ? el._textContent : (_innerHtml ? _innerHtml.replace(/<[^>]*>/g, '') : '');
    },
    set textContent(val) {
      el._textContent = String(val);
    },
    querySelector(sel) {
      if (sel && sel.startsWith('#')) {
        return elementsByIdMap.get(sel.substring(1)) || null;
      }
      return allMockElements.find(e => matchMockSelector(e, sel)) || null;
    },
    querySelectorAll(sel) {
      if (sel && sel.startsWith('#')) {
        const e = elementsByIdMap.get(sel.substring(1));
        return e ? [e] : [];
      }
      return allMockElements.filter(e => matchMockSelector(e, sel));
    },
    closest(sel) {
      let cur = el;
      while (cur) {
        if (matchMockSelector(cur, sel)) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
    get innerHTML() {
      return _innerHtml;
    },
    set innerHTML(val) {
      _innerHtml = String(val);
      const tagMatches = [..._innerHtml.matchAll(/<([a-zA-Z0-9-]+)\s*([^>]*?)>/g)];
      for (const m of tagMatches) {
        const t = m[1];
        const attrs = m[2];
        const childEl = createMockElement(t);
        childEl.parentElement = el;
        
        const attrMatches = [...attrs.matchAll(/([a-zA-Z0-9-_:]+)=["']([^"']*)["']/g)];
        for (const am of attrMatches) {
          const attrName = am[1];
          const attrVal = am[2];
          childEl.setAttribute(attrName, attrVal);
          if (attrName.startsWith('data-')) {
            const camelKey = attrName.slice(5).replace(/-([a-z])/g, (_, g) => g.toUpperCase());
            childEl.dataset[camelKey] = attrVal;
          }
        }
        if (childEl.id) {
          elementsByIdMap.set(childEl.id, childEl);
        }
        allMockElements.push(childEl);
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
      else if (name === 'style') {
        if (typeof val === 'string') {
          val.split(';').forEach(pair => {
            const [k, v] = pair.split(':');
            if (k && v) el.style[k.trim()] = v.trim();
          });
        }
      }
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
      return allMockElements.find(e => matchMockSelector(e, sel)) || null;
    },
    querySelectorAll: (sel) => {
      if (sel && sel.startsWith('#')) {
        const e = elementsByIdMap.get(sel.substring(1));
        return e ? [e] : [];
      }
      return allMockElements.filter(e => matchMockSelector(e, sel));
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
