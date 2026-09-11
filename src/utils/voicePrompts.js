// Pet Companion & Rex the Dino Spoken Voice Guidance for Toddlers (Easy Mode Age 3-4) & App-wide Voice Output
// Calls speakCompanion via Cloudflare Worker proxy, with device-native Daniel SpeechSynthesis fallback.

import { speakCompanion, stopRex } from '../services/voiceService.js';
import { store } from '../state/store.js';

class VoicePromptsService {
  constructor() {
    this.isEnabled = true;
  }

  async speak(text, onEndCallback = null, petId = null) {
    if (!this.isEnabled || !text) return;
    this.stop();
    const targetPetId = petId || store.getActivePet?.()?.id || 'rex';
    await speakCompanion(text, targetPetId, onEndCallback);
  }

  speakGuidance(stepName, questionText, options = []) {
    const welcome = stepName ? `Welcome to ${stepName}!` : '';
    const prompt = questionText ? `${questionText}. Can you tap the right answer?` : '';
    const textToSpeak = [welcome, prompt].filter(Boolean).join(' ');
    this.speak(textToSpeak);
  }

  speakSuccess() {
    const praises = [
      "Great job! You found the right answer!",
      "Hooray! That is correct! You are a super hero!",
      "Awesome work! Your companion is so happy!",
      "You did it! Super hero power!"
    ];
    const pick = praises[Math.floor(Math.random() * praises.length)];
    this.speak(pick);
  }

  speakTryAgain() {
    this.speak("Almost there! Give it another try!");
  }

  speakExpeditionDepart(petName = 'Your companion', biomeTitle = 'the wilderness') {
    this.speak(`Safe travels into ${biomeTitle}, ${petName}! Bring back shiny treasures and postcards!`);
  }

  speakExpeditionReturn(petName = 'Your companion', souvenirTitle = '') {
    const itemMsg = souvenirTitle ? ` You found ${souvenirTitle}!` : '';
    this.speak(`Hooray! Welcome home, ${petName}!${itemMsg} Check your souvenir shelf!`);
  }

  speakHQWelcome(petName = 'Rex', themeName = 'Hero HQ') {
    this.speak(`Welcome home to ${themeName}, Little Hero! ${petName} is cozy and ready to play!`);
  }

  speakTrophyInspect(trophyTitle = 'Super Trophy') {
    this.speak(`Look at that gleaming ${trophyTitle}! You earned this with true superhero dedication!`);
  }

  speakFurniturePlaced(furnitureName = 'new furniture') {
    this.speak(`Awesome choice! Your ${furnitureName} looks fantastic in our secret base!`);
  }

  speakBossLunge(bossName = 'The Boss', quadrantName = 'your teeth') {
    this.speak(`Watch out, Little Hero! ${bossName} is lunging at ${quadrantName}! Brush in circles to knock him back!`);
  }

  speakShieldActive(bossName = 'The Boss') {
    this.speak(`He summoned a sugar shield! Keep scrubbing with power to smash through it!`);
  }

  speakBossDizzy() {
    this.speak(`Woohoo! He is dizzy! Blast him with toothpaste bubbles!`);
  }

  speakBossDefeated(bossName = 'The Boss') {
    this.speak(`Incredible job! We washed away ${bossName}! Your teeth are sparkling clean!`);
  }

  speakDanceFreezeCountdown() {
    this.speak(`3... 2... 1... FREEZE! Don't move a muscle!`);
  }

  speakDanceFreezeSuccess() {
    this.speak(`Perfect ice statue! You held so still! Bonus sparks earned!`);
  }

  speakDanceUnfreeze() {
    this.speak(`Unfreeze and dance! Shake those wiggles out!`);
  }

  speakDanceFeverMode() {
    this.speak(`Rainbow Fever Mode activated! Look at those superhero moves!`);
  }

  speakDanceRoutineComplete(routineName = 'Movement Routine') {
    this.speak(`Incredible dancing, Little Hero! You mastered the ${routineName}! You are a true dance star!`);
  }

  stop() {
    stopRex();
  }
}

export const voicePrompts = new VoicePromptsService();
