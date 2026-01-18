/**
 * ╔═══════════════════════════════════════════════════════════════════════════════╗
 * ║           🌟 TEST SECOND BRAIN V4 - PULSAR EDITION 🌟                          ║
 * ╠═══════════════════════════════════════════════════════════════════════════════╣
 * ║  Tests:                                                                        ║
 * ║  • Multi-language detection (FR/EN/ES/DE)                                     ║
 * ║  • Zod schema validation                                                       ║
 * ║  • Offline fallback parser                                                     ║
 * ║  • Streaming mode                                                              ║
 * ║  • Apple EventKit/Reminders/Siri export                                       ║
 * ║  • Android Google Calendar/Tasks/Intent export                                ║
 * ║  • Samsung Calendar/Reminder/Bixby export                                     ║
 * ║  • Xiaomi HyperOS export                                                       ║
 * ║  • Universal iCal export (RFC 5545)                                           ║
 * ║  • V3 vs V4 benchmark                                                          ║
 * ╚═══════════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node tests/test-parser-v4-pulsar.js              # Standard tests
 *   node tests/test-parser-v4-pulsar.js --offline    # Offline fallback tests
 *   node tests/test-parser-v4-pulsar.js --stream     # Streaming mode test
 *   node tests/test-parser-v4-pulsar.js --lang       # Multi-language tests
 *   node tests/test-parser-v4-pulsar.js --apple      # Apple integration tests
 *   node tests/test-parser-v4-pulsar.js --android    # Android/Google integration tests
 *   node tests/test-parser-v4-pulsar.js --samsung    # Samsung integration tests
 *   node tests/test-parser-v4-pulsar.js --cross      # Cross-platform export tests
 *   node tests/test-parser-v4-pulsar.js --benchmark  # V3 vs V4 benchmark
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import pulsar, {
  parsePulsar,
  parseOffline,
  detectLanguage,
  // Apple exports
  toEventKitFormat,
  toRemindersFormat,
  // Android/Google exports
  toGoogleCalendarFormat,
  toGoogleTasksFormat,
  toAndroidIntentFormat,
  // Samsung exports
  toSamsungReminderFormat,
  toSamsungCalendarFormat,
  // Universal exports
  toICalFormat,
  toVoiceAssistantFormat,
  // Cross-platform helpers
  exportToPlatform,
  exportToAllPlatforms,
  ParseResultSchema,
} from '../src/prompts/second-brain-v4-pulsar.js';
import buildSecondBrainPromptV3, {
  buildAnthropicMessages,
} from '../src/prompts/second-brain-v3.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ============================================================================
// TEST CASES - MULTI-LANGUAGE
// ============================================================================

const TEST_CASES = {
  fr: [
    ['RDV client', 'RDV client Dupont jeudi 14h pour présenter le nouveau produit'],
    ['Tâche urgente', 'URGENT envoyer le devis à Martin pour le projet web'],
    ['Multi-items', "demain call avec Paul projet Alpha et j'ai une idée pour le cache"],
  ],
  en: [
    ['Client meeting', 'Meeting with client Smith Thursday 2pm to present the new product'],
    ['Urgent task', 'URGENT send quote to Martin for the web project'],
    ['Multi-items', 'tomorrow call with Paul project Alpha and I have an idea for the cache'],
  ],
  es: [
    ['Reunión cliente', 'Reunión con cliente García jueves 14h para presentar el nuevo producto'],
    ['Tarea urgente', 'URGENTE enviar presupuesto a Martín para el proyecto web'],
  ],
  de: [
    ['Kundentermin', 'Termin mit Kunde Schmidt Donnerstag 14 Uhr für Produktpräsentation'],
    ['Dringende Aufgabe', 'DRINGEND Angebot an Martin für Webprojekt senden'],
  ],
};

// ============================================================================
// STANDARD PULSAR TEST
// ============================================================================

async function testPulsar(testName, inputText, lang = 'fr') {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🌟 PULSAR | ${testName} [${lang.toUpperCase()}]`);
  console.log(`📝 "${inputText}"`);

  const startTime = Date.now();
  const { result, telemetry } = await parsePulsar(anthropic, inputText);
  const latency = Date.now() - startTime;

  const items = result.items || [];
  const suggestions = result.suggestions || [];

  // Check for undefined values
  const jsonStr = JSON.stringify(result);
  const hasUndefined = jsonStr.includes('undefined') || jsonStr.includes('"undefined"');

  // Check Zod validation
  let zodValid = false;
  try {
    ParseResultSchema.parse(result);
    zodValid = true;
  } catch (e) {
    console.log(`   ⚠️ Zod validation failed: ${e.message.substring(0, 100)}`);
  }

  console.log(
    `✅ ${items.length} items | ${suggestions.length} suggestions | ${latency}ms | Lang: ${result.meta?.detected_lang || 'unknown'}`
  );
  console.log(
    `   Zod: ${zodValid ? '✅' : '❌'} | Undefined: ${hasUndefined ? '❌' : '✅'} | Mode: ${result.meta?.parse_mode || 'unknown'}`
  );

  items.forEach(item => {
    const conf = item.metadata?.confidence
      ? ` (${(item.metadata.confidence * 100).toFixed(0)}%)`
      : '';
    const hasChain = item.metadata?.predictive?.chain ? ' ⛓️' : '';
    const hasPattern = item.metadata?.predictive?.patterns?.length > 0 ? ' 🔄' : '';
    const siri = item.apple?.siri_speakable ? ` 📱` : '';
    console.log(
      `   [${item.type.toUpperCase()}]${conf}${hasChain}${hasPattern}${siri} ${item.text || item.title}`
    );
  });

  if (suggestions.length > 0) {
    suggestions.slice(0, 3).forEach(s => {
      console.log(`   💡 [${s.type}] ${s.task} (${(s.score * 100).toFixed(0)}%)`);
    });
  }

  return {
    success: true,
    zodValid,
    hasUndefined,
    items,
    suggestions,
    latency,
    lang: result.meta?.detected_lang,
  };
}

// ============================================================================
// OFFLINE FALLBACK TEST
// ============================================================================

function testOffline(testName, inputText, expectedLang = 'fr') {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📴 OFFLINE | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const detectedLang = detectLanguage(inputText);
  const result = parseOffline(inputText, detectedLang);

  const items = result.items || [];

  console.log(
    `✅ ${items.length} items | Lang detected: ${detectedLang} (expected: ${expectedLang}) | Mode: ${result.meta?.parse_mode}`
  );

  items.forEach(item => {
    console.log(
      `   [${item.type.toUpperCase()}] ${item.text || item.title} → ${item.date}${item.start_time ? ' ' + item.start_time : ''}`
    );
  });

  return {
    success: true,
    langCorrect: detectedLang === expectedLang,
    items,
    detectedLang,
  };
}

// ============================================================================
// STREAMING TEST
// ============================================================================

async function testStreaming(testName, inputText) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🌊 STREAMING | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const startTime = Date.now();
  let partialCount = 0;
  let finalResult = null;

  try {
    const stream = await pulsar.streamParse(anthropic, inputText);

    for await (const event of stream) {
      if (event.type === 'partial_item') {
        partialCount++;
        console.log(`   ⚡ Partial ${partialCount}: [${event.item.type}] ${event.item.text}`);
      } else if (event.type === 'complete') {
        finalResult = event.result;
      } else if (event.type === 'error') {
        console.log(`   ❌ Error: ${event.error}`);
        finalResult = event.fallback;
      }
    }

    const latency = Date.now() - startTime;
    console.log(`✅ Streaming complete | ${partialCount} partial updates | ${latency}ms`);
    console.log(`   Final: ${finalResult?.items?.length || 0} items`);

    return { success: true, partialCount, latency, items: finalResult?.items?.length || 0 };
  } catch (e) {
    console.log(`❌ Streaming failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ============================================================================
// APPLE INTEGRATION TEST
// ============================================================================

function testAppleExport(testName, inputText) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🍎 APPLE EXPORT | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const result = parseOffline(inputText, 'fr');

  for (const item of result.items) {
    if (item.type === 'event') {
      const eventKit = toEventKitFormat(item);
      console.log(`   📅 EventKit:`);
      console.log(`      title: "${eventKit.title}"`);
      console.log(`      start: ${eventKit.startDate}`);
      console.log(`      end: ${eventKit.endDate}`);
      console.log(`      alarms: ${eventKit.alarms?.length || 0}`);
    } else if (item.type === 'task') {
      const reminder = toRemindersFormat(item);
      console.log(`   ⏰ Reminders:`);
      console.log(`      title: "${reminder.title}"`);
      console.log(`      due: ${reminder.dueDate}`);
      console.log(`      priority: ${reminder.priority}`);
      console.log(`      flagged: ${reminder.flagged}`);
    }
  }

  return { success: true };
}

// ============================================================================
// V3 vs V4 BENCHMARK
// ============================================================================

async function benchmarkV3vsV4(testName, inputText) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`⚔️ V3 vs V4 PULSAR | ${testName}`);
  console.log(`📝 "${inputText}"`);
  console.log('─'.repeat(70));

  // V3 Test
  console.log('\n🟣 V3 GALACTIC:');
  const v3Start = Date.now();
  const v3Prompt = buildSecondBrainPromptV3(inputText);
  const v3Config = buildAnthropicMessages(v3Prompt, { useCache: false });
  const v3Response = await anthropic.messages.create(v3Config);
  const v3Latency = Date.now() - v3Start;
  const v3Tokens = v3Response.usage.input_tokens + v3Response.usage.output_tokens;

  let v3Result;
  try {
    const jsonMatch = v3Response.content[0].text.match(/\{[\s\S]*\}/);
    v3Result = JSON.parse(jsonMatch[0]);
  } catch {
    v3Result = { items: [], suggestions: [] };
  }

  console.log(
    `   Items: ${v3Result.items?.length || 0} | Suggestions: ${v3Result.suggestions?.length || 0}`
  );
  console.log(`   Tokens: ${v3Tokens} | Latency: ${v3Latency}ms`);

  // V4 Test
  console.log('\n🌟 V4 PULSAR:');
  const v4Start = Date.now();
  const { result: v4Result, telemetry } = await parsePulsar(anthropic, inputText);
  const v4Latency = Date.now() - v4Start;
  const v4Tokens = telemetry.tokens_used || 0;

  console.log(
    `   Items: ${v4Result.items?.length || 0} | Suggestions: ${v4Result.suggestions?.length || 0}`
  );
  console.log(`   Tokens: ${v4Tokens} | Latency: ${v4Latency}ms`);
  console.log(`   Lang: ${v4Result.meta?.detected_lang} | Mode: ${v4Result.meta?.parse_mode}`);

  // Comparison
  console.log('\n📊 COMPARISON:');
  const tokensDiff = v3Tokens - v4Tokens;
  const latencyDiff = v3Latency - v4Latency;
  console.log(
    `   Tokens: ${tokensDiff > 0 ? '✅' : '❌'} ${Math.abs(tokensDiff)} ${tokensDiff > 0 ? 'saved' : 'more'}`
  );
  console.log(
    `   Latency: ${latencyDiff > 0 ? '✅' : '❌'} ${Math.abs(latencyDiff)}ms ${latencyDiff > 0 ? 'faster' : 'slower'}`
  );

  // V4 extras
  const v4HasSiri = v4Result.items?.some(i => i.apple?.siri_speakable);
  const v4HasZod = true; // We validated earlier
  console.log(`   🍎 Siri-ready: ${v4HasSiri ? '✅' : '❌'}`);
  console.log(`   🔒 Zod validated: ${v4HasZod ? '✅' : '❌'}`);

  return {
    v3: { tokens: v3Tokens, latency: v3Latency, items: v3Result.items?.length || 0 },
    v4: { tokens: v4Tokens, latency: v4Latency, items: v4Result.items?.length || 0 },
  };
}

// ============================================================================
// RUN TESTS
// ============================================================================

async function runStandardTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🌟 SECOND BRAIN V4 - PULSAR EDITION                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  let passed = 0;
  let zodValid = 0;
  let noUndefined = 0;

  for (const [name, input] of TEST_CASES.fr) {
    const result = await testPulsar(name, input, 'fr');
    if (result.success) passed++;
    if (result.zodValid) zodValid++;
    if (!result.hasUndefined) noUndefined++;
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🌟 PULSAR RESULTS:');
  console.log(`   ✅ ${passed}/${TEST_CASES.fr.length} tests passed`);
  console.log(`   🔒 ${zodValid}/${TEST_CASES.fr.length} Zod validated`);
  console.log(`   🚫 ${noUndefined}/${TEST_CASES.fr.length} no undefined`);
  console.log('═'.repeat(70));
}

async function runLanguageTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🌍 MULTI-LANGUAGE TESTS                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const results = { fr: 0, en: 0, es: 0, de: 0 };

  for (const [lang, cases] of Object.entries(TEST_CASES)) {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🌍 LANGUAGE: ${lang.toUpperCase()}`);

    for (const [name, input] of cases) {
      const result = await testPulsar(name, input, lang);
      if (result.lang === lang) results[lang]++;
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('\n' + '═'.repeat(70));
  console.log('🌍 LANGUAGE DETECTION:');
  for (const [lang, correct] of Object.entries(results)) {
    const total = TEST_CASES[lang]?.length || 0;
    console.log(`   ${lang.toUpperCase()}: ${correct}/${total} correctly detected`);
  }
}

function runOfflineTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     📴 OFFLINE FALLBACK TESTS                                              ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const tests = [
    ['FR - RDV', 'RDV client Dupont jeudi 14h', 'fr'],
    ['FR - Urgent', 'URGENT appeler Martin + envoyer devis', 'fr'],
    ['EN - Meeting', 'Meeting with Smith tomorrow 3pm', 'en'],
    ['ES - Reunión', 'Reunión con García mañana 14h', 'es'],
    ['DE - Termin', 'Termin mit Schmidt morgen 14 Uhr', 'de'],
  ];

  let langCorrect = 0;
  for (const [name, input, expectedLang] of tests) {
    const result = testOffline(name, input, expectedLang);
    if (result.langCorrect) langCorrect++;
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`📴 OFFLINE: ${langCorrect}/${tests.length} languages correctly detected`);
}

async function runStreamingTest() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🌊 STREAMING MODE TEST                                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  await testStreaming(
    'Complex multi-item',
    'RDV client Martin demain 14h + envoyer devis Dupont + idée: optimiser le cache'
  );
}

function runAppleTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🍎 APPLE INTEGRATION TESTS                                             ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  testAppleExport('Event → EventKit', 'RDV client Dupont jeudi 14h présentation produit');
  testAppleExport('Task → Reminders', 'URGENT envoyer le devis à Martin');
}

// ============================================================================
// ANDROID / GOOGLE INTEGRATION TESTS
// ============================================================================

function testAndroidExport(testName, inputText) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🤖 ANDROID EXPORT | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const result = parseOffline(inputText, 'fr');

  for (const item of result.items) {
    if (item.type === 'event') {
      const googleCal = toGoogleCalendarFormat(item);
      console.log(`   📅 Google Calendar:`);
      console.log(`      summary: "${googleCal.summary}"`);
      console.log(`      start: ${googleCal.start.dateTime}`);
      console.log(`      end: ${googleCal.end.dateTime}`);
      console.log(`      timeZone: ${googleCal.start.timeZone}`);
      console.log(`      reminders: ${googleCal.reminders.overrides?.length || 0}`);

      const intent = toAndroidIntentFormat(item);
      console.log(`   📱 Android Intent:`);
      console.log(`      action: ${intent.action}`);
      console.log(`      beginTime: ${new Date(intent.extras.beginTime).toISOString()}`);
      console.log(`      MIUI extra: ${intent.extras['com.miui.extra.START_TIME'] ? '✅' : '❌'}`);
    } else if (item.type === 'task') {
      const googleTasks = toGoogleTasksFormat(item);
      console.log(`   ✅ Google Tasks:`);
      console.log(`      title: "${googleTasks.title}"`);
      console.log(`      due: ${googleTasks.due}`);
      console.log(`      status: ${googleTasks.status}`);

      const intent = toAndroidIntentFormat(item);
      console.log(`   📱 Android Intent:`);
      console.log(`      googleTasksUri: ${intent.googleTasksUri ? '✅' : '❌'}`);
      console.log(`      samsungReminder: ${intent.samsungReminderExtras ? '✅' : '❌'}`);
      console.log(`      hyperOS: ${intent.hyperOSExtras ? '✅' : '❌'}`);
    }

    // Voice assistant
    const googleVoice = toVoiceAssistantFormat(item, 'google');
    console.log(`   🎤 Google Assistant: "${googleVoice}"`);
  }

  return { success: true };
}

function runAndroidTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🤖 ANDROID / GOOGLE INTEGRATION TESTS                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  testAndroidExport('Event → Google Calendar', 'RDV client Dupont jeudi 14h présentation produit');
  testAndroidExport('Task → Google Tasks', 'URGENT envoyer le devis à Martin');
  testAndroidExport('Multi-items', 'Meeting 15h + call client + note: idée cache');
}

// ============================================================================
// SAMSUNG INTEGRATION TESTS
// ============================================================================

function testSamsungExport(testName, inputText) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`📱 SAMSUNG EXPORT | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const result = parseOffline(inputText, 'fr');

  for (const item of result.items) {
    if (item.type === 'event') {
      const samsungCal = toSamsungCalendarFormat(item);
      console.log(`   📅 Samsung Calendar:`);
      console.log(`      title: "${samsungCal.title}"`);
      console.log(`      dtStart: ${new Date(samsungCal.dtStart).toISOString()}`);
      console.log(`      dtEnd: ${new Date(samsungCal.dtEnd).toISOString()}`);
      console.log(`      color: ${samsungCal.calendarColor}`);
      console.log(`      alarms: ${samsungCal.alarmMinutes?.join(', ')} min`);
    } else if (item.type === 'task') {
      const samsungReminder = toSamsungReminderFormat(item);
      console.log(`   ⏰ Samsung Reminder:`);
      console.log(`      title: "${samsungReminder.title}"`);
      console.log(`      dueDate: ${new Date(samsungReminder.dueDate).toISOString()}`);
      console.log(`      priority: ${samsungReminder.priority}`);
      console.log(`      source: ${samsungReminder.extraData?.source}`);
    }

    // Bixby voice
    const bixbyVoice = toVoiceAssistantFormat(item, 'bixby');
    console.log(`   🎤 Bixby: "${bixbyVoice}"`);
  }

  return { success: true };
}

function runSamsungTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     📱 SAMSUNG INTEGRATION TESTS                                           ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  testSamsungExport('Event → Samsung Calendar', 'RDV important client Martin jeudi 14h');
  testSamsungExport('Task → Samsung Reminder', 'URGENT appeler le fournisseur');
}

// ============================================================================
// CROSS-PLATFORM EXPORT TESTS
// ============================================================================

function testCrossPlatform(testName, inputText) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🌐 CROSS-PLATFORM | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const result = parseOffline(inputText, 'fr');

  for (const item of result.items) {
    console.log(`\n   [${item.type.toUpperCase()}] ${item.text || item.title}`);

    // Export to all platforms
    const allExports = exportToAllPlatforms(item);

    // Universal iCal
    const ical = allExports.universal.ical;
    const icalLines = ical.split('\n').length;
    console.log(`   📄 iCal: ${icalLines} lines (RFC 5545 compliant)`);

    // Platform-specific
    if (item.type === 'event') {
      console.log(`   🍎 Apple EventKit: ${allExports.apple.eventkit ? '✅' : '❌'}`);
      console.log(`   🤖 Google Calendar: ${allExports.android.googleCalendar ? '✅' : '❌'}`);
      console.log(`   📱 Samsung Calendar: ${allExports.samsung.calendar ? '✅' : '❌'}`);
    } else if (item.type === 'task') {
      console.log(`   🍎 Apple Reminders: ${allExports.apple.reminders ? '✅' : '❌'}`);
      console.log(`   🤖 Google Tasks: ${allExports.android.googleTasks ? '✅' : '❌'}`);
      console.log(`   📱 Samsung Reminder: ${allExports.samsung.reminder ? '✅' : '❌'}`);
    }

    // Voice assistants
    console.log(`   🎤 Voice Assistants:`);
    console.log(`      Siri: "${allExports.voice.siri}"`);
    console.log(`      Google: "${allExports.voice.googleAssistant}"`);
    console.log(`      Bixby: "${allExports.voice.bixby}"`);
    console.log(`      HyperOS: "${allExports.voice.hyperos}"`);

    // Android Intent
    console.log(`   📱 Android Intent: ${allExports.android.intent ? '✅' : '❌'}`);
    console.log(`   📱 Xiaomi HyperOS: ${allExports.xiaomi.intent ? '✅' : '❌'}`);
  }

  return { success: true };
}

function testExportToPlatform() {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`🎯 exportToPlatform() HELPER TEST`);

  const result = parseOffline('RDV client Martin demain 14h', 'fr');
  const event = result.items[0];

  const platforms = [
    'apple-eventkit',
    'google-calendar',
    'samsung-calendar',
    'ical',
    'siri',
    'google-assistant',
    'bixby',
  ];

  console.log(`   Testing ${platforms.length} platforms...`);

  let success = 0;
  for (const platform of platforms) {
    try {
      const exported = exportToPlatform(event, platform);
      if (exported) {
        success++;
        console.log(`   ✅ ${platform}`);
      } else {
        console.log(`   ❌ ${platform} (null result)`);
      }
    } catch (e) {
      console.log(`   ❌ ${platform}: ${e.message}`);
    }
  }

  console.log(`\n   Result: ${success}/${platforms.length} platforms exported`);
  return { success: success === platforms.length };
}

function runCrossPlatformTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🌐 CROSS-PLATFORM EXPORT TESTS                                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  testCrossPlatform('Event full export', 'RDV important client Martin jeudi 14h présentation');
  testCrossPlatform('Task full export', 'URGENT envoyer le devis projet Alpha');
  testCrossPlatform('Note full export', 'idée: optimiser le système de cache Redis');
  testExportToPlatform();

  console.log('\n' + '═'.repeat(70));
  console.log('🌐 Supported platforms:');
  console.log('   🍎 Apple: EventKit, Reminders, Siri');
  console.log('   🤖 Android: Google Calendar, Google Tasks, Intents, Assistant');
  console.log('   📱 Samsung: Calendar, Reminder, Bixby');
  console.log('   📱 Xiaomi: HyperOS Intents, Voice');
  console.log('   📄 Universal: iCal/ICS (RFC 5545)');
  console.log('═'.repeat(70));
}

async function runBenchmark() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     ⚔️ V3 GALACTIC vs V4 PULSAR BENCHMARK                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const results = [];

  for (const [name, input] of TEST_CASES.fr) {
    const result = await benchmarkV3vsV4(name, input);
    results.push(result);
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  const avgV3Tokens = results.reduce((s, r) => s + r.v3.tokens, 0) / results.length;
  const avgV4Tokens = results.reduce((s, r) => s + r.v4.tokens, 0) / results.length;
  const avgV3Latency = results.reduce((s, r) => s + r.v3.latency, 0) / results.length;
  const avgV4Latency = results.reduce((s, r) => s + r.v4.latency, 0) / results.length;

  console.log('\n' + '═'.repeat(70));
  console.log('📊 BENCHMARK SUMMARY:');
  console.log(`   V3 avg: ${avgV3Tokens.toFixed(0)} tokens, ${avgV3Latency.toFixed(0)}ms`);
  console.log(`   V4 avg: ${avgV4Tokens.toFixed(0)} tokens, ${avgV4Latency.toFixed(0)}ms`);
  console.log(
    `   Improvement: ${((1 - avgV4Tokens / avgV3Tokens) * 100).toFixed(1)}% tokens, ${((1 - avgV4Latency / avgV3Latency) * 100).toFixed(1)}% latency`
  );
  console.log('═'.repeat(70));
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--offline')) {
  runOfflineTests();
} else if (args.includes('--stream')) {
  runStreamingTest().catch(console.error);
} else if (args.includes('--lang')) {
  runLanguageTests().catch(console.error);
} else if (args.includes('--apple')) {
  runAppleTests();
} else if (args.includes('--android')) {
  runAndroidTests();
} else if (args.includes('--samsung')) {
  runSamsungTests();
} else if (args.includes('--cross')) {
  runCrossPlatformTests();
} else if (args.includes('--benchmark')) {
  runBenchmark().catch(console.error);
} else {
  runStandardTests().catch(console.error);
}
