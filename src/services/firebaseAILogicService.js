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

  /**
   * Generates a fully-rigged 3D Pet Gear item with bone socket, procedural mesh archetype,
   * elemental aura VFX, gameplay stat bonuses, and companion voice reactions.
   */
  async generate3DPetGear(options = {}, maybePetId, maybeSocket, maybeNotes) {
    let opts = {};
    if (typeof options === 'string') {
      opts = {
        promptText: options,
        petId: maybePetId || 'rex',
        socket: maybeSocket || 'back',
        notes: maybeNotes || ''
      };
    } else {
      opts = options || {};
    }
    const { promptText = '', theme = 'cyber', socket = 'back', petId = 'rex', defaultPrice = 200 } = opts;
    const validSockets = ['head', 'back', 'chest', 'feet'];
    const targetSocket = validSockets.includes(socket) ? socket : 'back';

    // Default Fallback Configurations per Theme & Socket
    const themeArchetypes = {
      head: {
        cyber: { archetype: 'visor', icon: 'smart_toy', color: '#06b6d4', accent: '#3b82f6', aura: 'electric' },
        fire: { archetype: 'tiara', icon: 'local_fire_department', color: '#f97316', accent: '#ef4444', aura: 'fire' },
        space: { archetype: 'goggles', icon: 'explore', color: '#3b82f6', accent: '#6366f1', aura: 'cosmic' },
        royal: { archetype: 'crown', icon: 'crown', color: '#f59e0b', accent: '#fbbf24', aura: 'stardust' },
        ocean: { archetype: 'cowl', icon: 'water', color: '#06b6d4', accent: '#0284c7', aura: 'wind' },
        rainbow: { archetype: 'crown', icon: 'auto_awesome', color: '#ec4899', accent: '#a855f7', aura: 'stardust' }
      },
      back: {
        cyber: { archetype: 'jetpack', icon: 'rocket_launch', color: '#3b82f6', accent: '#06b6d4', aura: 'electric' },
        fire: { archetype: 'wings', icon: 'flight', color: '#ef4444', accent: '#f97316', aura: 'fire' },
        space: { archetype: 'cloak', icon: 'bedtime', color: '#4f46e5', accent: '#818cf8', aura: 'cosmic' },
        royal: { archetype: 'cape', icon: 'shield', color: '#f59e0b', accent: '#d97706', aura: 'stardust' },
        ocean: { archetype: 'wings', icon: 'flight', color: '#0ea5e9', accent: '#38bdf8', aura: 'wind' },
        rainbow: { archetype: 'cape', icon: 'shield', color: '#ec4899', accent: '#f43f5e', aura: 'stardust' }
      },
      chest: {
        cyber: { archetype: 'harness', icon: 'diamond', color: '#06b6d4', accent: '#10b981', aura: 'electric' },
        fire: { archetype: 'collar', icon: 'local_fire_department', color: '#f97316', accent: '#ef4444', aura: 'fire' },
        space: { archetype: 'crest_plate', icon: 'shield', color: '#6366f1', accent: '#818cf8', aura: 'cosmic' },
        royal: { archetype: 'crest_plate', icon: 'shield', color: '#fbbf24', accent: '#f59e0b', aura: 'stardust' },
        ocean: { archetype: 'collar', icon: 'water_drop', color: '#0284c7', accent: '#38bdf8', aura: 'wind' },
        rainbow: { archetype: 'harness', icon: 'favorite', color: '#ec4899', accent: '#fb7185', aura: 'stardust' }
      },
      feet: {
        cyber: { archetype: 'speed_boots', icon: 'sprint', color: '#10b981', accent: '#06b6d4', aura: 'electric' },
        fire: { archetype: 'lava_greaves', icon: 'volcano', color: '#ef4444', accent: '#f97316', aura: 'fire' },
        space: { archetype: 'speed_boots', icon: 'rocket', color: '#3b82f6', accent: '#6366f1', aura: 'cosmic' },
        royal: { archetype: 'starlight_bands', icon: 'stars', color: '#fbbf24', accent: '#f59e0b', aura: 'stardust' },
        ocean: { archetype: 'speed_boots', icon: 'surfing', color: '#0ea5e9', accent: '#38bdf8', aura: 'wind' },
        rainbow: { archetype: 'starlight_bands', icon: 'auto_awesome', color: '#ec4899', accent: '#a855f7', aura: 'stardust' }
      }
    };

    const activeThemeKey = (theme || 'cyber').toLowerCase();
    const defaults = themeArchetypes[targetSocket]?.[activeThemeKey] || themeArchetypes[targetSocket]?.cyber || {
      archetype: targetSocket === 'back' ? 'cape' : targetSocket === 'head' ? 'crown' : targetSocket === 'chest' ? 'collar' : 'speed_boots',
      icon: 'shield',
      color: '#ef4444',
      accent: '#f59e0b',
      aura: 'stardust'
    };

    let name = promptText.trim() || `${capitalize(activeThemeKey)} Hero ${capitalize(targetSocket)}`;
    let desc = `Legendary 3D superhero gear radiating pure hero power across daily quests!`;
    let socketType = targetSocket;
    let meshArchetype = defaults.archetype;
    let primaryColor = defaults.color;
    let secondaryColor = defaults.accent;
    let aura = defaults.aura;
    let statBonusType = targetSocket === 'feet' ? 'speed_boost' : targetSocket === 'chest' ? 'defense_boost' : targetSocket === 'head' ? 'damage_boost' : 'xp_boost';
    let statBonusPercent = 25;
    let costCoins = parseInt(defaultPrice) || 200;
    let icon = defaults.icon;
    let petVoiceLine = `Woohoo! Look at my new ${name}! Super hero power!`;

    // Attempt Gemini AI Structured Generation
    if (this.isAiReady && this.model) {
      try {
        const aiPrompt = `You are a legendary 3D superhero pet gear designer for a kids (ages 3-9) adventure app called "Little Hero Adventures".
The parent wants to craft custom wearable 3D pet gear for companion pets (Rex the Dino, Aqua Drake, Bella Bunny, Barnaby Bear, Pip Phoenix).

Parent Idea / Prompt: "${promptText || activeThemeKey}"
Theme: "${activeThemeKey}"
Target Socket: "${targetSocket}" (Must be one of: head, back, chest, feet)

Generate a creative, epic, and encouraging gear item. Return ONLY a valid JSON object (no markdown, no code fences):
{
  "name": "Catchy Heroic Name (Max 4 words, e.g. Starlight Sonic Wings)",
  "desc": "Kid-friendly lore description (1-2 sentences)",
  "meshArchetype": "${targetSocket === 'head' ? 'cowl, crown, goggles, tiara, or visor' : targetSocket === 'back' ? 'cape, wings, jetpack, or cloak' : targetSocket === 'chest' ? 'collar, crest_plate, or harness' : 'speed_boots, starlight_bands, or lava_greaves'}",
  "primaryColor": "Hex color code e.g. #3b82f6",
  "secondaryColor": "Hex accent code e.g. #f59e0b",
  "aura": "none, stardust, fire, electric, cosmic, or wind",
  "statBonusType": "damage_boost, xp_boost, speed_boost, coin_boost, or defense_boost",
  "statBonusPercent": 25,
  "costCoins": ${costCoins},
  "icon": "Material symbol name (e.g. masks, crown, shield, flight, rocket_launch, sprint, diamond, local_fire_department, sports_martial_arts, stars)",
  "petVoiceLine": "Short joyful voice line (max 12 words) the pet exclaims when equipping this gear!"
}`;

        const result = await this.model.generateContent(aiPrompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);

        if (parsed.name) name = parsed.name;
        if (parsed.desc) desc = parsed.desc;
        if (parsed.meshArchetype) meshArchetype = parsed.meshArchetype;
        if (parsed.primaryColor && parsed.primaryColor.startsWith('#')) primaryColor = parsed.primaryColor;
        if (parsed.secondaryColor && parsed.secondaryColor.startsWith('#')) secondaryColor = parsed.secondaryColor;
        if (parsed.aura) aura = parsed.aura;
        if (parsed.statBonusType) statBonusType = parsed.statBonusType;
        if (parsed.statBonusPercent) statBonusPercent = Math.min(50, Math.max(10, parseInt(parsed.statBonusPercent) || 25));
        if (parsed.costCoins) costCoins = Math.max(25, parseInt(parsed.costCoins) || costCoins);
        if (parsed.icon) icon = parsed.icon;
        if (parsed.petVoiceLine) petVoiceLine = parsed.petVoiceLine;
      } catch (err) {
        console.warn("AI 3D Gear generation fallback:", err.message);
      }
    }

    const uniqueId = `ai_gear_${Date.now()}`;
    const graphicDataUrl = generate3DIcon(icon, getThemeColorName(primaryColor), name.slice(0, 12));
    const statBonusLabel = `+${statBonusPercent}% ${formatStatBonusName(statBonusType)}`;

    return {
      id: uniqueId,
      name,
      title: name,
      desc,
      socket: targetSocket,
      targetPetSocket: targetSocket,
      meshArchetype,
      defaultColor: primaryColor,
      primaryColor,
      secondaryColor,
      accentColor: secondaryColor,
      aura,
      auraEffect: aura,
      statBonusType,
      statBonusPercent,
      statBonusLabel,
      costCoins,
      coinPrice: costCoins,
      icon,
      image: graphicDataUrl,
      petVoiceLine,
      companionReaction: petVoiceLine,
      hasClothPhysics: (meshArchetype === 'cape' || meshArchetype === 'cloak'),
      isParentCrafted: true,
      isCustomAI: true,
      createdAt: new Date().toISOString()
    };
  }
}

function formatStatBonusName(type) {
  switch (type) {
    case 'damage_boost': return 'AR Boss Damage';
    case 'coin_boost': return 'Habit Coins';
    case 'xp_boost': return 'Quest XP';
    case 'speed_boost': return 'Runway & Habit Speed';
    case 'defense_boost': return 'Pet Defense & Vitality';
    default: return 'Hero Power';
  }
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getThemeColorName(hex) {
  if (!hex) return 'green';
  const h = hex.toLowerCase();
  if (h.includes('ef') || h.includes('e7') || h.includes('f4')) return 'orange';
  if (h.includes('3b') || h.includes('02') || h.includes('0e')) return 'blue';
  if (h.includes('f5') || h.includes('fb') || h.includes('f1')) return 'yellow';
  if (h.includes('10') || h.includes('2e') || h.includes('14')) return 'green';
  return 'teal';
}

export const firebaseAI = new FirebaseAILogicService();
