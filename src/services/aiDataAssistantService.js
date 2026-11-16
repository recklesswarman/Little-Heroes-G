/**
 * aiDataAssistantService.js
 * Embedded AI "Chat with Your Data" Assistant Subsystem for Little Heroes Parent Portal.
 * 
 * Features:
 * - Multi-kid grounded household context extractor from store.getState()
 * - 3-Tier streaming cascade:
 *     1. Firebase AI Logic client SDK (Gemini)
 *     2. Backend /api/gemini/chat endpoint
 *     3. Intelligent grounded local rule synthesizer (offline/fallback resilient)
 * - Clickable habit deep-link formatting ([Title](habit:<id>), [Title](log:<id>), [Title](approval:<id>), etc.)
 */

import { store } from '../state/store.js';
import { firebaseAI } from './firebaseAILogicService.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Extracts and synthesizes grounded household state for the given kid (or all kids).
 */
export function buildGroundedHouseholdContext(selectedKidId = 'all') {
  const state = store.getState() || {};
  const allHeroes = Array.isArray(state.heroes) ? state.heroes : (state.selectedHero ? [state.selectedHero] : []);
  const allLogs = Array.isArray(state.taskCompletionLogs) ? state.taskCompletionLogs : [];
  const allApprovals = Array.isArray(state.pendingApprovals) ? state.pendingApprovals : [];
  const allLedger = Array.isArray(state.taskLedgerLogs) ? state.taskLedgerLogs : [];

  const targetHeroes = selectedKidId === 'all'
    ? allHeroes
    : allHeroes.filter(h => h.id === selectedKidId);

  const heroProfiles = targetHeroes.map(h => ({
    id: h.id,
    name: h.name || 'Little Hero',
    role: h.role || 'Adventurer',
    streak: Number(h.streak) || 1,
    brushStreak: Number(h.brushStreak) || Number(h.streak) || 1,
    points: Number(h.points) || 0,
    tokens: Number(h.coins || h.tokens) || 0,
    screenTimeMinutes: Number(h.screenTimeMinutes) || 45,
    screenTimeUsedToday: Number(h.screenTimeUsedToday) || 0,
    dailyMaxScreenTime: Number(h.dailyMaxScreenTime) || 60,
    screenTimeRate: Number(h.screenTimeRate) || 2,
    bedtimeCurfew: h.bedtimeCurfew || '20:00',
    isScreenTimePaused: Boolean(h.isScreenTimePaused)
  }));

  // Filter logs for target kids
  const relevantLogs = allLogs
    .filter(log => selectedKidId === 'all' || !log.heroId || log.heroId === selectedKidId)
    .slice(0, 30)
    .map(log => ({
      id: log.id,
      taskId: log.taskId || 'routine_task',
      taskTitle: log.taskTitle || 'Daily Routine',
      heroId: log.heroId,
      heroName: log.heroName || 'Hero',
      status: log.status || 'approved',
      pointsAwarded: Number(log.pointsAwarded) || 0,
      coinsAwarded: Number(log.coinsAwarded) || 0,
      dateString: log.dateString || '',
      timeString: log.timeString || '',
      zone: log.zone || 'Habit Islands'
    }));

  // Filter pending approvals for target kids
  const relevantApprovals = allApprovals
    .filter(app => selectedKidId === 'all' || !app.kidId || app.kidId === selectedKidId)
    .map(app => ({
      id: app.id,
      logId: app.logId,
      kidId: app.kidId,
      kidName: app.kidName || 'Hero',
      taskId: app.taskId,
      taskTitle: app.taskTitle || 'Chore Approval',
      pendingPoints: Number(app.pendingPoints) || 0
    }));

  // Ledger summary
  const recentLedger = allLedger.slice(0, 15);

  const totalCompleted = relevantLogs.length;
  const totalApproved = relevantLogs.filter(l => l.status === 'approved').length;
  const approvalRate = totalCompleted > 0 ? Math.round((totalApproved / totalCompleted) * 100) : 100;

  return {
    selectedScope: selectedKidId === 'all' ? 'Entire Household' : (targetHeroes[0]?.name || 'Child Profile'),
    selectedKidId,
    heroes: heroProfiles,
    metrics: {
      totalChoresLogged: totalCompleted,
      approvedChores: totalApproved,
      approvalRatePercentage: approvalRate,
      pendingApprovalCount: relevantApprovals.length,
      averageStreak: heroProfiles.length > 0 ? Math.round(heroProfiles.reduce((acc, h) => acc + h.streak, 0) / heroProfiles.length) : 1
    },
    recentLogs: relevantLogs,
    pendingApprovals: relevantApprovals,
    recentLedger
  };
}

/**
 * Parses markdown deep-links ([Label](type:id)) into interactive clickable HTML buttons.
 */
export function parseHabitDeepLinks(text) {
  if (!text) return '';

  // Match [Label](type:id) where type is habit, log, approval, nav, or task
  const linkRegex = /\[([^\]]+)\]\((habit|log|approval|nav|task):([^\)]+)\)/g;
  let formatted = text.replace(linkRegex, (match, label, type, id) => {
    let icon = 'open_in_new';
    if (type === 'habit' || type === 'task') icon = 'task_alt';
    else if (type === 'approval') icon = 'verified';
    else if (type === 'log') icon = 'history';
    else if (type === 'nav') icon = 'near_me';

    const safeLabel = escapeHtml(label);
    const safeType = escapeHtml(type);
    const safeId = escapeHtml(id);

    return `<button type="button" class="habit-deep-link-btn inline-flex items-center gap-1 px-2.5 py-0.5 my-0.5 rounded-lg text-xs font-headline font-black bg-primary/20 text-primary border border-primary/40 hover:bg-primary/30 transition-all active:scale-95 cursor-pointer shadow-xs" data-deep-link-type="${safeType}" data-deep-link-id="${safeId}" title="Jump to ${safeLabel}"><span class="material-symbols-outlined text-[13px]">${icon}</span><span>${safeLabel}</span></button>`;
  });

  // Basic markdown formatting: bold, italic, line breaks
  formatted = formatted
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '<div class="h-2"></div>')
    .replace(/\n/g, '<br/>');

  return formatted;
}

/**
 * Intelligent Grounded Heuristic Synthesizer.
 * Provides instant, factually grounded, pediatric-informed answers when offline or testing.
 */
function generateHeuristicResponse(userQuery, context) {
  const query = (userQuery || '').toLowerCase();
  const heroes = context.heroes || [];
  const primaryHero = heroes[0] || { name: 'Your hero', streak: 1, points: 0, screenTimeMinutes: 45, dailyMaxScreenTime: 60 };
  const scopeName = context.selectedScope || 'your family';
  const logs = context.recentLogs || [];
  const approvals = context.pendingApprovals || [];

  // Streak inquiries
  if (query.includes('streak') || query.includes('consistency') || query.includes('momentum') || query.includes('habit')) {
    const habitSample = logs[0]
      ? `[${logs[0].taskTitle}](habit:${logs[0].taskId})`
      : `[Daily Routine](nav:tasks)`;

    let response = `Based on current household records for **${scopeName}**:\n\n`;
    if (context.selectedKidId === 'all') {
      response += `• Your heroes have an active average streak of **${context.metrics.averageStreak} days** 🔥.\n`;
      heroes.forEach(h => {
        response += `  - **${h.name}**: ${h.streak}-day streak (${h.streak >= 3 ? 'Eligible for Vault 🎁' : 'Building momentum!'})\n`;
      });
    } else {
      response += `• **${primaryHero.name}** is on a **${primaryHero.streak}-day streak** 🔥 with ${primaryHero.brushStreak}-day dental hygiene consistency!\n`;
      if (primaryHero.streak >= 3) {
        response += `• Milestone achieved: 3-Day Streak Vault 🎁 is unlocked and ready for celebration in the Hero Shop.\n`;
      } else {
        response += `• Next milestone: Complete 3 consecutive days of routines to earn the Bronze Mystery Vault!\n`;
      }
    }
    response += `\nRecent activity shows consistent completion of ${habitSample}. Approval rate is **${context.metrics.approvalRatePercentage}%** across verified routines.`;
    return response;
  }

  // Screen time & balance inquiries
  if (query.includes('screen') || query.includes('media') || query.includes('balance') || query.includes('earned') || query.includes('curfew')) {
    const screenBankLink = `[Screen Time Bank](nav:screentime)`;
    let response = `Here is the current responsibility balance for **${scopeName}**:\n\n`;

    if (context.selectedKidId === 'all') {
      heroes.forEach(h => {
        const net = (h.points * h.screenTimeRate) - h.screenTimeUsedToday;
        response += `• **${h.name}**: ${h.screenTimeMinutes}m banked, ${h.screenTimeUsedToday}m used today (Cap: ${h.dailyMaxScreenTime}m). Net: ${net >= 0 ? '+' : ''}${net}m.\n`;
      });
    } else {
      const net = (primaryHero.points * primaryHero.screenTimeRate) - primaryHero.screenTimeUsedToday;
      response += `• **${primaryHero.name}** currently has **${primaryHero.screenTimeMinutes} minutes** in the ${screenBankLink}.\n`;
      response += `• Screen time used today: **${primaryHero.screenTimeUsedToday}m** of the **${primaryHero.dailyMaxScreenTime}m daily cap**.\n`;
      response += `• Current conversion: 1 Point ⭐ earns **${primaryHero.screenTimeRate} minutes** of screen time.\n`;
      response += `• Bedtime lock curfew: **${primaryHero.bedtimeCurfew}** (Screen locks automatically for restful sleep 🌙).\n`;
      if (primaryHero.screenTimeUsedToday >= primaryHero.dailyMaxScreenTime) {
        response += `\n⚠️ ${primaryHero.name} has reached today's screen limit. Encourage physical play or reading!`;
      } else {
        response += `\n💡 Healthy habit tip: Keep earned time at least 15m ahead of redeemed media to nurture intrinsic responsibility!`;
      }
    }
    return response;
  }

  // Pending approvals / inbox inquiries
  if (query.includes('approval') || query.includes('pending') || query.includes('inbox') || query.includes('sign') || query.includes('verify')) {
    if (approvals.length === 0) {
      return `Good news! There are currently **no pending chore sign-offs** for **${scopeName}**. All completed routines have been verified! 🌟`;
    }
    let response = `You have **${approvals.length} pending approval(s)** awaiting your review in the Action Inbox:\n\n`;
    approvals.slice(0, 3).forEach(app => {
      response += `• ${app.kidName}: [${app.taskTitle}](approval:${app.id}) (+${app.pendingPoints} ⭐)\n`;
    });
    response += `\nClick any item above to jump directly to the Action Inbox and approve with one touch!`;
    return response;
  }

  // Routine & chore inquiries
  if (query.includes('chore') || query.includes('task') || query.includes('brush') || query.includes('bedtime') || query.includes('routine')) {
    let response = `**${scopeName} Routine Summary**:\n\n`;
    response += `• Total completed tasks in history: **${context.metrics.totalChoresLogged}**.\n`;
    if (logs.length > 0) {
      response += `• Recent verified completions:\n`;
      logs.slice(0, 3).forEach(l => {
        response += `  - [${l.taskTitle}](log:${l.id}) for ${l.heroName} on ${l.dateString || 'today'} (+${l.pointsAwarded} ⭐, +${l.coinsAwarded} 🪙)\n`;
      });
    }
    response += `\nTo edit active routines or rewards, visit [Tasks & Routines](nav:tasks).`;
    return response;
  }

  // Default holistic overview
  const sampleHabit = logs[0] ? `[${logs[0].taskTitle}](habit:${logs[0].taskId})` : `[Morning Routine](nav:tasks)`;
  const screenBankLink = `[Screen Time Bank](nav:screentime)`;
  return `Here is a developmental overview for **${scopeName}**:\n\n` +
         `• **Consistency**: Active streak is **${primaryHero.streak} days** 🔥 with a **${context.metrics.approvalRatePercentage}%** routine completion rate.\n` +
         `• **Screen Balance**: **${primaryHero.screenTimeMinutes} minutes** banked in ${screenBankLink} against a daily limit of **${primaryHero.dailyMaxScreenTime}m**.\n` +
         `• **Recent Milestone**: Consistently completing ${sampleHabit} with great enthusiasm.\n` +
         (approvals.length > 0 ? `• **Action Required**: You have ${approvals.length} pending sign-off(s) in [Action Inbox](nav:approvals).\n` : '') +
         `\nFeel free to ask about streaks, daily screen time balance, pending chores, or personalized pediatric coaching!`;
}

/**
 * Streams chat responses with progressive token delivery.
 * Supports Firebase AI Logic (Gemini), backend /api/gemini/chat, and local grounded fallback.
 */
export async function streamChatWithData({
  userQuery,
  selectedKidId = 'all',
  onChunk = () => {},
  onComplete = () => {},
  onError = () => {}
}) {
  const context = buildGroundedHouseholdContext(selectedKidId);
  const contextJson = JSON.stringify(context, null, 2);

  const systemPrompt = `You are the Little Heroes Pediatric Data & Habit Assistant.
You have access to the verified household records for the parent below:

${contextJson}

INSTRUCTIONS:
1. Answer factually grounded in the provided logs, streaks, and screen time bank ledger.
2. If asked about streaks, quote exact streak days and reference streak vaults.
3. If asked about screen time, state earned minutes, redeemed minutes, daily cap, and conversion rates accurately.
4. When citing specific tasks, completion logs, or approvals, ALWAYS format them as structured deep-links:
   - Habits/tasks: [Task Name](habit:<taskId>)
   - Completion audit logs: [Task Name](log:<logId>)
   - Approvals: [Task Name](approval:<approvalId>)
   - Portal Tabs: [Tab Name](nav:<tabId>) where tabId is one of 'approvals', 'screentime', 'reports', 'tasks', 'rewards'
5. Be supportive, warm, encouraging, and pedagogically sound. Keep answers concise (under 160 words).`;

  // Tier 1: Firebase AI Logic SDK (Gemini) in the browser
  if (firebaseAI && firebaseAI.isAiReady && firebaseAI.model) {
    try {
      const prompt = `${systemPrompt}\n\nParent Question: ${userQuery}`;
      if (typeof firebaseAI.model.generateContentStream === 'function') {
        const streamResult = await firebaseAI.model.generateContentStream(prompt);
        let accumulated = '';
        for await (const chunk of streamResult.stream) {
          const chunkText = chunk.text();
          accumulated += chunkText;
          onChunk(accumulated, chunkText);
        }
        onComplete(accumulated);
        return;
      }
    } catch (firebaseErr) {
      console.warn('Firebase AI Logic streaming failed, cascading to server/local:', firebaseErr?.message || firebaseErr);
    }
  }

  // Tier 2: Backend /api/gemini/chat endpoint if reachable
  if (typeof fetch !== 'undefined') {
    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `${systemPrompt}\n\nParent Question: ${userQuery}`,
          mode: 'fast'
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.text || data?.reply || data?.content || '';
        if (text) {
          // Progressively stream tokens to UI for a smooth conversational feel
          let current = '';
          const words = text.split(' ');
          for (let i = 0; i < words.length; i++) {
            current += (i === 0 ? '' : ' ') + words[i];
            onChunk(current, words[i]);
            await new Promise(r => setTimeout(r, 20));
          }
          onComplete(text);
          return;
        }
      }
    } catch (serverErr) {
      // Server not running or offline (e.g. static hosting)
    }
  }

  // Tier 3: Intelligent Grounded Local Rule Synthesizer (Offline / Static Hosting / Tests)
  try {
    const heuristicResponse = generateHeuristicResponse(userQuery, context);
    let current = '';
    const words = heuristicResponse.split(' ');
    for (let i = 0; i < words.length; i++) {
      current += (i === 0 ? '' : ' ') + words[i];
      onChunk(current, words[i]);
      await new Promise(r => setTimeout(r, 15));
    }
    onComplete(heuristicResponse);
  } catch (err) {
    onError(err);
  }
}
