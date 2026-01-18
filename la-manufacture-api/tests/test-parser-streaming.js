/**
 * TEST STREAMING QUASAR V6
 * Validates streaming support with TTFT (Time To First Token) metrics
 *
 * Usage: node tests/test-parser-streaming.js
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import quasar from '../src/prompts/second-brain-v5-quasar.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function testStreaming(testName, input) {
  console.log('\n' + '═'.repeat(70));
  console.log(`🌊 ${testName}`);
  console.log('─'.repeat(70));
  console.log(`📝 "${input}"`);
  console.log('─'.repeat(70));

  const startTime = Date.now();
  let ttft = null;
  let partialCount = 0;
  let finalResult = null;

  try {
    for await (const chunk of quasar.parseStream(anthropic, input)) {
      switch (chunk.type) {
        case 'status':
          console.log(`   📡 Status: ${chunk.status} (${chunk.latency}ms)`);
          break;

        case 'metric':
          if (chunk.metric === 'ttft') {
            ttft = chunk.value;
            console.log(`   ⚡ TTFT: ${ttft}ms ${ttft < 500 ? '✅' : '⚠️'}`);
          }
          break;

        case 'partial':
          partialCount++;
          // Show first and every 5th partial
          if (partialCount === 1 || partialCount % 5 === 0) {
            const preview = chunk.text.substring(0, 50) + (chunk.text.length > 50 ? '...' : '');
            console.log(`   📦 Partial #${partialCount}: ${preview}`);
          }
          break;

        case 'complete':
          finalResult = chunk;
          console.log(`   ✅ Complete in ${chunk.telemetry.total_latency}ms`);
          break;
      }
    }

    if (!finalResult) {
      console.log('   ❌ No final result received');
      return { success: false, ttft: null };
    }

    const items = finalResult.result.items || [];
    console.log(`   📊 ${items.length} item(s) parsed`);
    items.forEach(item => {
      console.log(`      [${item.type.toUpperCase()}] ${item.text || item.title}`);
    });

    const totalTime = Date.now() - startTime;
    console.log(`   ⏱️  Total: ${totalTime}ms | TTFT: ${ttft}ms | Partials: ${partialCount}`);

    return {
      success: true,
      ttft,
      totalTime,
      partialCount,
      itemCount: items.length,
    };
  } catch (error) {
    console.log(`   💥 Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testWithCallback() {
  console.log('\n' + '═'.repeat(70));
  console.log('🔄 Testing parseWithStream (callback mode)');
  console.log('─'.repeat(70));

  const progressUpdates = [];
  const result = await quasar.parseWithStream(anthropic, 'Appeler Jean demain 14h', {}, chunk =>
    progressUpdates.push(chunk.type)
  );

  console.log(`   📊 Progress updates: ${progressUpdates.join(' → ')}`);
  console.log(`   ✅ Items: ${result.result.items?.length || 0}`);
  console.log(`   ⏱️  Latency: ${result.telemetry.total_latency}ms`);

  return { success: true, progressTypes: progressUpdates };
}

async function runStreamingTests() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║           🌊 QUASAR V6 STREAMING TEST SUITE 🌊                     ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  const tests = [
    ['1. Ultra-short (ultra-fast path)', 'Appeler Jean'],
    ['2. Simple task', 'Envoyer le rapport demain matin'],
    ['3. Event with time', 'RDV dentiste mardi 14h30'],
    ['4. Multi-items', 'Appeler Marie et envoyer le devis à Paul'],
    ['5. Complex input', 'URGENT rdv client Martin demain 10h bureau, préparer présentation'],
  ];

  const results = [];

  for (const [name, input] of tests) {
    const result = await testStreaming(name, input);
    results.push({ name, ...result });
    await new Promise(r => setTimeout(r, 500));
  }

  // Test callback mode
  const callbackResult = await testWithCallback();
  results.push({ name: 'Callback mode', ...callbackResult });

  // Summary
  console.log('\n' + '═'.repeat(70));
  console.log('📊 STREAMING TEST SUMMARY');
  console.log('═'.repeat(70));

  const successful = results.filter(r => r.success).length;
  const avgTtft =
    results.filter(r => r.ttft).reduce((a, r) => a + r.ttft, 0) /
      results.filter(r => r.ttft).length || 0;
  const ttftUnder500 = results.filter(r => r.ttft && r.ttft < 500).length;

  console.log(`   Tests passed: ${successful}/${results.length}`);
  console.log(`   Average TTFT: ${avgTtft.toFixed(0)}ms`);
  console.log(`   TTFT < 500ms: ${ttftUnder500}/${results.filter(r => r.ttft).length}`);
  console.log('═'.repeat(70));

  if (successful === results.length && avgTtft < 1000) {
    console.log('   ✅ STREAMING TESTS PASSED');
    process.exit(0);
  } else {
    console.log('   ⚠️  Some tests failed or TTFT too high');
    process.exit(1);
  }
}

runStreamingTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
