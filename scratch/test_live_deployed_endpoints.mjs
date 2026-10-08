// Test live deployed Cloud Run AGY service through Firebase Hosting
const BASE_URL = 'https://little-heroes-quest-8842.web.app';

console.log('Testing live deployed endpoints at:', BASE_URL);

// 1. Health check
try {
  const healthRes = await fetch(`${BASE_URL}/api/rex/health`);
  console.log('Health check status:', healthRes.status);
  const healthData = await healthRes.json();
  console.log('Health check data:', healthData);
} catch (err) {
  console.error('Health check failed:', err.message);
}

// 2. Chat with kid name
try {
  console.log('\nTesting /api/rex/chat with childName="Leo"...');
  const chatRes = await fetch(`${BASE_URL}/api/rex/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: "Hi Rex! I am ready to brush my teeth!",
      heroId: "hero_leo",
      childName: "Leo",
      heroName: "Leo",
      appState: {
        hero: { name: "Leo", points: 150, coins: 50 },
        questProgress: { completedCount: 3 }
      }
    })
  });
  console.log('Chat status:', chatRes.status);
  const chatData = await chatRes.json();
  console.log('Chat response:', JSON.stringify(chatData, null, 2));
} catch (err) {
  console.error('Chat failed:', err.message);
}

// 3. Audio endpoint check (HEAD or mock upload)
try {
  console.log('\nTesting /api/rex/audio with sample WAV header...');
  // Minimal valid 44-byte WAV header
  const wavHeader = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    0x66, 0x6d, 0x74, 0x20, 0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
    0x44, 0xac, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00, 0x02, 0x00, 0x10, 0x00,
    0x64, 0x61, 0x74, 0x61, 0x00, 0x00, 0x00, 0x00
  ]);
  const blob = new Blob([wavHeader], { type: 'audio/wav' });
  const formData = new FormData();
  formData.append('audio', blob, 'sample.wav');
  formData.append('heroId', 'hero_leo');
  formData.append('childName', 'Leo');
  formData.append('heroName', 'Leo');

  const audioRes = await fetch(`${BASE_URL}/api/rex/audio`, {
    method: 'POST',
    body: formData
  });
  console.log('Audio endpoint status:', audioRes.status);
  const audioData = await audioRes.json();
  console.log('Audio response:', JSON.stringify(audioData, null, 2));
} catch (err) {
  console.error('Audio failed:', err.message);
}
