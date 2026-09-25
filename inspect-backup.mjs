import fs from 'fs';

const file = '/opt/nology-backups/nology-backup-20260909-214800/database.json';
const json = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log('Exported at:', json.exportedAt);
console.log('Counts:', json.counts);
if (json.data) {
  console.log('Tables in data:', Object.keys(json.data));
  const users = json.data.users || json.data.User || [];
  console.log(`=== USERS IN BACKUP (${users.length}) ===`);
  for (const u of users) {
    console.log(`- [${u.role}] ${u.email} | name: ${u.name} | credits: ${u.credits} | verified: ${!!u.emailVerified} | hasPassword: ${!!u.passwordHash}`);
  }
}
