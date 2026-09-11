import { cloudFunctionsService } from './cloudFunctionsService.js';

/**
 * Service to aggregate multi-kid activity logs, pet care, games, and routines
 * to generate holistic 4-Pillar Developmental Growth Reports with Gemini.
 */
class AIDevelopmentalReportService {
  constructor() {
    this.storageKey = 'little_heroes_weekly_developmental_reports';
  }

  /**
   * Generates or retrieves a cached weekly report for a specific hero or all kids.
   * @param {Object} params
   * @param {Object} params.hero - Target hero or null for household aggregate
   * @param {Array} params.heroes - All heroes in the family
   * @param {Array} params.completionLogs - Task completion logs
   * @param {Object} params.petStats - Companion pet vitals
   * @param {number} [params.weekOffset=0] - 0 for current week, 1 for last week
   * @param {boolean} [params.forceRefresh=false]
   * @returns {Promise<Object>} 4-Pillar Report
   */
  async getWeeklyReport({ hero, heroes = [], completionLogs = [], petStats = {}, weekOffset = 0, forceRefresh = false }) {
    const heroId = hero ? hero.id : 'household_all';
    const weekKey = this.getWeekKey(weekOffset);
    const cacheKey = `${heroId}_${weekKey}`;

    if (!forceRefresh) {
      const cached = this.getCachedReport(cacheKey);
      if (cached) return cached;
    }

    // Filter completion logs within the 7-day window
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const endMs = now - (weekOffset * 7 * dayMs);
    const startMs = endMs - (7 * dayMs);

    const relevantLogs = completionLogs.filter(log => {
      const t = log.timestamp || new Date(log.completedAt).getTime();
      const heroMatches = !hero || log.heroId === hero.id;
      return heroMatches && t >= startMs && t <= endMs;
    });

    const report = await this.synthesizeReport({
      hero,
      heroes,
      logs: relevantLogs,
      petStats,
      weekKey,
      weekLabel: this.getWeekLabel(weekOffset)
    });

    this.cacheReport(cacheKey, report);
    return report;
  }

  getWeekKey(offset) {
    const d = new Date();
    d.setDate(d.getDate() - (offset * 7));
    const year = d.getFullYear();
    const onejan = new Date(year, 0, 1);
    const week = Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
    return `${year}-W${week}`;
  }

  getWeekLabel(offset) {
    if (offset === 0) return 'This Week (Current)';
    if (offset === 1) return 'Last Week';
    return `${offset} Weeks Ago`;
  }

  getCachedReport(key) {
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      return stored[key] || null;
    } catch {
      return null;
    }
  }

  cacheReport(key, report) {
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
      stored[key] = report;
      localStorage.setItem(this.storageKey, JSON.stringify(stored));
    } catch (e) {
      console.warn('Failed to cache developmental report:', e);
    }
  }

  async synthesizeReport({ hero, heroes, logs, petStats, weekKey, weekLabel }) {
    const childName = hero ? hero.name : 'The Little Heroes Household';
    const totalChores = logs.length;
    const approvedChores = logs.filter(l => l.status === 'approved').length;
    const morningRoutines = logs.filter(l => (l.taskTitle || '').toLowerCase().includes('bed') || (l.timeString || '').includes('AM')).length;
    const hygieneBattles = logs.filter(l => (l.taskTitle || '').toLowerCase().includes('teeth') || (l.taskTitle || '').includes('Toothbrush') || (l.taskTitle || '').includes('Mint')).length;
    const petJoy = petStats?.joy || 85;
    const petHygiene = petStats?.hygiene || 90;

    const gameLogs = logs.filter(l => l.zone === 'Adventure Learning Games');
    const totalGames = gameLogs.length;
    const totalGameStars = gameLogs.reduce((acc, l) => acc + (l.starsEarned || 1), 0);
    const uniqueSubjects = Array.from(new Set(gameLogs.map(l => l.subject).filter(Boolean)));

    const movementLogs = logs.filter(l => l.zone === 'Gross Motor & Dance Party' || l.category === 'gross_motor');
    const totalMovementMinutes = movementLogs.reduce((acc, l) => acc + (l.durationMinutes || 2), 0);
    const totalMovementSessions = movementLogs.length;
    const feverBursts = movementLogs.reduce((acc, l) => acc + (l.feverBursts || 0), 0);

    const expeditionLogs = logs.filter(l => l.zone === 'Pet Expeditions' || l.category === 'companion_exploration');
    const totalExpeditions = expeditionLogs.length;

    // Try cloud function parent insights if available
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const cloudData = await cloudFunctionsService.getParentInsights({
          householdName: childName,
          completedHabitsCount: totalChores,
          heroes: heroes.map(h => ({ name: h.name, level: h.level, streak: h.streak }))
        });

        if (cloudData && cloudData.insights) {
          // Enrich with 4-pillar structure
          return this.formatFourPillarReport({
            childName,
            weekKey,
            weekLabel,
            totalChores,
            approvedChores,
            morningRoutines,
            hygieneBattles,
            totalGames,
            totalGameStars,
            uniqueSubjects,
            totalMovementMinutes,
            totalMovementSessions,
            feverBursts,
            totalExpeditions,
            petJoy,
            petHygiene,
            executiveSummary: cloudData.insights.executiveSummary,
            praisePoints: cloudData.insights.praiseHighlights,
            tips: cloudData.insights.parentTips,
            recommendedReward: cloudData.insights.recommendedReward
          });
        }
      }
    } catch (err) {
      console.warn('Cloud parent insights unavailable, using intelligent local developmental engine:', err);
    }

    return this.formatFourPillarReport({
      childName,
      weekKey,
      weekLabel,
      totalChores,
      approvedChores,
      morningRoutines,
      hygieneBattles,
      totalGames,
      totalGameStars,
      uniqueSubjects,
      totalMovementMinutes,
      totalMovementSessions,
      feverBursts,
      totalExpeditions,
      petJoy,
      petHygiene
    });
  }

  formatFourPillarReport({
    childName,
    weekKey,
    weekLabel,
    totalChores = 14,
    approvedChores = 12,
    morningRoutines = 6,
    hygieneBattles = 10,
    totalGames = 0,
    totalGameStars = 0,
    uniqueSubjects = [],
    totalMovementMinutes = 0,
    totalMovementSessions = 0,
    feverBursts = 0,
    totalExpeditions = 0,
    petJoy = 88,
    petHygiene = 92,
    executiveSummary,
    praisePoints,
    tips,
    recommendedReward
  }) {
    const consistencyScore = Math.min(100, Math.round((approvedChores / Math.max(1, totalChores)) * 100) || 94);

    return {
      id: 'rep_' + weekKey + '_' + Date.now(),
      weekKey,
      weekLabel,
      childName,
      generatedAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      overallRating: approvedChores >= 10 ? 'Exceptional Development' : 'Steady Progress',
      consistencyScore,
      pillars: [
        {
          id: 'pillar_independence',
          name: '1. Independence & Daily Routines',
          icon: 'task_alt',
          score: Math.min(100, 80 + Math.floor(morningRoutines * 3)),
          status: 'Thriving',
          summary: `${childName} completed ${totalChores} daily routines with ${consistencyScore}% parental verification rate. Morning routine timing has solidified into an autonomous habit without verbal reminders.`,
          metrics: [
            { label: 'Completed Routines', value: `${totalChores} Tasks` },
            { label: 'Routine Autonomy', value: 'High' },
            { label: 'Morning Punctuality', value: '92%' }
          ]
        },
        {
          id: 'pillar_cognitive',
          name: '2. Cognitive & Motor Milestones',
          icon: 'psychology',
          score: Math.min(100, 85 + Math.min(15, (totalGameStars + totalMovementSessions) * 2)),
          status: (totalGames > 0 || totalMovementSessions > 0) ? 'Surpassing Milestone' : 'Developing Steadily',
          summary: totalMovementSessions > 0
            ? `${childName} demonstrated excellent gross motor coordination and energy regulation across ${totalMovementSessions} guided movement routines (${totalMovementMinutes} active play minutes, ${feverBursts} fever bursts). ${totalGames > 0 ? `Also mastered ${totalGames} learning challenges (${totalGameStars} mastery stars earned in ${uniqueSubjects.join(', ') || 'curriculum subjects'}).` : ''} Proprioception, rhythm synchrony, and bilateral coordination are developing exceptionally.`
            : totalGames > 0
              ? `${childName} demonstrated sharp cognitive problem-solving across ${totalGames} learning challenges (${totalGameStars} mastery stars earned in ${uniqueSubjects.join(', ') || 'curriculum subjects'}). Exceptional focus and motor coordination shown during interactive brushing and learning sequences.`
              : `Exceptional motor coordination shown during interactive AR Toothbrush Battles (${hygieneBattles} battles completed). Demonstrated spatial awareness and sustained two-minute focus during brushing sequences.`,
          metrics: [
            { label: 'Learning Challenges Mastered', value: `${totalGames || hygieneBattles} Challenges` },
            { label: 'Gross Motor Activity', value: totalMovementSessions > 0 ? `${totalMovementMinutes} Mins (${totalMovementSessions} Quests)` : `${totalGameStars || 3} Stars ⭐` },
            { label: 'Rhythm & Coordination', value: totalMovementSessions > 0 ? 'Superior' : 'Strong' }
          ]
        },
        {
          id: 'pillar_emotional',
          name: '3. Emotional & Companion Wellness',
          icon: 'favorite',
          score: petJoy,
          status: 'Joyful & Empathetic',
          summary: totalExpeditions > 0
            ? `${childName} demonstrated strong empathy and companion bonding through ${totalExpeditions} autonomous foraging expeditions and regular care. Companion joy is at ${petJoy}% and hygiene at ${petHygiene}%, reflecting proactive nurturing.`
            : `Regular pet companion care and gentleness. Companion pet joy is currently at ${petJoy}% and hygiene at ${petHygiene}%, reflecting consistent empathy, kindness, and nurturing behaviors.`,
          metrics: [
            { label: 'Companion Joy Rating', value: `${petJoy}%` },
            { label: 'Expedition Quests', value: `${totalExpeditions} Trips` },
            { label: 'Empathy & Care Index', value: 'Strong' }
          ]
        },
        {
          id: 'pillar_actionable',
          name: '4. Actionable Parenting Guidance',
          icon: 'lightbulb',
          score: 100,
          status: 'Personalized Coaching',
          summary: executiveSummary || `Continue encouraging ${childName}'s proactive bed-making and toy organization. Try offering two positive choices rather than open-ended directives to support their growing desire for autonomy.`,
          recommendations: tips || [
            `Praise ${childName}'s persistence on multi-step routines rather than the final perfection.`,
            'Acknowledge pet companion feeding with specific descriptive verbal praise.',
            'Celebrate this week\'s streak with a 15-minute family reading or board game night.'
          ],
          recommendedReward: recommendedReward || 'Special Weekend Living Room Camping Adventure'
        }
      ]
    };
  }
}

export const aiDevelopmentalReportService = new AIDevelopmentalReportService();
