// Stats View - Simple productivity statistics
import { isoLocal } from './utils.js';
import { getStats, BADGES, loadGamification } from './gamification.js';

// Calculate stats from tasks
export const calculateTaskStats = (tasks) => {
  const today = isoLocal(new Date());
  const weekAgo = isoLocal(new Date(Date.now() - 7 * 86400000));
  const monthAgo = isoLocal(new Date(Date.now() - 30 * 86400000));

  const completedTasks = tasks.filter(t => t.done);
  const todayTasks = tasks.filter(t => t.date === today);
  const todayDone = todayTasks.filter(t => t.done);

  // Weekly stats
  const weekTasks = tasks.filter(t => t.date >= weekAgo && t.date <= today);
  const weekDone = weekTasks.filter(t => t.done);

  // Monthly stats
  const monthTasks = tasks.filter(t => t.date >= monthAgo && t.date <= today);
  const monthDone = monthTasks.filter(t => t.done);

  // Daily completion rate for the last 7 days
  const dailyStats = [];
  for (let i = 6; i >= 0; i--) {
    const date = isoLocal(new Date(Date.now() - i * 86400000));
    const dayTasks = tasks.filter(t => t.date === date);
    const dayDone = dayTasks.filter(t => t.done);
    dailyStats.push({
      date,
      day: new Date(date).toLocaleDateString('fr-FR', { weekday: 'short' }),
      total: dayTasks.length,
      done: dayDone.length,
      rate: dayTasks.length > 0 ? Math.round((dayDone.length / dayTasks.length) * 100) : 0
    });
  }

  // Best day
  const bestDay = dailyStats.reduce((best, day) =>
    day.done > best.done ? day : best, dailyStats[0]);

  // Productivity score (weighted)
  const streakBonus = getStats().streak * 5;
  const completionRate = weekTasks.length > 0 ? (weekDone.length / weekTasks.length) * 100 : 0;
  const productivityScore = Math.min(100, Math.round(completionRate + streakBonus));

  return {
    today: { total: todayTasks.length, done: todayDone.length },
    week: { total: weekTasks.length, done: weekDone.length },
    month: { total: monthTasks.length, done: monthDone.length },
    allTime: { total: tasks.length, done: completedTasks.length },
    dailyStats,
    bestDay,
    productivityScore,
  };
};

// Render stats view
export const renderStatsView = (tasks) => {
  const stats = calculateTaskStats(tasks);
  const gamification = getStats();

  return `
    <div class="stats-view">
      <div class="stats-header">
        <h2>Statistiques</h2>
      </div>

      <!-- Level Card -->
      <div class="stats-card level-card">
        <div class="level-display">
          <span class="level-big-icon">${gamification.levelIcon}</span>
          <div class="level-info">
            <span class="level-name">${gamification.levelName}</span>
            <span class="level-number">Niveau ${gamification.level}</span>
          </div>
        </div>
        <div class="xp-bar">
          <div class="xp-progress" style="width: ${gamification.levelProgress}%"></div>
        </div>
        <div class="xp-text">${gamification.xp} / ${gamification.nextLevelXp} XP</div>
      </div>

      <!-- Quick Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">🔥</span>
          <span class="stat-value">${gamification.streak}</span>
          <span class="stat-label">jours de streak</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✅</span>
          <span class="stat-value">${gamification.totalTasks}</span>
          <span class="stat-label">taches totales</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">🎯</span>
          <span class="stat-value">${gamification.totalFocusHours}h</span>
          <span class="stat-label">de focus</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">⭐</span>
          <span class="stat-value">${gamification.perfectDays}</span>
          <span class="stat-label">perfect days</span>
        </div>
      </div>

      <!-- Productivity Score -->
      <div class="stats-card">
        <h3>Score de productivite</h3>
        <div class="score-circle">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" class="score-bg"/>
            <circle cx="50" cy="50" r="45" class="score-progress"
              style="stroke-dasharray: ${stats.productivityScore * 2.83} 283"/>
          </svg>
          <span class="score-value">${stats.productivityScore}</span>
        </div>
      </div>

      <!-- Weekly Chart -->
      <div class="stats-card">
        <h3>Cette semaine</h3>
        <div class="week-chart">
          ${stats.dailyStats.map(day => `
            <div class="day-bar">
              <div class="bar-container">
                <div class="bar-fill" style="height: ${Math.max(5, day.rate)}%"></div>
              </div>
              <span class="day-label">${day.day}</span>
              <span class="day-count">${day.done}/${day.total}</span>
            </div>
          `).join('')}
        </div>
        <p class="week-summary">
          ${stats.week.done}/${stats.week.total} taches cette semaine
          ${stats.bestDay.done > 0 ? `• Meilleur jour: ${stats.bestDay.day} (${stats.bestDay.done})` : ''}
        </p>
      </div>

      <!-- Badges -->
      <div class="stats-card badges-card">
        <h3>Badges (${gamification.badgesUnlocked}/${gamification.totalBadges})</h3>
        <div class="badges-grid">
          ${renderBadgesSection()}
        </div>
      </div>
    </div>
  `;
};

// Render badges section
const renderBadgesSection = () => {
  const state = loadGamification();

  return Object.values(BADGES).map(badge => {
    const unlocked = state.unlockedBadges.includes(badge.id);
    return `
      <div class="badge-item ${unlocked ? 'unlocked' : 'locked'}"
           title="${badge.desc}">
        <span class="badge-icon">${unlocked ? badge.icon : '🔒'}</span>
        <span class="badge-name">${badge.name}</span>
      </div>
    `;
  }).join('');
};
