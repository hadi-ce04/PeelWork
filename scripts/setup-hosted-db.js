// One-time initialization for an empty hosted database. Never drops a database.
require('dotenv').config({ path: process.argv[2] || '.env.deploy', quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const db = require('../db');

async function main() {
  const connection = await db.getConnection();
  try {
    const [tables] = await connection.query('SHOW TABLES');
    if (tables.length) throw new Error('Initialization refused: target database is not empty.');
    const root = path.join(__dirname, '..');
    const schema = fs.readFileSync(path.join(root, 'schema.sql'), 'utf8')
      .replace(/^DROP DATABASE[^;]*;\s*/im, '')
      .replace(/^CREATE DATABASE[^;]*;\s*/im, '')
      .replace(/^USE[^;]*;\s*/im, '');
    for (const statement of schema.split(';').filter(s => s.trim())) {
      await connection.query(statement);
    }
    // Seed sample jobs, but replace all public development passwords.
    const seed = fs.readFileSync(path.join(root, 'seed.sql'), 'utf8')
      .split('-- Passwords')[0].replace(/^USE[^;]*;\s*/im, '');
    const accounts = [
      { name: 'Super Admin', email: 'admin@hireloop.com', role: 'super_admin', company: null },
      { name: 'TechCorp Admin', email: 'techcorp@hireloop.com', role: 'company_admin', company: 1 },
      { name: 'DesignStudio Admin', email: 'designstudio@hireloop.com', role: 'company_admin', company: 2 },
      { name: 'Demo Candidate', email: 'user@hireloop.com', role: 'candidate', company: null }
    ].map(account => ({ ...account, password: crypto.randomBytes(18).toString('base64url') }));
    // Save generated credentials in a git-ignored file before inserting accounts.
    fs.writeFileSync(path.join(root, '.env.demo-accounts'), JSON.stringify(accounts, null, 2), { flag: 'wx' });
    await connection.beginTransaction();
    try {
      for (const statement of seed.split(';').filter(s => s.trim())) await connection.query(statement);
      for (const account of accounts) {
        await connection.execute(
          'INSERT INTO people (name, email, password, role, company_id) VALUES (?, ?, ?, ?, ?)',
          [account.name, account.email, crypto.createHash('sha256').update(account.password).digest('hex'), account.role, account.company]
        );
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    }
    console.log('Hosted database initialized: schema, sample jobs, and four accounts with random passwords.');
    console.log('Credentials saved locally in the git-ignored .env.demo-accounts file.');
  } finally {
    connection.release();
    await db.end();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
