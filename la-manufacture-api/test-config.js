// Script de test de configuration
import dotenv from 'dotenv';
import pg from 'pg';
import { sendTestEmail, verifyEmailConfig } from './src/services/email.js';

dotenv.config();

const { Pool } = pg;

console.log('\n🔍 Test de Configuration - La Manufacture OS\n');
console.log('='.repeat(50));

// Test 1: Variables d'environnement
console.log("\n1️⃣  Variables d'environnement");
console.log('-'.repeat(50));

const requiredVars = [
  'DATABASE_URL',
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'FRONTEND_URL',
];

const missingVars = [];
requiredVars.forEach(varName => {
  const value = process.env[varName];
  const status = value && value !== 'A_REMPLIR' && value !== 'A_REMPLIRE' ? '✅' : '❌';
  console.log(
    `${status} ${varName}: ${value ? (value.includes('REMPLIR') ? 'À CONFIGURER' : '✓ Configuré') : 'Manquant'}`
  );
  if (!value || value.includes('REMPLIR')) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log(`\n⚠️  Variables à configurer: ${missingVars.join(', ')}`);
  console.log('Consultez le GUIDE_CONFIGURATION.md pour les instructions.\n');
}

// Test 2: Connexion Base de Données
console.log('\n2️⃣  Connexion Base de Données');
console.log('-'.repeat(50));

async function testDatabase() {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('REMPLIR')) {
    console.log('❌ DATABASE_URL non configuré');
    return false;
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : false,
    });

    const result = await pool.query('SELECT version(), current_database()');
    console.log('✅ Connexion réussie');
    console.log(
      `   Version: ${result.rows[0].version.split(' ')[0]} ${result.rows[0].version.split(' ')[1]}`
    );
    console.log(`   Database: ${result.rows[0].current_database}`);

    // Vérifier si les tables existent
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN ('users', 'team_members', 'team_invitations', 'projects')
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log('✅ Tables existantes:');
      tablesResult.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('⚠️  Aucune table détectée. La migration se lancera au démarrage du serveur.');
    }

    await pool.end();
    return true;
  } catch (error) {
    console.log('❌ Erreur de connexion');
    console.log(`   ${error.message}`);
    return false;
  }
}

// Test 3: Configuration Email
console.log('\n3️⃣  Configuration Email (SMTP)');
console.log('-'.repeat(50));

async function testEmail() {
  if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('REMPLIR')) {
    console.log('❌ SMTP_USER non configuré');
    return false;
  }
  if (!process.env.SMTP_PASS || process.env.SMTP_PASS.includes('REMPLIR')) {
    console.log('❌ SMTP_PASS non configuré');
    return false;
  }

  try {
    console.log('🔄 Vérification de la connexion SMTP...');
    const isValid = await verifyEmailConfig();

    if (isValid) {
      console.log('✅ Configuration SMTP valide');
      console.log(`   Host: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
      console.log(`   User: ${process.env.SMTP_USER}`);

      // Proposer d'envoyer un email de test
      console.log('\n📧 Voulez-vous envoyer un email de test ?');
      console.log('   Pour tester: node test-config.js --send-test-email votre-email@example.com');
      return true;
    } else {
      console.log('❌ Configuration SMTP invalide');
      console.log('   Vérifiez SMTP_USER et SMTP_PASS dans .env');
      return false;
    }
  } catch (error) {
    console.log('❌ Erreur SMTP');
    console.log(`   ${error.message}`);
    return false;
  }
}

// Exécution des tests
async function runTests() {
  const dbOk = await testDatabase();
  const emailOk = await testEmail();

  // Résumé
  console.log('\n' + '='.repeat(50));
  console.log('📊 Résumé');
  console.log('='.repeat(50));
  console.log(`Base de données: ${dbOk ? '✅ OK' : '❌ À configurer'}`);
  console.log(`Email (SMTP):    ${emailOk ? '✅ OK' : '❌ À configurer'}`);
  console.log(
    `Variables:       ${missingVars.length === 0 ? '✅ OK' : `❌ ${missingVars.length} manquante(s)`}`
  );

  if (dbOk && emailOk && missingVars.length === 0) {
    console.log('\n🎉 Configuration complète ! Vous pouvez démarrer le serveur:');
    console.log('   npm run dev');
  } else {
    console.log('\n⚠️  Configuration incomplète. Consultez GUIDE_CONFIGURATION.md');
  }

  console.log('');
}

// Commande pour envoyer un email de test
const args = process.argv.slice(2);
if (args[0] === '--send-test-email' && args[1]) {
  console.log(`\n📧 Envoi d'un email de test à ${args[1]}...`);
  sendTestEmail(args[1])
    .then(result => {
      if (result.success) {
        console.log('✅ Email envoyé avec succès !');
        console.log(`   Message ID: ${result.messageId}`);
        console.log('   Vérifiez votre boîte mail.');
      } else {
        console.log("❌ Erreur d'envoi");
        console.log(`   ${result.error}`);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch(err => {
      console.log('❌ Erreur:', err.message);
      process.exit(1);
    });
} else {
  runTests().then(() => process.exit(0));
}
