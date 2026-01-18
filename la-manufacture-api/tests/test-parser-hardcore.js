/**
 * TEST HARDCORE DU PARSER SECOND BRAIN
 *
 * Ce script teste le prompt de parsing avec des cas variés et difficiles.
 * Usage: node tests/test-parser-hardcore.js
 */

import 'dotenv/config';

const API_URL = process.env.API_URL || 'http://localhost:3001';

// Simuler un token pour les tests (à adapter selon votre auth)
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  // Ajouter votre méthode d'auth ici si nécessaire
});

async function testParser(testName, inputText) {
  console.log('\n' + '═'.repeat(80));
  console.log(`🧪 TEST: ${testName}`);
  console.log('─'.repeat(80));
  console.log(`📝 Input: "${inputText}"`);
  console.log('─'.repeat(80));

  try {
    const response = await fetch(`${API_URL}/api/ai/process-inbox`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ text: inputText }),
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Succès! ${result.items.length} item(s) créé(s)`);
      console.log(`⏱️  Temps: ${result.processing_time_ms}ms`);
      console.log(
        `📊 Stats: ${result.stats.tasks} tasks, ${result.stats.events} events, ${result.stats.notes} notes`
      );

      result.items.forEach((item, i) => {
        console.log(`\n  [${i + 1}] ${item.type.toUpperCase()}`);
        if (item.text) console.log(`      Text: ${item.text}`);
        if (item.title) console.log(`      Title: ${item.title}`);
        if (item.date) console.log(`      Date: ${item.date}`);
        if (item.google_synced) console.log(`      📅 Google: synced`);
      });
    } else {
      console.log(`❌ Erreur: ${result.error}`);
    }

    return result;
  } catch (error) {
    console.log(`💥 Exception: ${error.message}`);
    return null;
  }
}

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           🧠 TEST HARDCORE DU PARSER SECOND BRAIN 🧠                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');

  const tests = [
    // ═══════════════════════════════════════════════════════════════════════
    // TESTS BASIQUES
    // ═══════════════════════════════════════════════════════════════════════

    ['Task simple', 'Appeler le client Dupont'],

    ['Task urgente', 'URGENT envoyer le devis à Martin avant ce soir'],

    ['Event avec heure', 'RDV dentiste demain 14h30'],

    ['Note explicite', 'Idée: utiliser GraphQL pour le nouveau dashboard'],

    // ═══════════════════════════════════════════════════════════════════════
    // TESTS MULTI-ITEMS (Texte parlé/dicté)
    // ═══════════════════════════════════════════════════════════════════════

    [
      'Multi-items séparés par "et"',
      'Appeler Marie et envoyer le rapport à Paul et noter que le budget est validé',
    ],

    [
      'Multi-items avec dates différentes',
      "Demain faut finir le rapport et lundi j'ai rdv avec l'architecte à 10h et mardi préparer la présentation",
    ],

    [
      'Flux dicté sans ponctuation',
      "alors faut que je rappelle dupont urgent et j'ai eu une idée pour le dashboard avec du redis et jeudi j'ai déjeuner avec marie à midi",
    ],

    // ═══════════════════════════════════════════════════════════════════════
    // TESTS ÉVÉNEMENTS COMPLEXES
    // ═══════════════════════════════════════════════════════════════════════

    ['Event avec lieu', 'Réunion équipe vendredi 15h salle Einstein'],

    ['Déjeuner (doit être EVENT)', 'Déjeuner client Dupont samedi'],

    ['Event + task liée', 'RDV banquier lundi 9h et penser à amener les relevés de compte'],

    ['Appel avec heure = EVENT', "Call avec l'équipe US à 18h heure française"],

    // ═══════════════════════════════════════════════════════════════════════
    // TESTS NOTES COMPLEXES
    // ═══════════════════════════════════════════════════════════════════════

    ['Note avec préfixe !', '! ne pas oublier le code promo SUMMER2024 pour le client'],

    ['Note information factuelle', 'Le budget marketing 2026 est de 50000 euros'],

    [
      'Note technique structurée',
      'Idée architecture: frontend React TypeScript, backend Node Express, base PostgreSQL, cache Redis',
    ],

    // ═══════════════════════════════════════════════════════════════════════
    // TESTS DATES RELATIVES
    // ═══════════════════════════════════════════════════════════════════════

    ['Date "après-demain"', 'Envoyer le contrat après-demain'],

    ['Date "fin de semaine"', 'Finaliser le projet pour fin de semaine'],

    ['Date "dans 3 jours"', 'Relancer le client dans 3 jours'],

    ['Date "ce weekend"', 'Préparer la présentation ce weekend'],

    // ═══════════════════════════════════════════════════════════════════════
    // TESTS CAS AMBIGUS
    // ═══════════════════════════════════════════════════════════════════════

    ['Ambigu: Préparer réunion (TASK pas EVENT)', 'Préparer la réunion de 14h'],

    ['Ambigu: Appeler sans heure (TASK)', 'Appeler Marie demain pour le projet'],

    ['Ambigu: Appeler avec heure (EVENT)', 'Appeler Marie demain à 14h pour le projet'],

    // ═══════════════════════════════════════════════════════════════════════
    // TESTS EXTRÊMES
    // ═══════════════════════════════════════════════════════════════════════

    ['Heure inhabituelle (warning attendu)', 'RDV plombier à 5h du matin'],

    [
      'Texte très long avec multiples items',
      `Bon alors aujourd'hui faut que je fasse plein de trucs d'abord appeler le client Dupont
      c'est urgent pour le devis ensuite j'ai rdv avec l'archi à 14h à son bureau pour voir
      les plans et après je dois préparer la présentation pour vendredi ah et j'ai eu une super
      idée pour le projet on pourrait utiliser une base NoSQL MongoDB à la place de PostgreSQL
      et aussi faut pas oublier que le budget est limité à 25000 euros et lundi prochain
      déjeuner avec l'équipe marketing`,
    ],

    [
      'Langage SMS/abrégé',
      'rdv dr martin 2m 10h30 + appeler marc asap urgent + idee: ajouter notifs push',
    ],

    [
      'Mélange français/anglais',
      'Meeting avec le team US tomorrow 3pm + call avec product owner + noter que la feature est in progress',
    ],

    // ═══════════════════════════════════════════════════════════════════════
    // TESTS MÉTIER SPÉCIFIQUES
    // ═══════════════════════════════════════════════════════════════════════

    [
      'Contexte BTP/Chantier',
      'Visite chantier Martin jeudi 8h sur place + commander 50 sacs de ciment + rdv mairie pour permis vendredi 11h',
    ],

    [
      'Contexte Commercial',
      'Envoyer proposition commerciale Dupont urgent 15000€ HT + relancer prospect Durand + noter que Martin veut 10% de remise',
    ],

    [
      'Contexte IT/Dev',
      'Déployer hotfix prod urgent + code review PR #123 + réunion sprint planning lundi 9h30 + idée: refactorer le module auth',
    ],

    // ═══════════════════════════════════════════════════════════════════════
    // TESTS EDGE CASES
    // ═══════════════════════════════════════════════════════════════════════

    [
      'Texte avec emojis',
      '🔴 URGENT appeler client 📞 + ✅ valider le budget + 💡 idée: nouveau logo',
    ],

    [
      'Répétition/Reformulation (ne pas dupliquer)',
      'Appeler Marie enfin je veux dire envoyer un email à Marie pour confirmer',
    ],

    ['Négation', "Ne pas oublier de signer le contrat + ne plus utiliser l'ancienne API"],
  ];

  let passed = 0;
  let failed = 0;

  for (const [name, input] of tests) {
    const result = await testParser(name, input);
    if (result && result.success) {
      passed++;
    } else {
      failed++;
    }

    // Pause entre les tests pour ne pas surcharger l'API
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                           📊 RÉSUMÉ DES TESTS                               ║');
  console.log('╠════════════════════════════════════════════════════════════════════════════╣');
  console.log(
    `║  ✅ Réussis: ${passed}                                                           ║`
  );
  console.log(
    `║  ❌ Échoués: ${failed}                                                           ║`
  );
  console.log(
    `║  📈 Total: ${tests.length}                                                            ║`
  );
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
}

// Run tests
runAllTests().catch(console.error);
