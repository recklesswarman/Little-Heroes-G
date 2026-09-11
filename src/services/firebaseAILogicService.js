import { app, isFirebaseAvailable } from '../config/firebase.js';
import { generate3DIcon } from '../utils/graphicsGenerator.js';
import { THREE_D_ASSETS, getThreeDAssetsByCategory, matchBestThreeDAsset } from '../data/threeDAssetCatalog.js';

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
      modelUrl: options.modelUrl || 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/DragonAttenuation/glTF-Binary/DragonAttenuation.glb',
      threeDAssetId: options.threeDAssetId || '',
      deliveryMethod: options.deliveryMethod || 'instant_gift',
      targetChildProfile: options.targetChildProfile || 'all',
      bountyRequirement: options.bountyRequirement || null,
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
      modelUrl: options.modelUrl || 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
      threeDAssetId: options.threeDAssetId || '',
      deliveryMethod: options.deliveryMethod || 'instant_gift',
      targetChildProfile: options.targetChildProfile || 'all',
      bountyRequirement: options.bountyRequirement || null,
      isParentCrafted: true,
      isCustomAI: true,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generates interactive 3D Hero HQ Furniture with room comfort buffs & pet interactions.
   */
  async generate3DHeroHQFurniture(options = {}) {
    const { promptText = '', theme = 'space', placementZone = 'bedroom', defaultPrice = 180 } = options;
    const themeDefaults = {
      space: { type: 'bed', name: 'Cosmic Pod Capsule Bed', desc: 'Zero-gravity sleeping pod glowing with starlight LED strips.', icon: 'bed', color: '#4f46e5', accent: '#818cf8', splineUrl: 'https://prod.spline.design/cyber-bed/scene.splinecode' },
      cyber: { type: 'desk', name: 'Holo-Tech Tactical Desk', desc: 'Floating cyberpunk workstation with holographic chore radar.', icon: 'desk', color: '#06b6d4', accent: '#3b82f6', splineUrl: 'https://prod.spline.design/holo-desk/scene.splinecode' },
      royal: { type: 'chair', name: 'Golden Champion Throne', desc: 'Ornate cushioned throne celebrating hero accomplishments.', icon: 'chair', color: '#f59e0b', accent: '#fbbf24', splineUrl: 'https://prod.spline.design/champion-chair/scene.splinecode' },
      dragon: { type: 'light', name: 'Dragon Hearth Lamp', desc: 'Radiates warm cozy light that wards off nighttime fears.', icon: 'light', color: '#ef4444', accent: '#f97316', splineUrl: '' }
    };

    const def = themeDefaults[theme] || themeDefaults.space;
    let name = promptText.trim() || def.name;
    let desc = def.desc;
    let furnitureType = options.furnitureType || def.type;
    let primaryColor = def.color;
    let accentColor = def.accent;
    let splineUrl = options.splineUrl || def.splineUrl;
    let comfortBuffPercent = 25;
    let petInteraction = furnitureType === 'bed' ? 'sleep' : furnitureType === 'chair' ? 'sit' : furnitureType === 'desk' ? 'study' : 'admire';
    let petVoiceLine = furnitureType === 'bed'
      ? "Ahhh, this cloud bed is so soft! Time for bedtime stories!"
      : furnitureType === 'chair'
      ? "Look at me on my hero throne! I am ready for our next mission!"
      : "Beep boop! Studying our hero map for tomorrow's chores!";
    let costCoins = parseInt(defaultPrice) || 180;
    let icon = def.icon;

    if (this.isAiReady && this.model) {
      try {
        const aiPrompt = `You are an imaginative 3D furniture designer for a kids (ages 3-9) adventure room called "Hero HQ".
Parent Idea: "${promptText || theme}"
Room Zone: "${placementZone}"
Generate a whimsical, comforting 3D furniture piece. Return ONLY valid JSON:
{
  "name": "Catchy Heroic Name (Max 4 words)",
  "desc": "Whimsical description (1-2 sentences)",
  "furnitureType": "bed, desk, chair, display, or light",
  "comfortBuffPercent": 25,
  "costCoins": ${costCoins},
  "icon": "bed, desk, chair, emoji_events, or light",
  "petInteraction": "sleep, sit, study, or admire",
  "petVoiceLine": "Joyful spoken line (max 12 words) the companion exclaims when resting on this furniture!"
}`;
        const result = await this.model.generateContent(aiPrompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);
        if (parsed.name) name = parsed.name;
        if (parsed.desc) desc = parsed.desc;
        if (parsed.furnitureType) furnitureType = parsed.furnitureType;
        if (parsed.comfortBuffPercent) comfortBuffPercent = Math.min(50, Math.max(10, parseInt(parsed.comfortBuffPercent) || 25));
        if (parsed.costCoins) costCoins = Math.max(50, parseInt(parsed.costCoins) || costCoins);
        if (parsed.icon) icon = parsed.icon;
        if (parsed.petInteraction) petInteraction = parsed.petInteraction;
        if (parsed.petVoiceLine) petVoiceLine = parsed.petVoiceLine;
      } catch (err) {
        console.warn("AI Furniture generation fallback:", err.message);
      }
    }

    const uniqueId = `ai_furn_${Date.now()}`;
    const graphicDataUrl = generate3DIcon(icon, getThemeColorName(primaryColor), name.slice(0, 12));

    return {
      id: uniqueId,
      name,
      title: name,
      desc,
      category: 'furniture',
      slot: furnitureType,
      furnitureType,
      placementZone,
      primaryColor,
      accentColor,
      splineUrl,
      comfort: comfortBuffPercent,
      comfortBuffPercent,
      comfortBuffLabel: `+${comfortBuffPercent}% HQ Room Comfort & Focus`,
      modelUrl: options.modelUrl || 'https://modelviewer.dev/shared-assets/models/Astronaut.glb',
      threeDAssetId: options.threeDAssetId || '',
      deliveryMethod: options.deliveryMethod || 'instant_gift',
      targetChildProfile: options.targetChildProfile || 'all',
      bountyRequirement: options.bountyRequirement || null,
      costCoins,
      coinPrice: costCoins,
      icon,
      image: graphicDataUrl,
      petInteraction,
      petVoiceLine,
      companionReaction: petVoiceLine,
      isParentCrafted: true,
      isCustomAI: true,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generates interactive 3D Pet Pen Playground Toys that refill pet Joy, Hunger, or Energy.
   */
  async generate3DPetPenToy(options = {}) {
    const { promptText = '', theme = 'space', statRefillType = 'joy', defaultPrice = 120 } = options;
    const toyDefaults = {
      trampoline: { name: 'Rocket Bouncy Trampoline', desc: 'Launches pets into high-flying flips with starry sparkles!', icon: 'sports_gymnastics', anim: 'bounce', color: '#10b981', accent: '#06b6d4', splineUrl: 'https://prod.spline.design/trampoline/scene.splinecode' },
      bowl: { name: 'Never-Ending Magic Feast Bowl', desc: 'Delicious organic berry crunch that fills empty pet tummies!', icon: 'restaurant', anim: 'eat', color: '#f59e0b', accent: '#ef4444', splineUrl: 'https://prod.spline.design/food-bowl/scene.splinecode' },
      laser: { name: 'Starlight Laser Chaser Tower', desc: 'Whimsical rotating beam that keeps energetic pets darting around!', icon: 'flare', anim: 'chase', color: '#ec4899', accent: '#a855f7', splineUrl: 'https://prod.spline.design/laser-tower/scene.splinecode' },
      scratcher: { name: 'Crystal Agility Spire', desc: 'Climbing pillar for testing claws, agility, and heroic stretches!', icon: 'pets', anim: 'scratch', color: '#3b82f6', accent: '#6366f1', splineUrl: 'https://prod.spline.design/agility-spire/scene.splinecode' }
    };

    const targetType = options.toyType || (statRefillType === 'hunger' ? 'bowl' : statRefillType === 'energy' ? 'trampoline' : 'laser');
    const def = toyDefaults[targetType] || toyDefaults.trampoline;
    let name = promptText.trim() || def.name;
    let desc = def.desc;
    let toyType = targetType;
    let primaryColor = def.color;
    let accentColor = def.accent;
    let splineUrl = options.splineUrl || def.splineUrl;
    let refillTarget = statRefillType || 'joy';
    let statRefillAmount = 25;
    let petAnimation = def.anim;
    let petVoiceLine = refillTarget === 'hunger'
      ? "Yum yum in my tummy! That was delicious and healthy!"
      : refillTarget === 'energy'
      ? "Boing! High into the sky! I feel so fast and energized!"
      : "Wheeeeee! Chasing the magic sparkles is the best game ever!";
    let costCoins = parseInt(defaultPrice) || 120;
    let icon = def.icon;

    if (this.isAiReady && this.model) {
      try {
        const aiPrompt = `You are a pet toy designer for a kids adventure app.
Parent Idea: "${promptText || theme}"
Stat Refill: "${refillTarget}"
Generate an exciting 3D pet playground toy. Return ONLY valid JSON:
{
  "name": "Catchy Heroic Toy Name (Max 4 words)",
  "desc": "Fun action description (1-2 sentences)",
  "toyType": "trampoline, bowl, laser, or scratcher",
  "statRefillAmount": 30,
  "costCoins": ${costCoins},
  "icon": "sports_gymnastics, restaurant, flare, or pets",
  "petAnimation": "bounce, eat, chase, or scratch",
  "petVoiceLine": "Exuberant voice line (max 12 words) the pet exclaims when playing!"
}`;
        const result = await this.model.generateContent(aiPrompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);
        if (parsed.name) name = parsed.name;
        if (parsed.desc) desc = parsed.desc;
        if (parsed.toyType) toyType = parsed.toyType;
        if (parsed.statRefillAmount) statRefillAmount = Math.min(50, Math.max(15, parseInt(parsed.statRefillAmount) || 25));
        if (parsed.costCoins) costCoins = Math.max(40, parseInt(parsed.costCoins) || costCoins);
        if (parsed.icon) icon = parsed.icon;
        if (parsed.petAnimation) petAnimation = parsed.petAnimation;
        if (parsed.petVoiceLine) petVoiceLine = parsed.petVoiceLine;
      } catch (err) {
        console.warn("AI Toy generation fallback:", err.message);
      }
    }

    const uniqueId = `ai_toy_${Date.now()}`;
    const graphicDataUrl = generate3DIcon(icon, getThemeColorName(primaryColor), name.slice(0, 12));

    return {
      id: uniqueId,
      name,
      title: name,
      desc,
      category: 'toy',
      toyType,
      statRefillTarget: refillTarget,
      statRefillType: refillTarget,
      statRefillAmount,
      statRefillLabel: `+${statRefillAmount}% Pet ${capitalize(refillTarget)} Refill`,
      modelUrl: options.modelUrl || 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
      threeDAssetId: options.threeDAssetId || '',
      deliveryMethod: options.deliveryMethod || 'instant_gift',
      targetChildProfile: options.targetChildProfile || 'all',
      bountyRequirement: options.bountyRequirement || null,
      primaryColor,
      accentColor,
      splineUrl,
      costCoins,
      coinPrice: costCoins,
      icon,
      image: graphicDataUrl,
      petAnimation,
      cheerVoiceLine: petVoiceLine,
      petVoiceLine,
      companionReaction: petVoiceLine,
      isParentCrafted: true,
      isCustomAI: true,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generates custom AR Quest & Hygiene Bosses for chore battles.
   */
  async generate3DARBoss(options = {}) {
    const { promptText = '', theme = 'dental', routineDomain = 'dental', defaultHp = 250 } = options;
    const bossDefaults = {
      dental: { name: 'Giga Tartar Titan', desc: 'A crystalline sugar-armored colossus threatening gleaming white teeth!', icon: 'coronavirus', domain: 'dental', color: '#06b6d4', taunt: 'Mwahaha! My sugar shield will never crack!', rally: 'Power up your toothbrush bristles! We can break his sugar armor!' },
      chores: { name: 'Chaos Mess Goblin', desc: 'A mischievous critter that scatters socks and blocks the bedroom floor!', icon: 'delete_sweep', domain: 'chores', color: '#f59e0b', taunt: 'Hehehe! Your room will stay a disaster zone forever!', rally: 'Grab your laundry basket! Tidy heroes always win!' },
      nutrition: { name: 'Broccoli Whine Beast', desc: 'A grumpy veggie phantom that tries to swap green crunch for candy!', icon: 'eco', domain: 'nutrition', color: '#10b981', taunt: 'You will never finish your crispy green veggies!', rally: 'Take a brave super bite! Healthy heroes get ultimate power!' },
      bedtime: { name: 'Slumber Delay Phantom', desc: 'A sneaky nighttime cloud that casts snooze-delay spells past bedtime!', icon: 'bedtime', domain: 'bedtime', color: '#6366f1', taunt: 'One more game! One more story! You cannot sleep!', rally: 'Slip into pajamas! Super heroes recharge with peaceful sleep!' }
    };

    const def = bossDefaults[routineDomain] || bossDefaults.dental;
    let name = promptText.trim() || def.name;
    let desc = def.desc;
    let domain = routineDomain || def.domain;
    let hp = parseInt(options.hp) || defaultHp;
    let rewardCoins = 60;
    let rewardXp = 120;
    let attackName = domain === 'dental' ? 'Sticky Sugar Wave' : domain === 'chores' ? 'Dust Bunny Storm' : domain === 'nutrition' ? 'Sour Candy Mist' : 'Midnight Yawn';
    let villainIntroVoice = def.taunt;
    let companionRallyVoice = def.rally;
    let primaryColor = def.color;
    let icon = def.icon;
    let splineUrl = options.splineUrl || (domain === 'dental' ? 'https://prod.spline.design/plaque-monster/scene.splinecode' : '');

    if (this.isAiReady && this.model) {
      try {
        const aiPrompt = `You are a boss designer for a kids (ages 3-9) daily habit AR adventure game.
Parent Idea: "${promptText || theme}"
Routine Domain: "${domain}"
Generate a fun, cartoonish villain boss for kids to defeat. Return ONLY valid JSON:
{
  "name": "Catchy Boss Name (Max 4 words)",
  "desc": "Playful villain description (1-2 sentences)",
  "hp": ${hp},
  "rewardCoins": 60,
  "rewardXp": 120,
  "attackName": "Funny harmless attack move (e.g. Toothpaste Bubble Blast)",
  "villainIntroVoice": "Funny harmless villain taunt (max 12 words)!",
  "companionRallyVoice": "Inspiring companion hero cheer (max 12 words)!"
}`;
        const result = await this.model.generateContent(aiPrompt);
        const text = result.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(text);
        if (parsed.name) name = parsed.name;
        if (parsed.desc) desc = parsed.desc;
        if (parsed.hp) hp = Math.min(600, Math.max(100, parseInt(parsed.hp) || hp));
        if (parsed.rewardCoins) rewardCoins = Math.min(200, Math.max(30, parseInt(parsed.rewardCoins) || 60));
        if (parsed.rewardXp) rewardXp = Math.min(400, Math.max(50, parseInt(parsed.rewardXp) || 120));
        if (parsed.attackName) attackName = parsed.attackName;
        if (parsed.villainIntroVoice) villainIntroVoice = parsed.villainIntroVoice;
        if (parsed.companionRallyVoice) companionRallyVoice = parsed.companionRallyVoice;
      } catch (err) {
        console.warn("AI Boss generation fallback:", err.message);
      }
    }

    const uniqueId = `ai_boss_${Date.now()}`;
    const graphicDataUrl = generate3DIcon(icon, getThemeColorName(primaryColor), name.slice(0, 12));

    return {
      id: uniqueId,
      name,
      title: name,
      desc,
      category: 'boss',
      domain,
      routineDomain: domain,
      hp,
      maxHp: hp,
      rewardCoins,
      rewardXp,
      attackName,
      taunt: villainIntroVoice,
      villainIntroVoice,
      rallyCall: companionRallyVoice,
      companionRallyVoice,
      primaryColor,
      splineUrl,
      icon,
      image: graphicDataUrl,
      avatar: graphicDataUrl,
      isParentCrafted: true,
      isCustomAI: true,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Unified 4-Category Generator Dispatcher
   */
  
  /**
   * Multimodal Gemini 2.5 Vision: Generates 3D content from child drawing / photo upload
   */
  async generate3DContentFromImage(options = {}) {
    const { fileOrBase64, mimeType = 'image/jpeg', category = 'gear', promptText = '' } = options;
    let conceptPrompt = promptText || 'Heroic creation inspired by child drawing';
    let detectedTheme = 'space';

    if (this.isAiReady && this.model && fileOrBase64) {
      try {
        let base64Data = fileOrBase64;
        if (typeof fileOrBase64 === 'string' && fileOrBase64.includes(',')) {
          base64Data = fileOrBase64.split(',')[1];
        }

        const visionPrompt = `You are an imaginative kid's adventure designer analyzing a child's drawing or toy photo.
Category: "${category}".
Describe what this drawing/photo represents in 1 enthusiastic sentence suitable for a 3-8 year old.
Return ONLY valid JSON:
{
  "name": "Catchy Heroic Name (Max 4 words)",
  "concept": "Enthusiastic 1-sentence description of the creature/object",
  "theme": "space, cyber, royal, dragon, ocean, or rainbow",
  "archetypeOrSlot": "visor, wings, jetpack, bed, desk, trampoline, or dragon",
  "voiceLine": "What this item says to cheer on the child (max 12 words)!"
}`;

        const imagePart = {
          inlineData: {
            data: base64Data,
            mimeType: mimeType || 'image/jpeg'
          }
        };

        const res = await this.model.generateContent([visionPrompt, imagePart]);
        const txt = res.response.text().replace(/\\`\\`\\`json/g, '').replace(/\\`\\`\\`/g, '').trim();
        const parsed = JSON.parse(txt);
        if (parsed.name) conceptPrompt = parsed.name;
        if (parsed.theme) detectedTheme = parsed.theme;
        if (parsed.voiceLine) options.petVoiceLine = parsed.voiceLine;
      } catch (err) {
        console.warn("Multimodal AI Vision fallback:", err.message);
        conceptPrompt = promptText || "Starlight Imagination Masterpiece";
      }
    } else {
      conceptPrompt = promptText || "Color-Splashed Heroic Artifact";
    }

    // Now generate the full 3D content with matching asset
    return this.generate3DContent({
      ...options,
      promptText: conceptPrompt,
      theme: detectedTheme,
      category
    });
  }

  async generate3DContent(options = {}) {
    const category = options.category || 'gear';
    const matched3DAsset = matchBestThreeDAsset(options.promptText || '', category);
    if (matched3DAsset && !options.modelUrl && !options.threeDAssetId) {
      options.threeDAssetId = matched3DAsset.id;
      options.modelUrl = matched3DAsset.modelUrl;
      if (!options.splineUrl) options.splineUrl = matched3DAsset.splineUrl;
      if (!options.meshArchetype && matched3DAsset.archetype) options.meshArchetype = matched3DAsset.archetype;
      if (!options.furnitureType && matched3DAsset.furnType) options.furnitureType = matched3DAsset.furnType;
      if (!options.domain && matched3DAsset.domain) options.domain = matched3DAsset.domain;
    }
    if (category === 'furniture') {
      return this.generate3DHeroHQFurniture(options);
    } else if (category === 'toy') {
      return this.generate3DPetPenToy(options);
    } else if (category === 'boss') {
      return this.generate3DARBoss(options);
    } else {
      return this.generate3DPetGear(options);
    }
  }
}

export const SPLINE_3D_PRESETS = {
  gear: [
    { id: 'spline_neon_visor', name: 'Cyber Neon Visor 3D', url: 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode', splineUrl: 'https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode', icon: 'smart_toy', category: 'gear' },
    { id: 'spline_aero_wings', name: 'Meteor Thruster Wings 3D', url: 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode', splineUrl: 'https://prod.spline.design/6Wq1Q7YGyM-iab9i/scene.splinecode', icon: 'flight', category: 'gear' },
    { id: 'spline_golden_crown', name: 'Royal Hero Crown 3D', url: 'https://prod.spline.design/otb9wU4rQ2i4zX8m/scene.splinecode', splineUrl: 'https://prod.spline.design/otb9wU4rQ2i4zX8m/scene.splinecode', icon: 'crown', category: 'gear' }
  ],
  furniture: [
    { id: 'spline_cyber_bed', name: 'Cosmic Pod Bed 3D', url: 'https://prod.spline.design/cyber-bed/scene.splinecode', splineUrl: 'https://prod.spline.design/cyber-bed/scene.splinecode', icon: 'bed', category: 'furniture' },
    { id: 'spline_hero_desk', name: 'Tactical Holo-Desk 3D', url: 'https://prod.spline.design/holo-desk/scene.splinecode', splineUrl: 'https://prod.spline.design/holo-desk/scene.splinecode', icon: 'desk', category: 'furniture' },
    { id: 'spline_gold_throne', name: 'Victory Champion Chair 3D', url: 'https://prod.spline.design/champion-chair/scene.splinecode', splineUrl: 'https://prod.spline.design/champion-chair/scene.splinecode', icon: 'chair', category: 'furniture' },
    { id: 'spline_trophy_pedestal', name: 'Starlight Trophy Pedestal 3D', url: 'https://prod.spline.design/trophy-pedestal/scene.splinecode', splineUrl: 'https://prod.spline.design/trophy-pedestal/scene.splinecode', icon: 'emoji_events', category: 'furniture' }
  ],
  toy: [
    { id: 'spline_rocket_trampoline', name: 'Rocket Bouncy Trampoline 3D', url: 'https://prod.spline.design/trampoline/scene.splinecode', splineUrl: 'https://prod.spline.design/trampoline/scene.splinecode', icon: 'sports_gymnastics', category: 'toy' },
    { id: 'spline_magic_food_bowl', name: 'Never-Ending Feast Bowl 3D', url: 'https://prod.spline.design/food-bowl/scene.splinecode', splineUrl: 'https://prod.spline.design/food-bowl/scene.splinecode', icon: 'restaurant', category: 'toy' },
    { id: 'spline_laser_tower', name: 'Starlight Laser Chaser 3D', url: 'https://prod.spline.design/laser-tower/scene.splinecode', splineUrl: 'https://prod.spline.design/laser-tower/scene.splinecode', icon: 'flare', category: 'toy' },
    { id: 'spline_scratch_spire', name: 'Crystal Agility Spire 3D', url: 'https://prod.spline.design/agility-spire/scene.splinecode', splineUrl: 'https://prod.spline.design/agility-spire/scene.splinecode', icon: 'pets', category: 'toy' }
  ],
  boss: [
    { id: 'spline_plaque_monster', name: 'Giga Plaque Titan 3D', url: 'https://prod.spline.design/plaque-monster/scene.splinecode', splineUrl: 'https://prod.spline.design/plaque-monster/scene.splinecode', icon: 'coronavirus', category: 'boss' },
    { id: 'spline_mess_gremlin', name: 'Messy Sock Goblin 3D', url: 'https://prod.spline.design/messy-goblin/scene.splinecode', splineUrl: 'https://prod.spline.design/messy-goblin/scene.splinecode', icon: 'delete_sweep', category: 'boss' },
    { id: 'spline_sugar_imp', name: 'Sugar Crunch Demon 3D', url: 'https://prod.spline.design/sugar-imp/scene.splinecode', splineUrl: 'https://prod.spline.design/sugar-imp/scene.splinecode', icon: 'cookie', category: 'boss' },
    { id: 'spline_slumber_shadow', name: 'Bedtime Delay Phantom 3D', url: 'https://prod.spline.design/bedtime-phantom/scene.splinecode', splineUrl: 'https://prod.spline.design/bedtime-phantom/scene.splinecode', icon: 'bedtime', category: 'boss' }
  ]
};

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


export { THREE_D_ASSETS, getThreeDAssetsByCategory, matchBestThreeDAsset };
