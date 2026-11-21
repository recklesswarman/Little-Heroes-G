// Rex Voice Lab: mic -> whisper.cpp -> Rex (Gemini chat) -> Piper.
// Server side lives in server/voiceLabService.js (env: WHISPER_CPP_URL, PIPER_URL, PIPER_MODE, PIPER_VOICE).
import { encodeWav, resampleMono, toMono } from './wav.js';
import { serverApiUrl } from '../services/serverApi.js';

const $ = id => document.getElementById(id);
const history = [];
let mediaStream = null;
let recorder = null;
let chunks = [];
let busy = false;

function setDot(id, ok) {
  $(id).classList.toggle('ok', ok === true);
  $(id).classList.toggle('bad', ok === false);
}

async function checkStatus() {
  setDot('whisper-dot', null);
  setDot('piper-dot', null);
  try {
    const r = await fetch(serverApiUrl('/api/voice/status'));
    const s = await r.json();
    setDot('whisper-dot', Boolean(s.whisper?.reachable));
    setDot('piper-dot', Boolean(s.piper?.reachable));
    $('whisper-url').textContent = s.whisper?.url || '';
    $('piper-url').textContent = s.piper?.url || '';
  } catch {
    setDot('whisper-dot', false);
    setDot('piper-dot', false);
    $('whisper-url').textContent = '(app server not reachable)';
  }
}

function addMessage(who, text, note = '') {
  const log = $('log');
  if (log.firstElementChild?.tagName === 'P') log.innerHTML = '';
  const div = document.createElement('div');
  div.className = `msg ${who}`;
  div.textContent = text;
  if (note) {
    const small = document.createElement('small');
    small.textContent = note;
    div.appendChild(small);
  }
  log.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return div;
}

// Server errors can be long JSON blobs; keep the chat bubble readable.
const shortError = err => String(err?.message || err).replace(/\s+/g, ' ').slice(0, 160);

const secs = ms => `${(ms / 1000).toFixed(1)}s`;

async function blobToWav(blob) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const mono = resampleMono(toMono(decoded), decoded.sampleRate, 16000);
    return new Blob([encodeWav(mono, 16000)], { type: 'audio/wav' });
  } finally {
    ctx.close?.();
  }
}

async function transcribe(wavBlob) {
  const r = await fetch(serverApiUrl('/api/voice/stt'), { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wavBlob });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.ok) throw new Error(json.error || `Speech-to-text failed (${r.status})`);
  return json.text || '';
}

async function askRex(message) {
  const r = await fetch(serverApiUrl('/api/gemini/chat'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history: history.slice(-8), petId: 'rex', speedMode: 'fast', childName: 'Little Hero' })
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.reply) throw new Error(json.error || `Rex chat failed (${r.status})`);
  return json.reply;
}

async function speak(text) {
  const r = await fetch(serverApiUrl('/api/voice/tts'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!r.ok) {
    const json = await r.json().catch(() => ({}));
    throw new Error(json.error || `Piper failed (${r.status})`);
  }
  const url = URL.createObjectURL(await r.blob());
  const audio = new Audio(url);
  audio.addEventListener('ended', () => URL.revokeObjectURL(url));
  await audio.play();
}

function speakWithBrowser(text) {
  if (!('speechSynthesis' in window)) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.05;
  u.pitch = 1.2;
  speechSynthesis.speak(u);
  return true;
}

async function runTurn({ wavBlob = null, typed = '' }) {
  if (busy) return;
  busy = true;
  $('talk-btn').disabled = true;
  $('send-btn').disabled = true;
  try {
    let message = typed.trim();
    let sttNote = 'typed';
    if (wavBlob) {
      const t0 = performance.now();
      message = await transcribe(wavBlob);
      sttNote = `whisper.cpp ${secs(performance.now() - t0)}`;
    }
    if (!message) {
      addMessage('kid', '(nothing heard)', sttNote);
      return;
    }
    addMessage('kid', message, sttNote);
    history.push({ role: 'user', text: message });

    const t1 = performance.now();
    const reply = await askRex(message);
    const chatMs = performance.now() - t1;
    history.push({ role: 'model', text: reply });
    const bubble = addMessage('rex', reply, `Rex ${secs(chatMs)}`);

    const t2 = performance.now();
    try {
      await speak(reply);
      bubble.querySelector('small').textContent += ` · Piper ${secs(performance.now() - t2)}`;
    } catch (err) {
      const usedBrowser = $('browser-voice-fallback').checked && speakWithBrowser(reply);
      bubble.querySelector('small').textContent += ` · Piper failed (${shortError(err)})${usedBrowser ? ', used browser voice' : ''}`;
    }
  } catch (err) {
    addMessage('rex', `Oops: ${shortError(err)}`);
  } finally {
    busy = false;
    $('talk-btn').disabled = false;
    $('send-btn').disabled = false;
  }
}

async function startRecording() {
  if (busy || recorder) return;
  try {
    mediaStream = mediaStream || await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
  } catch (err) {
    addMessage('rex', `Microphone blocked: ${err.message}`);
    return;
  }
  chunks = [];
  recorder = new MediaRecorder(mediaStream);
  recorder.addEventListener('dataavailable', e => e.data.size && chunks.push(e.data));
  recorder.addEventListener('stop', async () => {
    const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
    recorder = null;
    $('talk-btn').classList.remove('recording');
    $('talk-btn').textContent = 'Hold to talk to Rex';
    if (blob.size < 2000) return; // tap without speech
    try {
      await runTurn({ wavBlob: await blobToWav(blob) });
    } catch (err) {
      addMessage('rex', `Couldn't read that recording: ${err.message}`);
    }
  });
  recorder.start();
  // whisper.cpp on the Pi takes ~5 s per short clip; keep clips under ~10 s.
  const thisRecorder = recorder;
  setTimeout(() => { if (recorder === thisRecorder) stopRecording(); }, 10_000);
  $('talk-btn').classList.add('recording');
  $('talk-btn').textContent = 'Listening… let go when done';
}

function stopRecording() {
  if (recorder && recorder.state === 'recording') recorder.stop();
}

function init() {
  const micAvailable = window.isSecureContext && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
  if (!micAvailable) {
    $('secure-warning').hidden = false;
    $('talk-btn').disabled = true;
  }
  const talk = $('talk-btn');
  talk.addEventListener('pointerdown', e => { e.preventDefault(); startRecording(); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(evt => talk.addEventListener(evt, stopRecording));

  $('file-input').addEventListener('change', async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      await runTurn({ wavBlob: await blobToWav(file) });
    } catch (err) {
      addMessage('rex', `Couldn't read that file: ${err.message}`);
    }
  });
  const send = () => {
    const text = $('text-input').value;
    $('text-input').value = '';
    if (text.trim()) runTurn({ typed: text });
  };
  $('send-btn').addEventListener('click', send);
  $('text-input').addEventListener('keydown', e => e.key === 'Enter' && send());
  $('recheck-btn').addEventListener('click', checkStatus);
  $('piper-test-btn').addEventListener('click', async () => {
    const line = "Roar! Hi, I'm Rex. This is my Piper voice.";
    const t0 = performance.now();
    try {
      await speak(line);
      addMessage('rex', line, `Piper ${secs(performance.now() - t0)}`);
    } catch (err) {
      addMessage('rex', `Piper test failed: ${shortError(err)}`);
    }
  });
  checkStatus();
}

init();
