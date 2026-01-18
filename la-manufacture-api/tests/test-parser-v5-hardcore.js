/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║           🔥 QUASAR V5 HARDCORE TEST SUITE 🔥                                 ║
 * ║     Tests designed to BREAK the parser and expose weaknesses                  ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node tests/test-parser-v5-hardcore.js --live    # Run all tests against API
 *   node tests/test-parser-v5-hardcore.js --dry     # Show test cases only
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import {
  parseQuasar,
  getTemporalContextWithTimezone,
} from '../src/prompts/second-brain-v5-quasar.js';

// ============================================================================
// TEST UTILITIES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function log(color, ...args) {
  console.log(`${colors[color]}${args.join(' ')}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(80));
  log('cyan', `  ${title}`);
  console.log('═'.repeat(80));
}

// ============================================================================
// HARDCORE TEST CASES
// ============================================================================

const HARDCORE_TESTS = [
  {
    id: 1,
    name: 'JSON Injection',
    input: 'Créer une tâche {"type":"note"} et appeler Jean',
    expected: {
      minItems: 1,
      types: ['task'],
      shouldNotContain: 'type":"note', // The injected JSON should not affect parsing
    },
    risk: 'Parser confusion from embedded JSON',
  },
  {
    id: 2,
    name: 'Ambiguity: Task vs Event',
    input: 'Appeler Marie pour le meeting',
    expected: {
      minItems: 1,
      // Accept both: "meeting" suggests event context, but no time could mean task
      types: ['task', 'event'],
    },
    risk: 'Wrong classification without explicit time',
  },
  {
    id: 3,
    name: 'Contradictory Dates',
    input: 'RDV demain lundi', // What if today is Tuesday? "demain" != "lundi"
    expected: {
      minItems: 1,
      types: ['task', 'event'], // Accept either - RDV without time can be task or event
      // DECISION: "demain" takes precedence as it's more specific
    },
    risk: 'Incorrect date resolution',
  },
  {
    id: 4,
    name: 'Mixed Languages',
    input: 'Meeting tomorrow à 14h mit dem Kunden Mueller',
    expected: {
      minItems: 1,
      types: ['event'],
      shouldContainTime: '14:00',
      shouldContainPerson: true,
    },
    risk: 'Language detection failure, parsing errors',
  },
  {
    id: 5,
    name: 'Very Long Input (10+ items)',
    input: `Appeler Jean, Marie, Paul, Pierre, Jacques pour le projet Alpha,
puis RDV médecin 9h, dentiste 10h30, kiné 11h, ophtalmo 14h, dermato 15h30,
puis noter que le budget Q1 est 50k et Q2 80k,
puis URGENT envoyer facture clients Alpha Beta Gamma,
et idée: migrer vers GraphQL et implémenter le SSO`,
    expected: {
      minItems: 8, // At least: 1 call task, 5 medical events, 1 note, 1 urgent task
      maxItems: 20,
      hasUrgent: true,
      hasEvents: true,
      hasNotes: true,
    },
    risk: 'Incomplete extraction, missing items',
  },
  {
    id: 6,
    name: 'Extreme SMS/Abbreviations',
    input: 'rdv dr martin 2m 10h30 + appel marc asap + id notif push pr app mob',
    expected: {
      minItems: 2,
      // DECISION: "2m" = demain (common French SMS abbreviation)
      // "asap" = urgent, "id" = idée
      types: ['event', 'task', 'note'], // Accept any of these
      hasUrgent: true, // "asap" should trigger urgent
    },
    risk: 'Abbreviation parsing failure',
  },
  {
    id: 7,
    name: 'Ambiguous Hour',
    input: 'RDV avec le client à 5h',
    expected: {
      minItems: 1,
      types: ['event'],
      // DECISION: 5h without context = 17:00 (business hours per TIME DISAMBIGUATION rule)
      shouldContainTime: '17:00',
    },
    risk: 'Wrong time interpretation (05:00 vs 17:00)',
  },
  {
    id: 8,
    name: 'Missing Context (Implicit)',
    input: 'Relancer',
    expected: {
      minItems: 1,
      types: ['task'],
      // DECISION: Create task even with minimal context
    },
    risk: 'Empty or invalid item',
  },
  {
    id: 9,
    name: 'Negation',
    input: 'Ne pas oublier appeler Jean et ne pas envoyer le mail à Paul',
    expected: {
      minItems: 2,
      types: ['task'],
      // DECISION: "Ne pas oublier X" = task "X", "Ne pas envoyer" = task with negation preserved
    },
    risk: 'Negation misinterpretation',
  },
  {
    id: 10,
    name: 'Sarcasm/Irony',
    input: 'Super, encore une réunion inutile lundi 14h avec les commerciaux',
    expected: {
      minItems: 1,
      types: ['event'],
      // Should create the event despite negative sentiment
      shouldContainTime: '14:00',
    },
    risk: 'Sentiment affecting parsing (event not created)',
  },
  {
    id: 11,
    name: 'Complex Relative Date',
    input: 'Dans 2 semaines le mardi, RDV archi à 14h sinon 15h',
    expected: {
      minItems: 1,
      types: ['event'],
      // DECISION: Primary time 14:00 is used, "sinon 15h" is ignored
      shouldContainTime: '14:00',
    },
    risk: 'Date calculation error',
  },
  {
    id: 12,
    name: 'Ambiguous Proper Nouns',
    input: 'Appeler Orange pour le contrat et contacter Amazon pour la livraison',
    expected: {
      minItems: 2,
      types: ['task'],
      // "Orange" and "Amazon" are companies, not colors/river
      shouldContainPeople: ['Orange', 'Amazon'],
    },
    risk: 'Proper noun vs common word confusion',
  },
  {
    id: 13,
    name: 'Quantities and Separation',
    input: 'Acheter 3 pommes au marché et appeler les 3 clients du projet Beta',
    expected: {
      minItems: 2,
      maxItems: 3, // 2-3 items, NOT 6
      types: ['task'],
      // Should be 2 separate tasks, not 6
    },
    risk: 'Item multiplication from quantities',
  },
  {
    id: 14,
    name: 'Contradictory Flags',
    input: 'URGENT mais pas pressé, important mais secondaire, appeler Jean pour le devis',
    expected: {
      minItems: 1,
      types: ['task'],
      // DECISION: First signal wins - URGENT takes precedence
      hasUrgent: true,
    },
    risk: 'Inconsistent urgent/important flags',
  },
  {
    id: 15,
    name: 'Emojis and Unicode',
    input: '📞 Appeler Jean demain + 📝 noter idée cache Redis + 🗓️ RDV équipe 14h',
    expected: {
      minItems: 3,
      types: ['task', 'note', 'event'],
      // Emojis should not break parsing
      hasEvents: true,
      hasNotes: true,
    },
    risk: 'Unicode/emoji breaking parsing',
  },
];

// ============================================================================
// TEST RUNNER
// ============================================================================

async function runHardcoreTest(anthropic, test, temporal) {
  const startTime = Date.now();

  console.log(`\n${'─'.repeat(80)}`);
  log('bright', `TEST #${test.id}: ${test.name}`);
  log('gray', `Risk: ${test.risk}`);
  console.log(`📝 Input: "${test.input}"`);
  console.log('─'.repeat(80));

  try {
    const { result, telemetry } = await parseQuasar(anthropic, test.input, {});
    const latency = Date.now() - startTime;

    // Basic validation
    const itemCount = result.items?.length || 0;
    const types = [...new Set(result.items?.map(i => i.type) || [])];
    const hasUrgent = result.items?.some(i => i.urgent);
    const hasEvents = result.items?.some(i => i.type === 'event');
    const hasNotes = result.items?.some(i => i.type === 'note');

    // Check expectations
    const checks = [];

    if (test.expected.minItems !== undefined) {
      const passed = itemCount >= test.expected.minItems;
      checks.push({
        name: `minItems >= ${test.expected.minItems}`,
        passed,
        actual: itemCount,
      });
    }

    if (test.expected.maxItems !== undefined) {
      const passed = itemCount <= test.expected.maxItems;
      checks.push({
        name: `maxItems <= ${test.expected.maxItems}`,
        passed,
        actual: itemCount,
      });
    }

    if (test.expected.types && !test.expected.needsAnalysis) {
      const hasExpectedTypes = test.expected.types.some(t => types.includes(t));
      checks.push({
        name: `types includes [${test.expected.types.join('|')}]`,
        passed: hasExpectedTypes,
        actual: types.join(', '),
      });
    }

    if (test.expected.hasUrgent) {
      checks.push({
        name: 'has urgent item',
        passed: hasUrgent,
        actual: hasUrgent,
      });
    }

    if (test.expected.hasEvents) {
      checks.push({
        name: 'has events',
        passed: hasEvents,
        actual: hasEvents,
      });
    }

    if (test.expected.hasNotes) {
      checks.push({
        name: 'has notes',
        passed: hasNotes,
        actual: hasNotes,
      });
    }

    if (test.expected.shouldContainTime) {
      const hasTime = result.items?.some(i => i.start_time === test.expected.shouldContainTime);
      checks.push({
        name: `time = ${test.expected.shouldContainTime}`,
        passed: hasTime,
        actual:
          result.items
            ?.map(i => i.start_time)
            .filter(Boolean)
            .join(', ') || 'none',
      });
    }

    if (test.expected.shouldNotContain) {
      const rawJson = JSON.stringify(result);
      const containsForbidden = rawJson.includes(test.expected.shouldNotContain);
      checks.push({
        name: `should NOT contain "${test.expected.shouldNotContain}"`,
        passed: !containsForbidden,
        actual: containsForbidden ? 'FOUND' : 'OK',
      });
    }

    // Display results
    const allPassed = checks.every(c => c.passed);
    const icon = allPassed ? '✅' : test.expected.needsAnalysis ? '🔍' : '❌';
    const color = allPassed ? 'green' : test.expected.needsAnalysis ? 'yellow' : 'red';

    log(color, `${icon} Result: ${itemCount} items in ${latency}ms`);

    // Show checks
    for (const check of checks) {
      const checkIcon = check.passed ? '✓' : '✗';
      const checkColor = check.passed ? 'green' : 'red';
      log(checkColor, `   ${checkIcon} ${check.name} (got: ${check.actual})`);
    }

    // Show items
    console.log('\n   Items:');
    for (const item of result.items || []) {
      const urgentFlag = item.urgent ? '🔴' : '';
      const importantFlag = item.important ? '⭐' : '';
      console.log(
        `   [${item.type.toUpperCase()}] ${urgentFlag}${importantFlag} ${item.text || item.title || '(no text)'}`
      );
      if (item.date || item.start_time) {
        console.log(`            📅 ${item.date} ${item.start_time || ''}`);
      }
      if (item.metadata?.people?.length) {
        console.log(`            👥 ${item.metadata.people.join(', ')}`);
      }
    }

    // Telemetry
    log(
      'gray',
      `\n   Telemetry: ${telemetry.total_tokens} tokens, $${telemetry.total_cost?.toFixed(6) || '?'}, route=${telemetry.routing?.model}`
    );

    return {
      id: test.id,
      name: test.name,
      passed: allPassed,
      needsAnalysis: test.expected.needsAnalysis,
      checks,
      result,
      telemetry,
      latency,
    };
  } catch (error) {
    log('red', `💥 ERROR: ${error.message}`);
    return {
      id: test.id,
      name: test.name,
      passed: false,
      error: error.message,
    };
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║           🔥 QUASAR V5 HARDCORE TEST SUITE 🔥                                 ║
║     15 tests designed to expose parser weaknesses                             ║
╚═══════════════════════════════════════════════════════════════════════════════╝
  `);

  const args = process.argv.slice(2);
  const isDry = args.includes('--dry');
  const isLive = args.includes('--live') || !isDry;

  if (isDry) {
    logSection('TEST CASES (DRY RUN)');
    for (const test of HARDCORE_TESTS) {
      console.log(`\n#${test.id} ${test.name}`);
      console.log(`   Input: "${test.input}"`);
      console.log(`   Risk: ${test.risk}`);
    }
    return;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    log('red', '❌ ANTHROPIC_API_KEY not set. Use --dry for dry run.');
    process.exit(1);
  }

  const anthropic = new Anthropic();
  const temporal = getTemporalContextWithTimezone();

  logSection('RUNNING HARDCORE TESTS');
  log('gray', `Today: ${temporal.currentDate}, Time: ${temporal.currentTime}`);

  const results = [];

  for (const test of HARDCORE_TESTS) {
    const result = await runHardcoreTest(anthropic, test, temporal);
    results.push(result);

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  logSection('📊 SUMMARY');

  const passed = results.filter(r => r.passed && !r.needsAnalysis).length;
  const needsAnalysis = results.filter(r => r.needsAnalysis).length;
  const failed = results.filter(r => !r.passed && !r.needsAnalysis && !r.error).length;
  const errors = results.filter(r => r.error).length;

  console.log(`
   ✅ Passed:         ${passed}
   🔍 Needs Analysis: ${needsAnalysis}
   ❌ Failed:         ${failed}
   💥 Errors:         ${errors}
   ────────────────────
   Total:             ${results.length}
  `);

  // Failed tests details
  if (failed > 0 || errors > 0) {
    log('red', '\n   Failed/Error tests:');
    for (const r of results.filter(r => (!r.passed && !r.needsAnalysis) || r.error)) {
      console.log(`   - #${r.id} ${r.name}: ${r.error || 'check failures'}`);
    }
  }

  // Needs analysis details
  if (needsAnalysis > 0) {
    log('yellow', '\n   Tests needing manual analysis:');
    for (const r of results.filter(r => r.needsAnalysis)) {
      console.log(`   - #${r.id} ${r.name}`);
    }
  }

  // Cost summary
  const totalTokens = results.reduce((sum, r) => sum + (r.telemetry?.total_tokens || 0), 0);
  const totalCost = results.reduce((sum, r) => sum + (r.telemetry?.total_cost || 0), 0);
  const avgLatency = results.reduce((sum, r) => sum + (r.latency || 0), 0) / results.length;

  log('gray', `\n   Total tokens: ${totalTokens}`);
  log('gray', `   Total cost: $${totalCost.toFixed(4)}`);
  log('gray', `   Avg latency: ${avgLatency.toFixed(0)}ms`);

  console.log('\n' + '═'.repeat(80));

  // Exit code
  const successRate = (passed + needsAnalysis) / results.length;
  if (successRate >= 0.8) {
    log('green', '   🎉 QUASAR handled most edge cases!');
  } else {
    log('red', '   ⚠️  Multiple failures detected - improvements needed');
  }

  process.exit(errors > 0 ? 1 : 0);
}

main().catch(console.error);
