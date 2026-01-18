/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║           ⚡ QUASAR V5 TEST SUITE ⚡                                          ║
 * ║     Testing: Routing • Caching • 2-Stage Pipeline • Cost Optimization        ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node tests/test-parser-v5-quasar.js              # All tests
 *   node tests/test-parser-v5-quasar.js --routing    # Routing tests only
 *   node tests/test-parser-v5-quasar.js --cache      # Cache tests only
 *   node tests/test-parser-v5-quasar.js --pipeline   # 2-stage pipeline tests
 *   node tests/test-parser-v5-quasar.js --batch      # Batch processing tests
 *   node tests/test-parser-v5-quasar.js --cost       # Cost estimation tests
 *   node tests/test-parser-v5-quasar.js --live       # Live API tests (requires ANTHROPIC_API_KEY)
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import quasar, {
  routeToModel,
  buildCacheablePrompt,
  buildDynamicPrompt,
  compressContext,
  getTemporalContextWithTimezone,
  estimateCost,
  detectLanguage,
  parseQuasar,
  parseQuasarBatch,
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
};

function log(color, ...args) {
  console.log(`${colors[color]}${args.join(' ')}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '═'.repeat(70));
  log('cyan', `  ${title}`);
  console.log('═'.repeat(70));
}

function logTest(name, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  const color = passed ? 'green' : 'red';
  log(color, `${icon} ${name}`);
  if (details) {
    console.log(`   ${colors.yellow}→ ${details}${colors.reset}`);
  }
}

function assert(condition, testName, details = '') {
  logTest(testName, condition, details);
  return condition;
}

// ============================================================================
// ROUTING TESTS
// ============================================================================

function testRouting() {
  logSection('🎯 SMART ROUTING TESTS');
  let passed = 0;
  let total = 0;

  // Test 1: Simple input -> Haiku
  total++;
  const simple = routeToModel('Acheter du pain');
  if (
    assert(
      simple.model === 'fast' && simple.complexity < 3,
      'Simple input routes to Haiku',
      `model=${simple.model}, complexity=${simple.complexity}`
    )
  )
    passed++;

  // Test 2: Long input -> Higher complexity
  total++;
  const long = routeToModel(
    "Organiser la réunion de planification trimestrielle avec l'équipe marketing pour discuter des objectifs Q2"
  );
  if (
    assert(
      long.complexity >= 1,
      'Long input increases complexity',
      `complexity=${long.complexity}, reasons=${long.reasons.join(', ')}`
    )
  )
    passed++;

  // Test 3: Complex keywords trigger Sonnet
  total++;
  const urgent = routeToModel('URGENT: Meeting avec le client pour deadline projet Alpha');
  if (
    assert(
      urgent.model === 'smart' && urgent.reasons.includes('complex_keywords'),
      'Complex keywords route to Sonnet',
      `model=${urgent.model}, reasons=${urgent.reasons.join(', ')}`
    )
  )
    passed++;

  // Test 4: Multiple items detected
  total++;
  const multi = routeToModel('Appeler Jean et envoyer email à Marie');
  if (
    assert(
      multi.reasons.includes('multi_items'),
      'Multiple items detected',
      `reasons=${multi.reasons.join(', ')}`
    )
  )
    passed++;

  // Test 5: Time detection
  total++;
  const withTime = routeToModel('RDV 14h30');
  if (
    assert(
      withTime.reasons.includes('has_time'),
      'Time pattern detected',
      `reasons=${withTime.reasons.join(', ')}`
    )
  )
    passed++;

  // Test 6: Context increases complexity
  total++;
  const withContext = routeToModel('Appeler Martin', {
    userProfile: { profession: 'consultant' },
    memoryContext: {
      corrections_history: [{ original_value: 'Martin', corrected_value: 'Martin Dupont' }],
    },
  });
  if (
    assert(
      withContext.complexity > routeToModel('Appeler Martin').complexity,
      'User context increases complexity',
      `without=${routeToModel('Appeler Martin').complexity}, with=${withContext.complexity}`
    )
  )
    passed++;

  // Test 7: Enrichment threshold
  total++;
  const complex = routeToModel('URGENT client meeting deadline presentation important', {
    userProfile: { profession: 'sales' },
  });
  if (
    assert(
      complex.useEnrichment === true,
      'High complexity enables enrichment',
      `complexity=${complex.complexity}, useEnrichment=${complex.useEnrichment}`
    )
  )
    passed++;

  log('bright', `\n📊 Routing: ${passed}/${total} tests passed`);
  return { passed, total };
}

// ============================================================================
// CACHE STRUCTURE TESTS
// ============================================================================

function testCacheStructure() {
  logSection('💾 CACHE STRUCTURE TESTS');
  let passed = 0;
  let total = 0;

  // Test 1: Static prompt exists and is substantial
  total++;
  const { static: staticPrompt, staticTokens } = buildCacheablePrompt('fr');
  if (
    assert(
      staticPrompt.length > 1000 && staticTokens > 200,
      'Static prompt is cacheable size',
      `length=${staticPrompt.length} chars, ~${staticTokens} tokens`
    )
  )
    passed++;

  // Test 2: Static prompt contains schema
  total++;
  if (
    assert(
      staticPrompt.includes('OUTPUT SCHEMA') && staticPrompt.includes('typescript'),
      'Static prompt contains JSON schema'
    )
  )
    passed++;

  // Test 3: Static prompt contains examples
  total++;
  if (
    assert(
      staticPrompt.includes('<example') && staticPrompt.includes('</example>'),
      'Static prompt contains few-shot examples'
    )
  )
    passed++;

  // Test 4: Dynamic prompt is small
  total++;
  const temporal = getTemporalContextWithTimezone();
  const { dynamic, dynamicTokens } = buildDynamicPrompt(temporal, 'fr', {});
  if (
    assert(
      dynamicTokens < staticTokens * 0.3,
      'Dynamic prompt is < 30% of static',
      `static=${staticTokens}, dynamic=${dynamicTokens} (${Math.round((dynamicTokens / staticTokens) * 100)}%)`
    )
  )
    passed++;

  // Test 5: Dynamic prompt contains dates
  total++;
  if (
    assert(
      dynamic.includes('TODAY =') && dynamic.includes('TOMORROW ='),
      'Dynamic prompt contains temporal context'
    )
  )
    passed++;

  // Test 6: Dynamic includes user profile when provided
  total++;
  const { dynamic: dynamicWithProfile } = buildDynamicPrompt(temporal, 'fr', {
    userProfile: { profession: 'developer', domain: 'tech' },
  });
  if (
    assert(
      dynamicWithProfile.includes('Profession: developer'),
      'Dynamic prompt includes user profile'
    )
  )
    passed++;

  // Test 7: Dynamic includes corrections history
  total++;
  const { dynamic: dynamicWithCorrections } = buildDynamicPrompt(temporal, 'fr', {
    memoryContext: {
      corrections_history: [{ original_value: 'rdv', corrected_value: 'rendez-vous' }],
    },
  });
  if (
    assert(
      dynamicWithCorrections.includes('LEARNED CORRECTIONS'),
      'Dynamic prompt includes corrections'
    )
  )
    passed++;

  // Test 8: Cache ratio is optimal
  total++;
  const cacheRatio = staticTokens / (staticTokens + dynamicTokens);
  if (assert(cacheRatio >= 0.7, 'Cache ratio >= 70%', `${Math.round(cacheRatio * 100)}% cacheable`))
    passed++;

  log('bright', `\n📊 Cache Structure: ${passed}/${total} tests passed`);
  return { passed, total };
}

// ============================================================================
// CONTEXT COMPRESSION TESTS
// ============================================================================

function testContextCompression() {
  logSection('🗜️ CONTEXT COMPRESSION TESTS');
  let passed = 0;
  let total = 0;

  // Create test history
  const history = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    text: `Task ${i}`,
    date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    urgent: i % 5 === 0,
    important: i % 3 === 0,
  }));

  // Test 1: Small history unchanged
  total++;
  const small = compressContext(history.slice(0, 5));
  if (
    assert(
      Array.isArray(small) && small.length === 5,
      'Small history unchanged',
      `kept ${small.length} items`
    )
  )
    passed++;

  // Test 2: Large history compressed
  total++;
  const compressed = compressContext(history, 10);
  if (
    assert(
      compressed.items && compressed.items.length === 10,
      'Large history compressed to max',
      `${history.length} → ${compressed.items.length} items`
    )
  )
    passed++;

  // Test 3: Urgent items prioritized
  total++;
  const urgentCount = compressed.items.filter(i => i.urgent).length;
  const originalUrgentCount = history.filter(i => i.urgent).length;
  if (
    assert(
      urgentCount >= Math.min(originalUrgentCount, 10),
      'Urgent items prioritized',
      `${urgentCount}/${originalUrgentCount} urgent items kept`
    )
  )
    passed++;

  // Test 4: Summary included
  total++;
  if (
    assert(
      compressed.summary && compressed.summary.includes('compressed'),
      'Compression summary included',
      compressed.summary
    )
  )
    passed++;

  log('bright', `\n📊 Context Compression: ${passed}/${total} tests passed`);
  return { passed, total };
}

// ============================================================================
// TIMEZONE TESTS
// ============================================================================

function testTimezone() {
  logSection('🌍 TIMEZONE TESTS');
  let passed = 0;
  let total = 0;

  // Test 1: Paris timezone
  total++;
  const paris = getTemporalContextWithTimezone('Europe/Paris');
  if (
    assert(
      paris.timezone === 'Europe/Paris' && /\d{4}-\d{2}-\d{2}/.test(paris.currentDate),
      'Paris timezone works',
      `date=${paris.currentDate}, time=${paris.currentTime}`
    )
  )
    passed++;

  // Test 2: New York timezone
  total++;
  const ny = getTemporalContextWithTimezone('America/New_York');
  if (
    assert(
      ny.timezone === 'America/New_York' && /\d{2}:\d{2}/.test(ny.currentTime),
      'New York timezone works',
      `date=${ny.currentDate}, time=${ny.currentTime}`
    )
  )
    passed++;

  // Test 3: Week days in multiple languages
  total++;
  const hasAllLangs =
    paris.weekDays.fr && paris.weekDays.en && paris.weekDays.es && paris.weekDays.de;
  if (
    assert(
      hasAllLangs,
      'Week days available in all languages',
      `FR: ${Object.keys(paris.weekDays.fr).length} days`
    )
  )
    passed++;

  // Test 4: ISO string included
  total++;
  if (assert(paris.iso && paris.iso.includes('T'), 'ISO timestamp included', paris.iso)) passed++;

  // Test 5: Tomorrow is actually tomorrow
  total++;
  const today = new Date(paris.currentDate);
  const tomorrow = new Date(paris.tomorrowDate);
  const dayDiff = (tomorrow - today) / (24 * 60 * 60 * 1000);
  if (
    assert(
      dayDiff === 1,
      'Tomorrow is exactly +1 day',
      `today=${paris.currentDate}, tomorrow=${paris.tomorrowDate}`
    )
  )
    passed++;

  log('bright', `\n📊 Timezone: ${passed}/${total} tests passed`);
  return { passed, total };
}

// ============================================================================
// COST ESTIMATION TESTS
// ============================================================================

function testCostEstimation() {
  logSection('💰 COST ESTIMATION TESTS');
  let passed = 0;
  let total = 0;

  // Test 1: Simple input = cheap
  total++;
  const simpleCost = estimateCost('Acheter pain');
  if (
    assert(
      simpleCost.model === 'haiku' && simpleCost.estimated_cost < 0.001,
      'Simple input = Haiku (cheap)',
      `model=${simpleCost.model}, cost=$${simpleCost.estimated_cost.toFixed(6)}`
    )
  )
    passed++;

  // Test 2: Complex input = 2-stage
  total++;
  const complexCost = estimateCost('URGENT meeting client deadline presentation important');
  if (
    assert(
      complexCost.model === '2-stage',
      'Complex input = 2-stage pipeline',
      `model=${complexCost.model}, cost=$${complexCost.estimated_cost.toFixed(6)}`
    )
  )
    passed++;

  // Test 3: Cache potential reported
  total++;
  if (
    assert(
      complexCost.cache_potential && complexCost.cache_potential > 400,
      'Cache potential calculated',
      `${complexCost.cache_potential} tokens cacheable`
    )
  )
    passed++;

  // Test 4: Complex costs more than simple
  total++;
  if (
    assert(
      complexCost.estimated_cost > simpleCost.estimated_cost,
      'Complex costs more than simple',
      `simple=$${simpleCost.estimated_cost.toFixed(6)}, complex=$${complexCost.estimated_cost.toFixed(6)}`
    )
  )
    passed++;

  // Test 5: Token estimates reasonable
  total++;
  if (
    assert(
      simpleCost.estimated_tokens > 100 && simpleCost.estimated_tokens < 5000,
      'Token estimates reasonable',
      `estimated ${simpleCost.estimated_tokens} tokens`
    )
  )
    passed++;

  log('bright', `\n📊 Cost Estimation: ${passed}/${total} tests passed`);
  return { passed, total };
}

// ============================================================================
// LIVE API TESTS (optional)
// ============================================================================

async function testLiveAPI() {
  logSection('🔥 LIVE API TESTS');

  if (!process.env.ANTHROPIC_API_KEY) {
    log('yellow', '⚠️  ANTHROPIC_API_KEY not set, skipping live tests');
    return { passed: 0, total: 0, skipped: true };
  }

  const anthropic = new Anthropic();
  let passed = 0;
  let total = 0;

  // Test 1: Simple parse (Haiku only)
  total++;
  try {
    const start = Date.now();
    const { result, telemetry } = await parseQuasar(anthropic, 'Acheter du pain demain');
    const latency = Date.now() - start;

    if (
      assert(
        result.items.length > 0 && telemetry.routing.model === 'fast',
        'Simple parse uses Haiku only',
        `${latency}ms, ${telemetry.total_tokens} tokens, $${telemetry.total_cost.toFixed(6)}`
      )
    )
      passed++;

    console.log('   Result:', JSON.stringify(result.items[0], null, 2).substring(0, 200) + '...');
  } catch (e) {
    logTest('Simple parse uses Haiku only', false, e.message);
  }

  // Test 2: Complex parse (2-stage)
  total++;
  try {
    const start = Date.now();
    const { result, telemetry } = await parseQuasar(
      anthropic,
      'URGENT: RDV client Martin jeudi 14h pour présentation projet Alpha deadline vendredi',
      { userProfile: { profession: 'consultant' } }
    );
    const latency = Date.now() - start;

    if (
      assert(
        result.items.length > 0 && telemetry.stages.length === 2,
        'Complex parse uses 2-stage pipeline',
        `${latency}ms, stages=${telemetry.stages.map(s => s.name).join(' → ')}`
      )
    )
      passed++;

    // Check for predictions/suggestions
    const hasPredictions = result.items.some(i => i.metadata?.predictive?.chain);
    const hasSuggestions = result.suggestions?.length > 0;
    console.log(
      `   Predictions: ${hasPredictions ? '✅' : '❌'}, Suggestions: ${hasSuggestions ? '✅' : '❌'}`
    );
  } catch (e) {
    logTest('Complex parse uses 2-stage pipeline', false, e.message);
  }

  // Test 3: Batch processing
  total++;
  try {
    const inputs = ['Appeler Jean', 'Meeting 15h', 'URGENT envoyer rapport'];

    const start = Date.now();
    const { results, batchTelemetry } = await parseQuasarBatch(anthropic, inputs);
    const latency = Date.now() - start;

    if (
      assert(
        results.length === 3 && batchTelemetry.batch_size === 3,
        'Batch processing works',
        `${latency}ms total, ${batchTelemetry.avg_latency.toFixed(0)}ms avg, ${batchTelemetry.total_tokens} tokens`
      )
    )
      passed++;
  } catch (e) {
    logTest('Batch processing works', false, e.message);
  }

  // Test 4: Cache hit on repeated request
  total++;
  try {
    // First request
    await parseQuasar(anthropic, 'Test cache request urgent important', {});

    // Second request (should hit cache)
    const { telemetry } = await parseQuasar(anthropic, 'Test cache request 2 urgent important', {});

    const cacheStage = telemetry.stages.find(s => s.name === 'stage2_sonnet');
    if (
      assert(
        cacheStage?.cache_hit === true,
        'Cache hit on repeated system prompt',
        `cache_read_tokens=${cacheStage?.cache_read_tokens || 0}`
      )
    )
      passed++;
  } catch (e) {
    logTest('Cache hit on repeated system prompt', false, e.message);
  }

  // Test 5: Multi-language
  total++;
  try {
    const tests = [
      { text: 'Meeting tomorrow at 3pm', expected: 'en' },
      { text: 'Termin morgen um 15 Uhr', expected: 'de' },
      { text: 'Reunión mañana a las 3', expected: 'es' },
    ];

    let langPassed = 0;
    for (const t of tests) {
      const { result } = await parseQuasar(anthropic, t.text);
      if (result.meta.detected_lang === t.expected) langPassed++;
    }

    if (
      assert(
        langPassed === tests.length,
        'Multi-language detection in live API',
        `${langPassed}/${tests.length} languages correct`
      )
    )
      passed++;
  } catch (e) {
    logTest('Multi-language detection in live API', false, e.message);
  }

  log('bright', `\n📊 Live API: ${passed}/${total} tests passed`);
  return { passed, total };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║           ⚡ QUASAR V5 TEST SUITE ⚡                                          ║
║     2-Stage Pipeline • Smart Routing • Cost Optimization                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝
  `);

  const args = process.argv.slice(2);
  const results = [];

  // Determine which tests to run
  const runAll = args.length === 0;
  const runRouting = runAll || args.includes('--routing');
  const runCache = runAll || args.includes('--cache');
  const runCompression = runAll || args.includes('--compression');
  const runTimezone = runAll || args.includes('--timezone');
  const runCost = runAll || args.includes('--cost');
  const runLive = args.includes('--live');
  const runPipeline = args.includes('--pipeline');
  const runBatch = args.includes('--batch');

  // Run selected tests
  if (runRouting) results.push(testRouting());
  if (runCache) results.push(testCacheStructure());
  if (runCompression) results.push(testContextCompression());
  if (runTimezone) results.push(testTimezone());
  if (runCost) results.push(testCostEstimation());

  // Live tests need API key
  if (runLive || runPipeline || runBatch) {
    results.push(await testLiveAPI());
  }

  // Summary
  logSection('📊 FINAL SUMMARY');

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalTests = results.reduce((sum, r) => sum + r.total, 0);
  const skipped = results.filter(r => r.skipped).length;

  const percentage = totalTests > 0 ? Math.round((totalPassed / totalTests) * 100) : 0;

  console.log(`
  Total Tests:  ${totalTests}
  Passed:       ${totalPassed}
  Failed:       ${totalTests - totalPassed}
  ${skipped > 0 ? `Skipped:      ${skipped} (need ANTHROPIC_API_KEY)` : ''}

  Success Rate: ${percentage}%
  `);

  if (percentage === 100) {
    log('green', '  🎉 ALL TESTS PASSED - QUASAR IS READY!');
  } else if (percentage >= 80) {
    log('yellow', '  ⚠️  Most tests passed, review failures above');
  } else {
    log('red', '  ❌ Multiple failures, review and fix');
  }

  console.log('\n' + '═'.repeat(70));

  process.exit(totalPassed === totalTests ? 0 : 1);
}

main().catch(console.error);
