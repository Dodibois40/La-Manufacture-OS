// Gamification System - Streaks, Badges, Levels
import { isoLocal, toast, playSound, triggerConfetti } from './utils.js';

const STORAGE_KEY = 'lm_os_gamification';

// Badge definitions
export const BADGES = {
  // Streaks
  streak_3: { id: 'streak_3', name: 'En route', desc: '3 jours consecutifs', icon: '🔥', requirement: 3 },
  streak_7: { id: 'streak_7', name: 'Semaine parfaite', desc: '7 jours consecutifs', icon: '⚡', requirement: 7 },
  streak_30: { id: 'streak_30', name: 'Inarretable', desc: '30 jours consecutifs', icon: '💎', requirement: 30 },

  // Productivity
  early_bird: { id: 'early_bird', name: 'Early Bird', desc: '5 taches avant 9h', icon: '🌅', requirement: 5 },
  night_owl: { id: 'night_owl', name: 'Night Owl', desc: '10 taches apres 20h', icon: '🦉', requirement: 10 },
  perfect_day: { id: 'perfect_day', name: 'Perfect Day', desc: 'Toutes les taches du jour faites', icon: '✨', requirement: 1 },
  perfect_week: { id: 'perfect_week', name: 'Perfect Week', desc: '7 Perfect Days', icon: '🏆', requirement: 7 },

  // Volume
  tasks_10: { id: 'tasks_10', name: 'Debutant', desc: '10 taches completees', icon: '📝', requirement: 10 },
  tasks_50: { id: 'tasks_50', name: 'Productif', desc: '50 taches completees', icon: '📋', requirement: 50 },
  tasks_100: { id: 'tasks_100', name: 'Machine', desc: '100 taches completees', icon: '🚀', requirement: 100 },
  tasks_500: { id: 'tasks_500', name: 'Legendaire', desc: '500 taches completees', icon: '👑', requirement: 500 },

  // Focus
  focus_1h: { id: 'focus_1h', name: 'Concentre', desc: '1h de focus cumulee', icon: '🎯', requirement: 60 },
  focus_10h: { id: 'focus_10h', name: 'Focus Master', desc: '10h de focus cumulees', icon: '🧘', requirement: 600 },
  focus_50h: { id: 'focus_50h', name: 'Zen Master', desc: '50h de focus cumulees', icon: '🔮', requirement: 3000 },

  // Team
  team_player: { id: 'team_player', name: 'Team Player', desc: '10 taches deleguees', icon: '🤝', requirement: 10 },
  leader: { id: 'leader', name: 'Leader', desc: '50 taches deleguees', icon: '👔', requirement: 50 },

  // Special
  first_task: { id: 'first_task', name: 'Premier pas', desc: 'Premiere tache completee', icon: '🎉', requirement: 1 },
  speed_demon: { id: 'speed_demon', name: 'Speed Demon', desc: '5 taches en 10 min', icon: '⚡', requirement: 5 },
};

// Level thresholds (XP needed)
const LEVELS = [
  { level: 1, xp: 0, name: 'Novice', icon: '🌱' },
  { level: 2, xp: 100, name: 'Apprenti', icon: '🌿' },
  { level: 3, xp: 300, name: 'Competent', icon: '🌳' },
  { level: 4, xp: 600, name: 'Experimente', icon: '⭐' },
  { level: 5, xp: 1000, name: 'Expert', icon: '🌟' },
  { level: 6, xp: 1500, name: 'Maitre', icon: '💫' },
  { level: 7, xp: 2500, name: 'Grand Maitre', icon: '✨' },
  { level: 8, xp: 4000, name: 'Elite', icon: '💎' },
  { level: 9, xp: 6000, name: 'Champion', icon: '🏆' },
  { level: 10, xp: 10000, name: 'Legende', icon: '👑' },
];

// XP rewards
const XP_REWARDS = {
  task_complete: 10,
  task_urgent: 15,
  perfect_day: 50,
  streak_day: 5,
  focus_session: 20,
  badge_unlock: 100,
};

// Default gamification state
const defaultState = () => ({
  xp: 0,
  level: 1,
  streak: 0,
  lastActiveDate: null,
  totalTasksCompleted: 0,
  totalFocusMinutes: 0,
  totalDelegated: 0,
  perfectDays: 0,
  earlyBirdCount: 0,
  nightOwlCount: 0,
  speedDemonTasks: [],
  unlockedBadges: [],
  badgeProgress: {},
});

// Load gamification state
export const loadGamification = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...defaultState(), ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Error loading gamification:', e);
  }
  return defaultState();
};

// Save gamification state
export const saveGamification = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Error saving gamification:', e);
  }
};

// Get current level info
export const getLevelInfo = (xp) => {
  let currentLevel = LEVELS[0];
  for (const level of LEVELS) {
    if (xp >= level.xp) {
      currentLevel = level;
    } else {
      break;
    }
  }
  const nextLevel = LEVELS.find(l => l.xp > xp) || currentLevel;
  const progress = nextLevel.xp > currentLevel.xp
    ? ((xp - currentLevel.xp) / (nextLevel.xp - currentLevel.xp)) * 100
    : 100;

  return { ...currentLevel, nextLevel, progress, currentXp: xp };
};

// Add XP with animation
export const addXP = (amount, reason = '') => {
  const state = loadGamification();
  const oldLevel = getLevelInfo(state.xp);
  state.xp += amount;
  const newLevel = getLevelInfo(state.xp);
  saveGamification(state);

  // Level up!
  if (newLevel.level > oldLevel.level) {
    setTimeout(() => {
      triggerConfetti();
      playSound('levelup');
      toast(`🎉 Niveau ${newLevel.level} - ${newLevel.name}!`);
    }, 300);
  }

  return { xpGained: amount, newTotal: state.xp, levelUp: newLevel.level > oldLevel.level };
};

// Update streak
export const updateStreak = () => {
  const state = loadGamification();
  const today = isoLocal(new Date());
  const yesterday = isoLocal(new Date(Date.now() - 86400000));

  if (state.lastActiveDate === today) {
    // Already active today
    return state.streak;
  } else if (state.lastActiveDate === yesterday) {
    // Consecutive day
    state.streak += 1;
    state.lastActiveDate = today;
    addXP(XP_REWARDS.streak_day * state.streak, 'streak');

    // Check streak badges
    checkStreakBadges(state);
  } else if (state.lastActiveDate !== today) {
    // Streak broken or first day
    if (state.streak > 0) {
      toast(`💔 Streak perdu (${state.streak} jours)`);
    }
    state.streak = 1;
    state.lastActiveDate = today;
  }

  saveGamification(state);
  return state.streak;
};

// Check and unlock streak badges
const checkStreakBadges = (state) => {
  if (state.streak >= 3 && !state.unlockedBadges.includes('streak_3')) {
    unlockBadge('streak_3');
  }
  if (state.streak >= 7 && !state.unlockedBadges.includes('streak_7')) {
    unlockBadge('streak_7');
  }
  if (state.streak >= 30 && !state.unlockedBadges.includes('streak_30')) {
    unlockBadge('streak_30');
  }
};

// Unlock a badge
export const unlockBadge = (badgeId) => {
  const state = loadGamification();
  if (state.unlockedBadges.includes(badgeId)) return false;

  const badge = BADGES[badgeId];
  if (!badge) return false;

  state.unlockedBadges.push(badgeId);
  saveGamification(state);

  // Celebrate!
  setTimeout(() => {
    triggerConfetti();
    playSound('badge');
    toast(`${badge.icon} Badge debloque: ${badge.name}!`);
  }, 200);

  addXP(XP_REWARDS.badge_unlock, 'badge');
  return true;
};

// Record task completion
export const recordTaskCompletion = (task) => {
  const state = loadGamification();
  state.totalTasksCompleted += 1;

  const hour = new Date().getHours();

  // Early bird (before 9am)
  if (hour < 9) {
    state.earlyBirdCount += 1;
    if (state.earlyBirdCount >= 5 && !state.unlockedBadges.includes('early_bird')) {
      unlockBadge('early_bird');
    }
  }

  // Night owl (after 8pm)
  if (hour >= 20) {
    state.nightOwlCount += 1;
    if (state.nightOwlCount >= 10 && !state.unlockedBadges.includes('night_owl')) {
      unlockBadge('night_owl');
    }
  }

  // Speed demon tracking
  const now = Date.now();
  state.speedDemonTasks = state.speedDemonTasks.filter(t => now - t < 600000); // 10 min
  state.speedDemonTasks.push(now);
  if (state.speedDemonTasks.length >= 5 && !state.unlockedBadges.includes('speed_demon')) {
    unlockBadge('speed_demon');
  }

  // First task
  if (state.totalTasksCompleted === 1) {
    unlockBadge('first_task');
  }

  // Volume badges
  if (state.totalTasksCompleted >= 10 && !state.unlockedBadges.includes('tasks_10')) {
    unlockBadge('tasks_10');
  }
  if (state.totalTasksCompleted >= 50 && !state.unlockedBadges.includes('tasks_50')) {
    unlockBadge('tasks_50');
  }
  if (state.totalTasksCompleted >= 100 && !state.unlockedBadges.includes('tasks_100')) {
    unlockBadge('tasks_100');
  }
  if (state.totalTasksCompleted >= 500 && !state.unlockedBadges.includes('tasks_500')) {
    unlockBadge('tasks_500');
  }

  saveGamification(state);

  // Add XP
  const xp = task.urgent ? XP_REWARDS.task_urgent : XP_REWARDS.task_complete;
  addXP(xp, 'task');

  // Update streak
  updateStreak();
};

// Record perfect day
export const recordPerfectDay = () => {
  const state = loadGamification();
  state.perfectDays += 1;
  saveGamification(state);

  if (!state.unlockedBadges.includes('perfect_day')) {
    unlockBadge('perfect_day');
  }

  if (state.perfectDays >= 7 && !state.unlockedBadges.includes('perfect_week')) {
    unlockBadge('perfect_week');
  }

  addXP(XP_REWARDS.perfect_day, 'perfect_day');

  // Special celebration
  setTimeout(() => {
    triggerConfetti();
    triggerConfetti();
    playSound('perfect');
    toast('🌟 Perfect Day! Toutes tes taches sont faites!');
  }, 500);
};

// Record focus session
export const recordFocusSession = (minutes) => {
  const state = loadGamification();
  state.totalFocusMinutes += minutes;
  saveGamification(state);

  // Focus badges
  if (state.totalFocusMinutes >= 60 && !state.unlockedBadges.includes('focus_1h')) {
    unlockBadge('focus_1h');
  }
  if (state.totalFocusMinutes >= 600 && !state.unlockedBadges.includes('focus_10h')) {
    unlockBadge('focus_10h');
  }
  if (state.totalFocusMinutes >= 3000 && !state.unlockedBadges.includes('focus_50h')) {
    unlockBadge('focus_50h');
  }

  addXP(XP_REWARDS.focus_session, 'focus');
};

// Record delegation
export const recordDelegation = () => {
  const state = loadGamification();
  state.totalDelegated += 1;
  saveGamification(state);

  if (state.totalDelegated >= 10 && !state.unlockedBadges.includes('team_player')) {
    unlockBadge('team_player');
  }
  if (state.totalDelegated >= 50 && !state.unlockedBadges.includes('leader')) {
    unlockBadge('leader');
  }
};

// Get stats summary
export const getStats = () => {
  const state = loadGamification();
  const level = getLevelInfo(state.xp);

  return {
    xp: state.xp,
    level: level.level,
    levelName: level.name,
    levelIcon: level.icon,
    levelProgress: level.progress,
    nextLevelXp: level.nextLevel.xp,
    streak: state.streak,
    totalTasks: state.totalTasksCompleted,
    totalFocusHours: Math.round(state.totalFocusMinutes / 60 * 10) / 10,
    perfectDays: state.perfectDays,
    badgesUnlocked: state.unlockedBadges.length,
    totalBadges: Object.keys(BADGES).length,
    badges: state.unlockedBadges.map(id => BADGES[id]),
  };
};

// Render streak widget
export const renderStreakWidget = () => {
  const state = loadGamification();
  const level = getLevelInfo(state.xp);

  return `
    <div class="streak-widget">
      <div class="streak-flame ${state.streak > 0 ? 'active' : ''}">
        <span class="streak-icon">${state.streak > 0 ? '🔥' : '❄️'}</span>
        <span class="streak-count">${state.streak}</span>
      </div>
      <div class="level-badge">
        <span class="level-icon">${level.icon}</span>
        <span class="level-num">Niv.${level.level}</span>
      </div>
    </div>
  `;
};

// Render badges grid
export const renderBadgesGrid = () => {
  const state = loadGamification();

  return Object.values(BADGES).map(badge => {
    const unlocked = state.unlockedBadges.includes(badge.id);
    return `
      <div class="badge-item ${unlocked ? 'unlocked' : 'locked'}" title="${badge.desc}">
        <span class="badge-icon">${unlocked ? badge.icon : '🔒'}</span>
        <span class="badge-name">${badge.name}</span>
      </div>
    `;
  }).join('');
};

// Play special sounds
playSound.levelup = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.1);
      gain.gain.exponentialDecayTo && gain.gain.exponentialDecayTo(0.01, ctx.currentTime + i * 0.1 + 0.3);
      osc.start(ctx.currentTime + i * 0.1);
      osc.stop(ctx.currentTime + i * 0.1 + 0.3);
    });
  } catch (e) {}
};

playSound.badge = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1108.73, ctx.currentTime + 0.1);
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialDecayTo && gain.gain.exponentialDecayTo(0.01, ctx.currentTime + 0.4);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
};

playSound.perfect = () => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.08);
      osc.start(ctx.currentTime + i * 0.08);
      osc.stop(ctx.currentTime + i * 0.08 + 0.2);
    });
  } catch (e) {}
};
