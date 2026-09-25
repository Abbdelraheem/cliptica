import pg from 'pg';
const { Client } = pg;

const neonUrl = 'postgresql://neondb_owner:npg_lwiLu8bX2xkW@ep-empty-wave-ax7vmoho-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function testNeon() {
  const client = new Client({ connectionString: neonUrl, connectionTimeoutMillis: 10000 });
  try {
    console.log('Connecting to Neon...');
    await client.connect();
    console.log('Connected to Neon successfully!');
    const res = await client.query('SELECT count(*) FROM "User"');
    console.log('Neon User count:', res.rows[0].count);
    const users = await client.query('SELECT id, email, role, "passwordHash", "createdAt" FROM "User"');
    console.log('Neon Users:', users.rows.map(u => ({ email: u.email, role: u.role, created: u.createdAt })));
    await client.end();
  } catch (e) {
    console.error('Neon Error:', e.message);
  }
}

testNeon();
