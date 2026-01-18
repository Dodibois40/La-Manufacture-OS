/**
 * TEST DIRECT DU PARSER - Appelle directement Claude sans serveur
 *
 * Usage: node tests/test-parser-direct.js
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Reproduire le prompt du serveur
function buildPrompt(text) {
  const now = new Date();
  const currentDate = now.toISOString().split('T')[0];
  const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const currentDayName = dayNames[now.getDay()];
  const currentTime = now.toTimeString().split(' ')[0].substring(0, 5);

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split('T')[0];
  const tomorrowDayName = dayNames[tomorrow.getDay()];

  const afterTomorrow = new Date(now);
  afterTomorrow.setDate(afterTomorrow.getDate() + 2);
  const afterTomorrowDate = afterTomorrow.toISOString().split('T')[0];

  // Jours de la semaine
  const weekDays = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    weekDays.push({
      name: dayNames[d.getDay()],
      date: d.toISOString().split('T')[0],
    });
  }
  const weekDaysStr = weekDays.map(d => `${d.name} → ${d.date}`).join(', ');

  // System prompt simplifié pour les tests
  const systemPrompt = `Tu es un SECOND BRAIN - un assistant cognitif de niveau supérieur.

CLASSIFICATION :
1. EVENT : Heure explicite OU mot-clé RDV/réunion/déjeuner/meeting + personne
2. NOTE : Préfixe explicite (Note:, Idée:, !, Info:) OU information factuelle sans action
3. TASK : Action à faire (verbe d'action) - PAR DÉFAUT

DATES :
- "aujourd'hui" = ${currentDate}
- "demain" = ${tomorrowDate}
- Sans mention = ${currentDate}
- Jours: ${weekDaysStr}

MULTI-ITEMS : Sépare si changement de date/sujet/type. Marqueurs: "et", "aussi", "puis", virgule.

FORMAT JSON STRICT :
{
  "items": [{
    "type": "task"|"event"|"note",
    "text": "Texte reformulé (tasks/events)",
    "title": "Titre note" | null,
    "content": "Contenu note" | null,
    "date": "YYYY-MM-DD",
    "start_time": "HH:MM" | null,
    "end_time": "HH:MM" | null,
    "location": "Lieu" | null,
    "urgent": true|false,
    "metadata": {
      "confidence": 0.0-1.0,
      "warnings": [],
      "suggestions": []
    }
  }],
  "parsing_notes": "..."
}`;

  const userPrompt = `Aujourd'hui: ${currentDayName} ${currentDate}, ${currentTime}

TEXTE À PARSER:
"""
${text}
"""

Réponds UNIQUEMENT en JSON valide.`;

  return { systemPrompt, userPrompt };
}

async function testParser(testName, inputText) {
  console.log('\n' + '═'.repeat(80));
  console.log(`🧪 ${testName}`);
  console.log('─'.repeat(80));
  console.log(`📝 "${inputText}"`);
  console.log('─'.repeat(80));

  const { systemPrompt, userPrompt } = buildPrompt(inputText);
  const startTime = Date.now();

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText = message.content[0].text;
    const processingTime = Date.now() - startTime;

    // Parse JSON
    let result;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      result = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.log(`❌ JSON Parse Error`);
      console.log(responseText);
      return { success: false };
    }

    const items = result.items || [];
    const tasks = items.filter(i => i.type === 'task').length;
    const events = items.filter(i => i.type === 'event').length;
    const notes = items.filter(i => i.type === 'note').length;

    console.log(
      `✅ ${items.length} item(s) | ⏱️ ${processingTime}ms | 📊 ${tasks}T ${events}E ${notes}N`
    );

    items.forEach((item, i) => {
      const conf = item.metadata?.confidence
        ? ` (${(item.metadata.confidence * 100).toFixed(0)}%)`
        : '';
      const warn = item.metadata?.warnings?.length ? ` ⚠️` : '';
      console.log(`   [${item.type.toUpperCase()}]${conf}${warn} ${item.text || item.title}`);
      if (item.date)
        console.log(`            📅 ${item.date}${item.start_time ? ' ' + item.start_time : ''}`);
      if (item.metadata?.warnings?.length) {
        item.metadata.warnings.forEach(w => console.log(`            ⚠️  ${w}`));
      }
    });

    if (result.parsing_notes) {
      console.log(`   💭 ${result.parsing_notes}`);
    }

    return { success: true, items };
  } catch (error) {
    console.log(`💥 ${error.message}`);
    return { success: false };
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║             🧠 TEST HARDCORE PARSER SECOND BRAIN 🧠                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const tests = [
    // Basiques
    ['1. Task simple', 'Appeler le client Dupont'],
    ['2. Task urgente', 'URGENT envoyer le devis à Martin'],
    ['3. Event avec heure', 'RDV dentiste demain 14h30'],
    ['4. Note explicite', 'Idée: utiliser GraphQL pour le dashboard'],

    // Multi-items
    [
      '5. Multi-items (3)',
      'Appeler Marie et envoyer le rapport à Paul et noter que le budget est validé',
    ],
    [
      '6. Dates différentes',
      'Demain finir le rapport et lundi rdv archi 10h et mardi préparer présentation',
    ],

    // Événements
    ['7. Déjeuner = EVENT', 'Déjeuner client Dupont samedi'],
    ['8. Event + task', 'RDV banquier lundi 9h et amener les relevés'],

    // Cas ambigus
    ['9. Préparer réunion = TASK', 'Préparer la réunion de 14h'],
    ['10. Appeler sans heure = TASK', 'Appeler Marie demain pour le projet'],
    ['11. Appeler avec heure = EVENT', 'Appeler Marie demain 14h'],

    // Edge cases
    ['12. Heure bizarre (warning)', 'RDV plombier 5h du matin'],
    [
      '13. Texte long',
      `Appeler Dupont urgent pour le devis et rdv archi 14h bureau et préparer présentation vendredi
                        et idée utiliser MongoDB et noter budget limité 25000€ et déjeuner équipe lundi`,
    ],

    // Langage parlé
    ['14. SMS/abrégé', 'rdv dr martin 2m 10h30 + appeler marc asap + idee notifs push'],
    [
      '15. Flux dicté',
      "alors faut rappeler dupont urgent et j'ai rdv avec l'archi demain à 14h et j'ai eu une idée pour le cache",
    ],
  ];

  let passed = 0;
  const results = [];

  for (const [name, input] of tests) {
    const result = await testParser(name, input);
    results.push({ name, input, ...result });
    if (result.success) passed++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n' + '═'.repeat(80));
  console.log(`📊 RÉSULTAT: ${passed}/${tests.length} tests réussis`);
  console.log('═'.repeat(80));
}

runTests().catch(console.error);
