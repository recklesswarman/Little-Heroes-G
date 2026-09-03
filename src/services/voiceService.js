const PROXY_URL = 'https://rex-voice-proxy.recklesswarman.workers.dev';

let currentAudio = null;

export const stopRex = () => {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch {
      // Ignore pause error on unstarted audio
    }
    currentAudio = null;
  }
};

export const speakRex = async (text, onEnded = null) => {
  if (!text) return;

  // Cut off active playback immediately to prevent overlapping dialogue
  stopRex();

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errDetail = await response.text();
      throw new Error(`Proxy error (${response.status}): ${errDetail}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    currentAudio = new Audio(audioUrl);
    if (onEnded) {
      currentAudio.onended = onEnded;
    }
    await currentAudio.play();
  } catch (error) {
    console.error('Rex voice playback failed:', error);
    throw error;
  }
};
