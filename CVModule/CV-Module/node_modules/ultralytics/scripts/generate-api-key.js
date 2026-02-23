#!/usr/bin/env node

/**
 * Generate a new API key for Ultralytics
 * Usage: node scripts/generate-api-key.js <name>
 */

const crypto = require('crypto');
const db = require('../dist/db');

async function generateApiKey(name) {
  if (!name) {
    console.error('Usage: node scripts/generate-api-key.js <name>');
    console.error('Example: node scripts/generate-api-key.js "Production App"');
    process.exit(1);
  }

  try {
    // Generate a random API key
    const apiKey = 'ul_' + crypto.randomBytes(24).toString('hex');
    
    // Hash the key for storage
    const keyHash = crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');

    // Store the hashed key in the database
    await db.query(
      'INSERT INTO api_keys (key_hash, name) VALUES ($1, $2)',
      [keyHash, name]
    );

    console.log('\nAPI Key Generated Successfully!');
    console.log('================================');
    console.log(`Name: ${name}`);
    console.log(`Key:  ${apiKey}`);
    console.log('\n⚠️  Save this key now - it cannot be retrieved later!');
    console.log('Use this key in the X-API-Key header for API requests.\n');

    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Error generating API key:', error.message);
    await db.close();
    process.exit(1);
  }
}

const keyName = process.argv[2];
generateApiKey(keyName);
