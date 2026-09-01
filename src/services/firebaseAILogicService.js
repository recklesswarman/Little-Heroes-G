import { app, isFirebaseAvailable } from '../config/firebase.js';
import { generate3DIcon } from '../utils/graphicsGenerator.js';

class FirebaseAILogicService {
  constructor() {
    this.ai = null;
    this.model = null;
    this.isAiReady = false;
    this.init();
  }

  async init() {
    if (!isFirebaseAvailable || !app) {
      console.log("Firebase AI Logic running in intelligent local offline mode");
      return;
    }

    try {
      const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
      this.ai = getAI(app, { backend: new GoogleAIBackend() });
      this.model = getGenerativeModel(this.ai, {
        model: "gemini-2.5-flash-lite",
        generationConfig: {
          temperature: 0.7,
          topP: 0.95
        }
      });
      this.isAiReady = true;
      console.log("🔥 Firebase AI Logic (Gemini API) initialized successfully!");
    } catch (e) {
      console.warn("Firebase AI Logic fallback to client generator:", e.message);
    }
  }

  async generateRewardItem(promptText, typeCategory = 'gear', defaultPrice = 150) {
    let title = promptText;
    let description = `A powerful custom ${typeCategory} crafted to help little heroes on their daily quests.`;
    let costCoins = parseInt(defaultPrice) || 150;
    let iconName = typeCategory === 'weapon' ? 'colorize' : typeCategory === 'badge' ? 'military_tech' : typeCategory === 'snack' ? 'nutrition' : typeCategory === 'theme' ? 'palette' : 'shield';
    let colorTheme = typeCategory === 'weapon' ? 'blue' : typeCategory === 'badge' ? 'yellow' : typeCategory === 'snack' ? 'orange' : typeCategory === 'theme' ? 'teal' : 'green';

    // If Firebase AI Logic Gemini is active, use generative AI for dynamic lore & enhancement
    if (this.isAiReady && this.model) {
      try {
        const aiPrompt = `You are a whimsical reward designer for a kids (ages 3-9) chore and habit adventure app called "Little Heroes".
The parent provided this idea: "${promptText}".
Target category: "${typeCategory}".
Return ONLY a valid JSON object with these exact keys (no markdown code blocks, just raw JSON):
{
  "title": "A short, catchy, epic name (max 4 words)",
  "description": "Fun, encouraging description for a young child (max 1 sentence)",
  "suggestedPrice": 250,
  "themeColor": "green" or "blue" or "yellow" or "orange" or "teal" (NO pink or purple),
  "iconSymbol": "shield" or "swords" or "rocket_launch" or "stars" or "military_tech" or "nutrition" or "electric_bolt" or "palette" or "sports_martial_arts"
}`;

        const result = await this.model.generateContent(aiPrompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);
        if (parsed.title) title = parsed.title;
        if (parsed.description) description = parsed.description;
        if (parsed.suggestedPrice) costCoins = parsed.suggestedPrice;
        if (parsed.themeColor) colorTheme = parsed.themeColor;
        if (parsed.iconSymbol) iconName = parsed.iconSymbol;
      } catch (err) {
        console.warn("AI Logic generation fallback:", err.message);
      }
    }

    // Generate high-resolution 3D tactile vector graphic
    const graphicDataUrl = generate3DIcon(iconName, colorTheme, title.slice(0, 12));

    const categoryName = typeCategory === 'gear' 
      ? 'Avatar Gear' 
      : typeCategory === 'weapon' 
      ? 'Weapons' 
      : typeCategory === 'badge' 
      ? 'Badges' 
      : typeCategory === 'snack' 
      ? 'Snacks' 
      : 'Profile Themes';

    return {
      id: 'ai_' + Date.now(),
      title,
      name: title,
      desc: description,
      category: categoryName,
      costCoins,
      image: graphicDataUrl,
      isNew: true,
      colorTheme,
      iconSymbol: iconName
    };
  }
}

export const firebaseAI = new FirebaseAILogicService();
