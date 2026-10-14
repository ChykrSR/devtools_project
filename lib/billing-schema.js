'use strict';
const fs = require('node:fs');
const path = require('node:path');

// Only the marked billing block is run on an existing database. Never re-run the legacy init.
module.exports = async function prepareBillingSchema(db) {
  try {
    const source = fs.readFileSync(path.join(__dirname, '../init.sql'), 'utf8');
    const match = source.match(/-- BEGIN BILLING SCHEMA\r?\n([\s\S]*?)-- END BILLING SCHEMA/);
    if (!match) throw new Error('Billing schema block missing from init.sql');
    const statements = match[1].replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim());
    for (const sql of statements) await db.query(sql);
    console.log('Billing tables ready');
    return true;
  } catch (error) {
    console.error('Billing setup failed:', error.code || error.message);
    return false; // Existing application routes still start and work independently.
  }
};
