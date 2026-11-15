#!/usr/bin/env node
/**
 * Chef Mom - Automated Database Provisioning Script
 * 
 * Ensures data/pantrymuse.db is present, fully uncompressed, valid SQLite format,
 * and ready for both Next.js build-time static generation and production serverless execution.
 * 
 * If data/pantrymuse.db is missing or is an unsmudged Git LFS pointer file (< 1MB),
 * this script decompresses data/pantrymuse.db.gz directly.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Database = require('better-sqlite3');

const ROOT_DIR = path.resolve(__dirname, '..');
const DB_PATH = path.join(ROOT_DIR, 'data', 'pantrymuse.db');
const GZ_PATH = path.join(ROOT_DIR, 'data', 'pantrymuse.db.gz');

function isValidSqliteFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 1000000) return false; // LFS pointers are ~130 bytes

    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);

    return header.toString('utf8', 0, 15) === 'SQLite format 3';
  } catch {
    return false;
  }
}

function prepareDatabase() {
  console.log('[Chef Mom DB] Verifying recipe database readiness...');

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbValid = isValidSqliteFile(DB_PATH);

  if (!dbValid) {
    if (!fs.existsSync(GZ_PATH)) {
      console.error(`[Chef Mom DB] ERROR: Neither valid database nor compressed archive found at ${GZ_PATH}!`);
      process.exit(1);
    }

    console.log(`[Chef Mom DB] Extracting database archive ${GZ_PATH} -> ${DB_PATH}...`);
    const t0 = Date.now();
    const gzipped = fs.readFileSync(GZ_PATH);
    const uncompressed = zlib.gunzipSync(gzipped);
    fs.writeFileSync(DB_PATH, uncompressed);
    const t1 = Date.now();
    console.log(`[Chef Mom DB] Extracted ${(uncompressed.length / (1024 * 1024)).toFixed(2)} MB in ${t1 - t0} ms.`);
  } else {
    console.log(`[Chef Mom DB] Existing database at ${DB_PATH} is valid.`);
  }

  // Verify database schema and record count
  try {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = DELETE');
    db.pragma('query_only = ON');

    const countRow = db.prepare('SELECT count(*) as count FROM recipes').get();
    const ingRow = db.prepare('SELECT count(*) as count FROM recipe_ingredients').get();
    const libRow = db.prepare('SELECT count(*) as count FROM ingredients_library').get();

    db.close();

    console.log(`[Chef Mom DB] SUCCESS: Verified ${countRow.count} recipes, ${ingRow.count} ingredient links, ${libRow.count} library items.`);

    // If .gz file doesn't exist or is older, create/update it
    if (!fs.existsSync(GZ_PATH)) {
      console.log(`[Chef Mom DB] Creating ${GZ_PATH} archive...`);
      const src = fs.readFileSync(DB_PATH);
      const compressed = zlib.gzipSync(src, { level: 9 });
      fs.writeFileSync(GZ_PATH, compressed);
      console.log(`[Chef Mom DB] Created ${GZ_PATH} (${(compressed.length / (1024 * 1024)).toFixed(2)} MB).`);
    }
  } catch (err) {
    console.error('[Chef Mom DB] Verification failed:', err);
    process.exit(1);
  }
}

prepareDatabase();
