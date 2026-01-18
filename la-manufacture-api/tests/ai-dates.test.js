/**
 * Tests for date parsing in AI process-inbox
 *
 * Run with: node tests/ai-dates.test.js
 */

// Simulate the date calculation logic from ai.js (AFTER FIX)
function calculateDates() {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const currentDayName = dayNames[now.getDay()];

  // Calculate tomorrow (NEW: explicit calculation)
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  const tomorrowDayName = dayNames[tomorrow.getDay()];

  // Calculate after tomorrow (NEW: explicit calculation)
  const afterTomorrow = new Date(now);
  afterTomorrow.setDate(afterTomorrow.getDate() + 2);
  const afterTomorrowDate = afterTomorrow.toISOString().split('T')[0];

  return {
    currentDate,
    currentDayName,
    tomorrowDate,
    tomorrowDayName,
    afterTomorrowDate
  };
}

// Generate the prompt section (shows what the AI receives)
function generatePromptSection(dates) {
  return `Dates relatives (base: ${dates.currentDate} = ${dates.currentDayName}) :
- "aujourd'hui" → ${dates.currentDate}
- "demain" → ${dates.tomorrowDate} (${dates.tomorrowDayName})
- "après-demain" → ${dates.afterTomorrowDate}
- "lundi", "mardi" → prochain jour de la semaine
- "lundi prochain" → semaine suivante
- "dans X jours/semaines/mois"

IMPORTANT: Utilise TOUJOURS les dates ISO exactes ci-dessus. "demain" = ${dates.tomorrowDate}, PAS une formule à calculer.`;
}

// Test cases for manual verification
const testCases = [
  {
    input: "demain j'ai un rdv",
    expected: { type: 'event', dateShouldBeTomorrow: true },
    reason: "Contains 'rdv' (event keyword) + 'demain' (date)"
  },
  {
    input: "rdv dentiste demain 14h",
    expected: { type: 'event', dateShouldBeTomorrow: true, time: '14:00' },
    reason: "Contains 'rdv' + 'demain' + explicit time '14h'"
  },
  {
    input: "demain appeler Marie",
    expected: { type: 'task', dateShouldBeTomorrow: true },
    reason: "Action verb 'appeler' without time = task"
  },
  {
    input: "aujourd'hui j'ai une réunion à 15h",
    expected: { type: 'event', dateShouldBeToday: true, time: '15:00' },
    reason: "Contains 'réunion' (event keyword) + time"
  },
  {
    input: "lundi rdv avec le client",
    expected: { type: 'event', hasDate: true },
    reason: "Contains 'rdv' = event"
  },
  {
    input: "demain matin réunion équipe",
    expected: { type: 'event', dateShouldBeTomorrow: true, time: '09:00' },
    reason: "Contains 'réunion' + 'matin' = 09:00"
  },
  {
    input: "j'ai un rdv demain",
    expected: { type: 'event', dateShouldBeTomorrow: true },
    reason: "Contains 'rdv' = event"
  },
  {
    input: "faut que je fasse ça demain",
    expected: { type: 'task', dateShouldBeTomorrow: true },
    reason: "Implicit action, no event keyword = task"
  },
  {
    input: "après-demain meeting avec Paul 10h",
    expected: { type: 'event', dateShouldBeAfterTomorrow: true, time: '10:00' },
    reason: "Contains 'meeting' + 'après-demain' + time"
  }
];

// Run tests
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║          AI DATE PARSING TEST - AFTER FIX                   ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');

const dates = calculateDates();

console.log('=== Current Date Context ===');
console.log(`Today:          ${dates.currentDate} (${dates.currentDayName})`);
console.log(`Tomorrow:       ${dates.tomorrowDate} (${dates.tomorrowDayName})`);
console.log(`After tomorrow: ${dates.afterTomorrowDate}`);
console.log('');

console.log('=== What the AI Prompt Now Contains (FIXED) ===');
console.log(generatePromptSection(dates));
console.log('');

console.log('=== Test Cases for Manual Verification ===');
console.log('');

testCases.forEach((test, i) => {
  console.log(`┌─ Test ${i + 1} ────────────────────────────────────────────────────`);
  console.log(`│ Input: "${test.input}"`);
  console.log(`│`);
  console.log(`│ Expected:`);
  console.log(`│   Type: ${test.expected.type.toUpperCase()}`);

  if (test.expected.dateShouldBeTomorrow) {
    console.log(`│   Date: ${dates.tomorrowDate} (demain)`);
  } else if (test.expected.dateShouldBeToday) {
    console.log(`│   Date: ${dates.currentDate} (aujourd'hui)`);
  } else if (test.expected.dateShouldBeAfterTomorrow) {
    console.log(`│   Date: ${dates.afterTomorrowDate} (après-demain)`);
  }

  if (test.expected.time) {
    console.log(`│   Time: ${test.expected.time}`);
  }

  console.log(`│`);
  console.log(`│ Reason: ${test.reason}`);
  console.log(`└──────────────────────────────────────────────────────────────`);
  console.log('');
});

console.log('=== Fix Summary ===');
console.log('');
console.log('BEFORE (buggy):');
console.log('  Prompt said: "demain" → ${currentDate} + 1 jour');
console.log('  Problem: AI had to calculate the date itself → errors');
console.log('');
console.log('AFTER (fixed):');
console.log(`  Prompt says: "demain" → ${dates.tomorrowDate} (${dates.tomorrowDayName})`);
console.log('  Fix: Explicit date provided → no calculation needed');
console.log('');
console.log('File modified: la-manufacture-api/src/routes/ai.js');
console.log('');
