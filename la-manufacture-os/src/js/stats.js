// Stats View - Simple productivity statistics
import { isoLocal } from './utils.js';

// Calculate stats from tasks
export const calculateTaskStats = (tasks) => {
  const today = isoLocal(new Date());
  const weekAgo = isoLocal(new Date(Date.now() - 7 * 86400000));
  const monthAgo = isoLocal(new Date(Date.now() - 30 * 86400000));

  const completedTasks = tasks.filter(t => t.done);
  const todayTasks = tasks.filter(t => (t.date || '').split('T')[0] === today);
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
    const dayTasks = tasks.filter(t => (t.date || '').split('T')[0] === date);
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

  // Productivity score based on completion rate only
  const completionRate = weekTasks.length > 0 ? (weekDone.length / weekTasks.length) * 100 : 0;
  const productivityScore = Math.min(100, Math.round(completionRate));

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

// Render stats view - Clean, focused on clarity
export const renderStatsView = (tasks) => {
  const stats = calculateTaskStats(tasks);

  return `
    <div class="stats-view">
      <div class="stats-header">
        <h2>Statistiques</h2>
      </div>

      <!-- Quick Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-icon">📅</span>
          <span class="stat-value">${stats.today.done}/${stats.today.total}</span>
          <span class="stat-label">aujourd'hui</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📊</span>
          <span class="stat-value">${stats.week.done}/${stats.week.total}</span>
          <span class="stat-label">cette semaine</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">📈</span>
          <span class="stat-value">${stats.month.done}</span>
          <span class="stat-label">ce mois</span>
        </div>
        <div class="stat-card">
          <span class="stat-icon">✅</span>
          <span class="stat-value">${stats.allTime.done}</span>
          <span class="stat-label">total</span>
        </div>
      </div>

      <!-- Productivity Score -->
      <div class="stats-card">
        <h3>Taux de complétion</h3>
        <div class="score-circle">
          <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" class="score-bg"/>
            <circle cx="50" cy="50" r="45" class="score-progress"
              style="stroke-dasharray: ${stats.productivityScore * 2.83} 283"/>
          </svg>
          <span class="score-value">${stats.productivityScore}%</span>
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
          ${stats.week.done}/${stats.week.total} tâches cette semaine
          ${stats.bestDay.done > 0 ? `• Meilleur jour: ${stats.bestDay.day} (${stats.bestDay.done})` : ''}
        </p>
      </div>
    </div>
  `;
};
