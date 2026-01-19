#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║                         FLOW PWA Icon Generator                              ║
// ║        Generates all required PNG icons for App Store / Play Store           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'public', 'icons');

// FLOW brand colors
const BG_COLOR = '#050505';
const ACCENT_COLOR = '#0A84FF';
const TEXT_COLOR = '#FFFFFF';

// Icon sizes to generate
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

/**
 * Generate main app icon (letter "F" centered)
 */
function generateMainIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background with rounded corners (for maskable)
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, size, size);

  // Letter "F" - FLOW style
  const fontSize = Math.floor(size * 0.55);
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif`;
  ctx.fillStyle = ACCENT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size / 2, size / 2 + size * 0.02);

  return canvas.toBuffer('image/png');
}

/**
 * Generate shortcut icon with symbol
 */
function generateShortcutIcon(size, symbol) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, size, size);

  // Symbol
  const fontSize = Math.floor(size * 0.45);
  ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = ACCENT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, size / 2, size / 2);

  return canvas.toBuffer('image/png');
}

/**
 * Generate notification badge (smaller, simpler)
 */
function generateBadgeIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Circular badge background
  ctx.fillStyle = ACCENT_COLOR;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // White "F"
  const fontSize = Math.floor(size * 0.5);
  ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('F', size / 2, size / 2 + size * 0.02);

  return canvas.toBuffer('image/png');
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

console.log('🎨 FLOW PWA Icon Generator\n');

// Create icons directory
if (!existsSync(ICONS_DIR)) {
  mkdirSync(ICONS_DIR, { recursive: true });
  console.log(`📁 Created: ${ICONS_DIR}\n`);
}

// Generate main icons at all sizes
console.log('📱 Generating main icons...');
for (const size of ICON_SIZES) {
  const filename = `icon-${size}x${size}.png`;
  const buffer = generateMainIcon(size);
  writeFileSync(join(ICONS_DIR, filename), buffer);
  console.log(`   ✓ ${filename}`);
}

// Generate shortcut icons
console.log('\n🔗 Generating shortcut icons...');
const shortcuts = [
  { name: 'add-icon.png', symbol: '+' },
  { name: 'today-icon.png', symbol: '☀' },
  { name: 'mic-icon.png', symbol: '🎤' },
];

for (const { name, symbol } of shortcuts) {
  const buffer = generateShortcutIcon(96, symbol);
  writeFileSync(join(ICONS_DIR, name), buffer);
  console.log(`   ✓ ${name}`);
}

// Generate notification badge
console.log('\n🔔 Generating notification badge...');
const badgeBuffer = generateBadgeIcon(72);
writeFileSync(join(ICONS_DIR, 'badge-72x72.png'), badgeBuffer);
console.log('   ✓ badge-72x72.png');

console.log('\n✅ All icons generated successfully!');
console.log(`📂 Location: ${ICONS_DIR}`);
