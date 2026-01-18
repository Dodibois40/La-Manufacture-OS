/**
 * TEST SECOND BRAIN V3 - GALACTIC EDITION
 *
 * Benchmarks:
 * - V2 vs V3 comparison (tokens, latency, accuracy)
 * - Single-call vs Pipeline mode
 * - Prompt caching effectiveness
 * - JSON stability (no more undefined)
 *
 * Usage:
 *   node tests/test-parser-v3.js              # V3 standard
 *   node tests/test-parser-v3.js --pipeline   # V3 2-stage pipeline
 *   node tests/test-parser-v3.js --compare    # V2 vs V3 comparison
 *   node tests/test-parser-v3.js --cache      # Test prompt caching
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import buildSecondBrainPromptV3, {
  buildAnthropicMessages,
  executePipeline,
} from '../src/prompts/second-brain-v3.js';
import buildSecondBrainPromptV2 from '../src/prompts/second-brain-v2.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================================
// TEST CASES
// ============================================================================

const TEST_CASES = [
  ['Pattern hebdomadaire', 'Tous les lundis standup équipe 9h'],
  ['Chaîne de tâches', 'Envoyer le devis à Dupont pour le projet web'],
  ['RDV client (prep)', 'RDV client Martin jeudi 14h présentation produit'],
  [
    'Texte dicté complexe',
    "demain call avec Paul projet Alpha et après envoyer le rapport et j'ai une idée pour le cache",
  ],
  [
    'Multi-items urgent',
    'URGENT appeler le client Durand + relancer devis Martin + note: budget validé 50k',
  ],
];

// ============================================================================
// V3 STANDARD TEST
// ============================================================================

async function testV3Standard(testName, inputText, context = {}) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🚀 V3 | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const promptData = buildSecondBrainPromptV3(inputText, context);
  const config = buildAnthropicMessages(promptData, { useCache: false });

  const startTime = Date.now();
  const response = await anthropic.messages.create(config);
  const latency = Date.now() - startTime;

  const tokens = response.usage.input_tokens + response.usage.output_tokens;
  const cacheRead = response.usage.cache_read_input_tokens || 0;
  const cacheCreated = response.usage.cache_creation_input_tokens || 0;

  let result;
  let hasUndefined = false;
  try {
    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    result = JSON.parse(jsonMatch[0]);

    // Check for undefined values
    const jsonStr = JSON.stringify(result);
    hasUndefined = jsonStr.includes('undefined') || jsonStr.includes('"undefined"');
  } catch (e) {
    console.log(`❌ JSON Parse Error: ${e.message}`);
    return { success: false };
  }

  const items = result.items || [];
  const suggestions = result.suggestions || [];

  console.log(
    `✅ ${items.length} items | ${suggestions.length} suggestions | ${latency}ms | ${tokens} tokens`
  );
  if (hasUndefined) console.log(`⚠️ UNDEFINED DETECTED IN OUTPUT`);
  if (cacheRead > 0) console.log(`📦 Cache read: ${cacheRead} tokens`);

  items.forEach(item => {
    const conf = item.metadata?.confidence
      ? ` (${(item.metadata.confidence * 100).toFixed(0)}%)`
      : '';
    const hasChain = item.metadata?.predictive?.chain ? ' ⛓️' : '';
    const hasPattern = item.metadata?.predictive?.patterns?.length > 0 ? ' 🔄' : '';
    console.log(
      `   [${item.type.toUpperCase()}]${conf}${hasChain}${hasPattern} ${item.text || item.title}`
    );
  });

  if (suggestions.length > 0) {
    console.log(`   ──────────────`);
    suggestions.forEach(s => {
      console.log(`   💡 [${s.type}] ${s.task} (${(s.score * 100).toFixed(0)}%)`);
    });
  }

  return { success: true, items, suggestions, tokens, latency, hasUndefined };
}

// ============================================================================
// V3 PIPELINE TEST (HAIKU + SONNET)
// ============================================================================

async function testV3Pipeline(testName, inputText, context = {}) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🔗 V3 PIPELINE | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const startTime = Date.now();

  try {
    const { result, stats } = await executePipeline(anthropic, inputText, context);
    const latency = Date.now() - startTime;

    const items = result.items || [];
    const suggestions = result.suggestions || [];

    console.log(
      `✅ ${items.length} items | ${suggestions.length} suggestions | ${latency}ms | ${stats.total_tokens} tokens`
    );
    console.log(`   Stage 1 (Haiku): ${stats.stage1_tokens} tokens`);
    console.log(`   Stage 2 (Sonnet): ${stats.stage2_tokens} tokens`);

    items.forEach(item => {
      const conf = item.metadata?.confidence
        ? ` (${(item.metadata.confidence * 100).toFixed(0)}%)`
        : '';
      console.log(`   [${item.type.toUpperCase()}]${conf} ${item.text || item.title}`);
    });

    return { success: true, items, suggestions, tokens: stats.total_tokens, latency };
  } catch (e) {
    console.log(`❌ Pipeline Error: ${e.message}`);
    return { success: false };
  }
}

// ============================================================================
// V3 WITH CACHE TEST
// ============================================================================

async function testV3WithCache(testName, inputText, context = {}) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📦 V3 CACHE | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const promptData = buildSecondBrainPromptV3(inputText, context);
  const config = buildAnthropicMessages(promptData, { useCache: true });

  // Add beta header for prompt caching
  const startTime = Date.now();
  const response = await anthropic.messages.create({
    ...config,
    betas: ['prompt-caching-2024-07-31'],
  });
  const latency = Date.now() - startTime;

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const cacheRead = response.usage.cache_read_input_tokens || 0;
  const cacheCreated = response.usage.cache_creation_input_tokens || 0;

  let result;
  try {
    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/);
    result = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.log(`❌ JSON Parse Error`);
    return { success: false };
  }

  const items = result.items || [];
  const suggestions = result.suggestions || [];

  console.log(`✅ ${items.length} items | ${suggestions.length} suggestions | ${latency}ms`);
  console.log(`   Input tokens: ${inputTokens} | Output: ${outputTokens}`);
  console.log(`   Cache read: ${cacheRead} | Cache created: ${cacheCreated}`);

  const cacheHitRate = cacheRead > 0 ? ((cacheRead / inputTokens) * 100).toFixed(1) : 0;
  console.log(`   Cache hit rate: ${cacheHitRate}%`);

  return {
    success: true,
    items,
    suggestions,
    tokens: inputTokens + outputTokens,
    latency,
    cacheRead,
    cacheCreated,
  };
}

// ============================================================================
// V2 vs V3 COMPARISON
// ============================================================================

async function compareV2V3(testName, inputText, context = {}) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`⚔️ V2 vs V3 | ${testName}`);
  console.log(`📝 "${inputText}"`);
  console.log('─'.repeat(70));

  // V2 Test
  console.log('\n🔵 V2:');
  const v2Prompt = buildSecondBrainPromptV2(inputText, context);
  const v2Start = Date.now();
  const v2Response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 3000,
    system: v2Prompt.systemPrompt,
    messages: [{ role: 'user', content: v2Prompt.userPrompt }],
  });
  const v2Latency = Date.now() - v2Start;
  const v2Tokens = v2Response.usage.input_tokens + v2Response.usage.output_tokens;

  let v2Result,
    v2HasUndefined = false;
  try {
    const jsonMatch = v2Response.content[0].text.match(/\{[\s\S]*\}/);
    v2Result = JSON.parse(jsonMatch[0]);
    v2HasUndefined = JSON.stringify(v2Result).includes('undefined');
  } catch {
    v2Result = { items: [], proactive_suggestions: [] };
  }

  console.log(
    `   Items: ${v2Result.items?.length || 0} | Suggestions: ${v2Result.proactive_suggestions?.length || 0}`
  );
  console.log(`   Tokens: ${v2Tokens} | Latency: ${v2Latency}ms`);
  if (v2HasUndefined) console.log(`   ⚠️ HAS UNDEFINED`);

  // V3 Test
  console.log('\n🟣 V3:');
  const v3Prompt = buildSecondBrainPromptV3(inputText, context);
  const v3Config = buildAnthropicMessages(v3Prompt, { useCache: false });
  const v3Start = Date.now();
  const v3Response = await anthropic.messages.create(v3Config);
  const v3Latency = Date.now() - v3Start;
  const v3Tokens = v3Response.usage.input_tokens + v3Response.usage.output_tokens;

  let v3Result,
    v3HasUndefined = false;
  try {
    const jsonMatch = v3Response.content[0].text.match(/\{[\s\S]*\}/);
    v3Result = JSON.parse(jsonMatch[0]);
    v3HasUndefined = JSON.stringify(v3Result).includes('undefined');
  } catch {
    v3Result = { items: [], suggestions: [] };
  }

  console.log(
    `   Items: ${v3Result.items?.length || 0} | Suggestions: ${v3Result.suggestions?.length || 0}`
  );
  console.log(`   Tokens: ${v3Tokens} | Latency: ${v3Latency}ms`);
  if (v3HasUndefined) console.log(`   ⚠️ HAS UNDEFINED`);

  // Comparison
  console.log('\n📊 COMPARAISON:');
  const tokensSaved = v2Tokens - v3Tokens;
  const tokensSavedPct = ((tokensSaved / v2Tokens) * 100).toFixed(1);
  const latencyDiff = v2Latency - v3Latency;

  console.log(
    `   Tokens: ${tokensSaved > 0 ? '✅' : '❌'} ${tokensSaved} tokens saved (${tokensSavedPct}%)`
  );
  console.log(
    `   Latency: ${latencyDiff > 0 ? '✅' : '❌'} ${latencyDiff}ms ${latencyDiff > 0 ? 'faster' : 'slower'}`
  );
  console.log(
    `   Undefined: V2=${v2HasUndefined ? '⚠️' : '✅'} V3=${v3HasUndefined ? '⚠️' : '✅'}`
  );

  return {
    v2: {
      tokens: v2Tokens,
      latency: v2Latency,
      hasUndefined: v2HasUndefined,
      items: v2Result.items?.length || 0,
    },
    v3: {
      tokens: v3Tokens,
      latency: v3Latency,
      hasUndefined: v3HasUndefined,
      items: v3Result.items?.length || 0,
    },
    tokensSaved,
    tokensSavedPct: parseFloat(tokensSavedPct),
  };
}

// ============================================================================
// RUN TESTS
// ============================================================================

async function runStandardTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🚀 SECOND BRAIN V3 - GALACTIC EDITION                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  let totalTokens = 0;
  let totalLatency = 0;
  let passed = 0;
  let undefinedCount = 0;

  for (const [name, input] of TEST_CASES) {
    const result = await testV3Standard(name, input);
    if (result.success) {
      passed++;
      totalTokens += result.tokens;
      totalLatency += result.latency;
      if (result.hasUndefined) undefinedCount++;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🚀 V3 RÉSULTATS:');
  console.log(`   ✅ ${passed}/${TEST_CASES.length} tests`);
  console.log(`   🪙 ${totalTokens} tokens total (${(totalTokens / passed).toFixed(0)}/test)`);
  console.log(
    `   ⏱️ ${(totalLatency / 1000).toFixed(1)}s total (${(totalLatency / passed / 1000).toFixed(1)}s/test)`
  );
  console.log(`   🐛 ${undefinedCount} tests with undefined`);
  console.log('═'.repeat(70));
}

async function runPipelineTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🔗 V3 PIPELINE MODE (HAIKU + SONNET)                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  let totalTokens = 0;
  let totalLatency = 0;
  let passed = 0;

  for (const [name, input] of TEST_CASES) {
    const result = await testV3Pipeline(name, input);
    if (result.success) {
      passed++;
      totalTokens += result.tokens;
      totalLatency += result.latency;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🔗 PIPELINE RÉSULTATS:');
  console.log(`   ✅ ${passed}/${TEST_CASES.length} tests`);
  console.log(`   🪙 ${totalTokens} tokens total (${(totalTokens / passed).toFixed(0)}/test)`);
  console.log(
    `   ⏱️ ${(totalLatency / 1000).toFixed(1)}s total (${(totalLatency / passed / 1000).toFixed(1)}s/test)`
  );
  console.log('═'.repeat(70));
}

async function runComparisonTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     ⚔️ V2 vs V3 BENCHMARK                                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const results = [];

  for (const [name, input] of TEST_CASES) {
    const result = await compareV2V3(name, input);
    results.push(result);
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  const avgTokensSaved = results.reduce((sum, r) => sum + r.tokensSaved, 0) / results.length;
  const avgTokensSavedPct = results.reduce((sum, r) => sum + r.tokensSavedPct, 0) / results.length;
  const v2Undefined = results.filter(r => r.v2.hasUndefined).length;
  const v3Undefined = results.filter(r => r.v3.hasUndefined).length;

  console.log('\n' + '═'.repeat(70));
  console.log('📊 BENCHMARK SUMMARY:');
  console.log(
    `   Tokens saved: ${avgTokensSaved.toFixed(0)} avg (${avgTokensSavedPct.toFixed(1)}%)`
  );
  console.log(`   V2 undefined: ${v2Undefined}/${results.length}`);
  console.log(`   V3 undefined: ${v3Undefined}/${results.length}`);
  console.log('═'.repeat(70));
}

async function runCacheTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     📦 V3 PROMPT CACHING TEST                                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  console.log('\n🔄 Running 3 sequential calls to test cache hit rate...\n');

  for (let i = 0; i < 3; i++) {
    console.log(`\n--- CALL ${i + 1} ---`);
    await testV3WithCache(`Cache test #${i + 1}`, TEST_CASES[0][1]);
    await new Promise(r => setTimeout(r, 500));
  }
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--pipeline')) {
  runPipelineTests().catch(console.error);
} else if (args.includes('--compare')) {
  runComparisonTests().catch(console.error);
} else if (args.includes('--cache')) {
  runCacheTests().catch(console.error);
} else {
  runStandardTests().catch(console.error);
}
