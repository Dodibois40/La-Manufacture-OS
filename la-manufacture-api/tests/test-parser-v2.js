/**
 * TEST SECOND BRAIN V2 - Intelligence Prédictive & Suggestions Proactives
 * MULTI-AI EDITION: Test avec Claude, GPT-4, et Gemini
 *
 * Ce test appelle plusieurs modèles IA avec le nouveau prompt V2 pour comparer :
 * - Section 14: Intelligence Prédictive (patterns, chaînes, routines)
 * - Section 15: Profil Utilisateur Adaptatif
 * - Section 16: Suggestions Proactives
 * - Section 17: Mémoire Contextuelle
 *
 * Usage:
 *   node tests/test-parser-v2.js              # Test Claude uniquement
 *   node tests/test-parser-v2.js --all        # Test tous les modèles
 *   node tests/test-parser-v2.js --gpt        # Test GPT-4 uniquement
 *   node tests/test-parser-v2.js --gemini     # Test Gemini uniquement
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import buildSecondBrainPrompt from '../src/prompts/second-brain-v2.js';

// ============================================================================
// CONFIGURATION MULTI-AI
// ============================================================================

const AI_PROVIDERS = {
  claude: {
    name: 'Claude Sonnet 4.5',
    emoji: '🟣',
    available: !!process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-5-20250929',
  },
  gpt4: {
    name: 'GPT-4 Turbo',
    emoji: '🟢',
    available: !!process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo-preview',
  },
  gemini: {
    name: 'Gemini Pro',
    emoji: '🔵',
    available: !!process.env.GOOGLE_AI_API_KEY,
    model: 'gemini-1.5-pro',
  },
};

// ============================================================================
// AI ADAPTERS
// ============================================================================

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function callClaude(systemPrompt, userPrompt) {
  const message = await anthropic.messages.create({
    model: AI_PROVIDERS.claude.model,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return {
    text: message.content[0].text,
    tokens: message.usage.input_tokens + message.usage.output_tokens,
  };
}

async function callGPT4(systemPrompt, userPrompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_PROVIDERS.gpt4.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 3000,
      temperature: 0.3,
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return {
    text: data.choices[0].message.content,
    tokens: data.usage?.total_tokens || 0,
  };
}

async function callGemini(systemPrompt, userPrompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_PROVIDERS.gemini.model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n---\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 3000,
        },
      }),
    }
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return {
    text: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    tokens: data.usageMetadata?.totalTokenCount || 0,
  };
}

const AI_CALLERS = {
  claude: callClaude,
  gpt4: callGPT4,
  gemini: callGemini,
};

// ============================================================================
// TEST RUNNER
// ============================================================================

async function testParserV2(testName, inputText, context = {}, provider = 'claude') {
  const config = AI_PROVIDERS[provider];
  if (!config.available) {
    console.log(`   ⏭️  ${config.name} - API KEY manquante`);
    return { success: false, skipped: true };
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`${config.emoji} ${config.name} | ${testName}`);
  console.log(`📝 "${inputText}"`);

  const { systemPrompt, userPrompt } = buildSecondBrainPrompt(inputText, context);
  const startTime = Date.now();

  try {
    const caller = AI_CALLERS[provider];
    const response = await caller(systemPrompt, userPrompt);
    const processingTime = Date.now() - startTime;

    // Parse JSON
    let result;
    try {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch[0]);
    } catch {
      console.log(`❌ JSON Parse Error`);
      console.log(response.text.substring(0, 500));
      return { success: false, provider };
    }

    const items = result.items || [];
    const suggestions = result.proactive_suggestions || [];
    const tasks = items.filter(i => i.type === 'task').length;
    const events = items.filter(i => i.type === 'event').length;
    const notes = items.filter(i => i.type === 'note').length;

    console.log(
      `✅ ${items.length} item(s) | ⏱️ ${processingTime}ms | 🪙 ${response.tokens} tokens | 📊 ${tasks}T ${events}E ${notes}N | 💡 ${suggestions.length} suggestions`
    );

    // Afficher les items
    items.forEach(item => {
      const conf = item.metadata?.confidence
        ? ` (${(item.metadata.confidence * 100).toFixed(0)}%)`
        : '';
      const warn = item.metadata?.warnings?.length ? ` ⚠️` : '';
      const pred = item.metadata?.predictive ? ' 🔮' : '';
      console.log(
        `   [${item.type.toUpperCase()}]${conf}${warn}${pred} ${item.text || item.title}`
      );
      if (item.date)
        console.log(`            📅 ${item.date}${item.start_time ? ' ' + item.start_time : ''}`);

      // Patterns détectés
      if (item.metadata?.predictive?.detected_patterns?.length > 0) {
        item.metadata.predictive.detected_patterns.forEach(p => {
          console.log(`            🔄 Pattern: ${p.type} - "${p.trigger}"`);
        });
      }

      // Tâches prédites
      if (item.metadata?.predictive?.predicted_tasks?.length > 0) {
        item.metadata.predictive.predicted_tasks.forEach(t => {
          console.log(`            🔮 Prédit: ${t.text} (${t.relative_date})`);
        });
      }

      // Chaînes
      if (item.metadata?.predictive?.task_chain?.next_tasks?.length > 0) {
        item.metadata.predictive.task_chain.next_tasks.forEach(t => {
          console.log(`            ⛓️ Chaîne: ${t.text} (${t.trigger})`);
        });
      }
    });

    // Suggestions proactives
    if (suggestions.length > 0) {
      console.log(`   ────────────────────────────────────────`);
      console.log(`   💡 SUGGESTIONS PROACTIVES:`);
      suggestions.forEach(s => {
        const score = s.priority_score ? ` [${(s.priority_score * 100).toFixed(0)}%]` : '';
        console.log(`      • [${s.suggestion_type}]${score} ${s.suggested_task}`);
        if (s.reason) console.log(`        └─ ${s.reason}`);
      });
    }

    if (result.parsing_notes) {
      console.log(`   💭 ${result.parsing_notes}`);
    }

    return {
      success: true,
      items,
      suggestions,
      processingTime,
      tokens: response.tokens,
      provider,
    };
  } catch (error) {
    console.log(`💥 ${error.message}`);
    return { success: false, provider };
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

const TEST_CASES = [
  // SECTION 14 : INTELLIGENCE PRÉDICTIVE
  ['1. Pattern hebdomadaire', "Tous les lundis je fais la revue d'équipe à 9h"],
  ['2. Pattern mensuel', 'Le 1er du mois je paie le loyer'],
  ['3. Chaîne de tâches', 'Call client Dupont pour valider le devis'],
  ['4. Tâches implicites (RDV médical)', 'RDV dentiste vendredi 10h cabinet du Dr Martin'],
  ['5. Deadline avec rappels', 'Deadline livraison projet Alpha le 31 janvier important'],

  // SECTION 16 : SUGGESTIONS PROACTIVES
  ['6. RDV client (prep)', 'RDV client Dupont jeudi 14h pour présenter le nouveau produit'],
  ['7. Envoi devis (suivi)', 'Envoyer le devis à Martin pour le projet web'],
  ['8. Formation (actions implicites)', 'Formation powerpoint mardi 9h salle B'],

  // COMBINÉS
  [
    '9. Multi-items + prédictions',
    'Demain rdv client Dupont 14h pour présentation et envoyer le devis ensuite',
  ],
  [
    '10. Texte dicté complexe',
    "alors faut que je prépare la présentation pour le client dupont c'est jeudi important et après j'ai eu une idée pour le cache redis",
  ],
];

async function runSingleProviderTests(provider) {
  const config = AI_PROVIDERS[provider];
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log(`║  ${config.emoji} TEST SECOND BRAIN V2 - ${config.name.padEnd(45)}  ║`);
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  let passed = 0;
  let totalSuggestions = 0;
  let totalTime = 0;
  let totalTokens = 0;

  for (const [name, input] of TEST_CASES) {
    const result = await testParserV2(name, input, {}, provider);
    if (result.success) {
      passed++;
      totalSuggestions += result.suggestions?.length || 0;
      totalTime += result.processingTime || 0;
      totalTokens += result.tokens || 0;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`${config.emoji} ${config.name} RÉSULTATS:`);
  console.log(`   ✅ ${passed}/${TEST_CASES.length} tests réussis`);
  console.log(`   💡 ${totalSuggestions} suggestions générées`);
  console.log(`   ⏱️  ${(totalTime / 1000).toFixed(1)}s temps total`);
  console.log(`   🪙 ${totalTokens} tokens utilisés`);
  console.log('═'.repeat(80));

  return {
    provider,
    passed,
    total: TEST_CASES.length,
    suggestions: totalSuggestions,
    time: totalTime,
    tokens: totalTokens,
  };
}

async function runAllProviders() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║     🤖 MULTI-AI BENCHMARK - SECOND BRAIN V2                                ║');
  console.log('║        Claude vs GPT-4 vs Gemini                                           ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝\n');

  const availableProviders = Object.keys(AI_PROVIDERS).filter(p => AI_PROVIDERS[p].available);
  console.log(
    `📡 Providers disponibles: ${availableProviders.map(p => AI_PROVIDERS[p].name).join(', ')}\n`
  );

  const results = [];

  for (const provider of availableProviders) {
    const result = await runSingleProviderTests(provider);
    results.push(result);
    console.log('\n');
  }

  // Tableau comparatif
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 TABLEAU COMPARATIF                                   ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');
  console.log('║  Provider        │ Tests │ Suggestions │ Temps    │ Tokens               ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');

  results.forEach(r => {
    const config = AI_PROVIDERS[r.provider];
    const name = `${config.emoji} ${config.name}`.padEnd(18);
    const tests = `${r.passed}/${r.total}`.padEnd(6);
    const sugg = String(r.suggestions).padEnd(12);
    const time = `${(r.time / 1000).toFixed(1)}s`.padEnd(9);
    const tokens = String(r.tokens).padEnd(20);
    console.log(`║  ${name}│ ${tests}│ ${sugg}│ ${time}│ ${tokens}║`);
  });

  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  // Déterminer le gagnant
  const best = results.reduce((a, b) =>
    a.passed > b.passed || (a.passed === b.passed && a.suggestions > b.suggestions) ? a : b
  );
  console.log(
    `\n🏆 MEILLEUR: ${AI_PROVIDERS[best.provider].emoji} ${AI_PROVIDERS[best.provider].name}`
  );
}

async function runWithProfile(provider = 'claude') {
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║          🧬 TEST AVEC PROFIL UTILISATEUR (Section 15)                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const devProfile = {
    profession: 'développeur',
    domain: 'IT',
    role_level: 'responsable',
    communication_style: { formality: 'informel', verbosity: 'concis' },
    vocabulary: {
      abbreviations: { CR: 'compte-rendu', PR: 'pull request', PROD: 'production' },
      people_aliases: { 'le lead': 'Sophie Martin', boss: 'Jean-Pierre' },
    },
  };

  await testParserV2(
    'Profil DEV: Vocabulaire technique',
    'PR à reviewer urgent + daily demain + call avec le lead sur le bug prod',
    { userProfile: devProfile },
    provider
  );

  const commercialProfile = {
    profession: 'commercial',
    domain: 'commerce',
    communication_style: { formality: 'formel', verbosity: 'standard' },
    vocabulary: {
      abbreviations: { RDV1: 'Premier rendez-vous découverte', PROP: 'Proposition commerciale' },
    },
  };

  await testParserV2(
    'Profil COMMERCIAL: Vocabulaire sales',
    'RDV1 prospect Martin jeudi 14h + envoyer PROP Dupont + relancer closing Durand',
    { userProfile: commercialProfile },
    provider
  );
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--all')) {
  runAllProviders()
    .then(() => runWithProfile('claude'))
    .catch(console.error);
} else if (args.includes('--gpt')) {
  runSingleProviderTests('gpt4')
    .then(() => runWithProfile('gpt4'))
    .catch(console.error);
} else if (args.includes('--gemini')) {
  runSingleProviderTests('gemini')
    .then(() => runWithProfile('gemini'))
    .catch(console.error);
} else {
  runSingleProviderTests('claude')
    .then(() => runWithProfile('claude'))
    .catch(console.error);
}
