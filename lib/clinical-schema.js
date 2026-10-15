'use strict';
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function prepareClinicalSchema(db) {
  try {
    const source = fs.readFileSync(path.join(__dirname, '../init.sql'), 'utf8');
    const match = source.match(/-- BEGIN CLINICAL SCHEMA\r?\n([\s\S]*?)-- END CLINICAL SCHEMA/);
    if (!match) throw new Error('Clinical schema block missing from init.sql');

    const statements = match[1].replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim());
    for (const sql of statements) await db.query(sql);
    console.log('Clinical tables ready');
    return true;
  } catch (error) {
    console.error('Clinical setup failed:', error.code || error.message);
    return false;
  }
};