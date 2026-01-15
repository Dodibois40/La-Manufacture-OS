import fs from 'fs';
const env = fs.readFileSync('.env.local', 'utf8');
console.log(env.split('\n').filter(l => l.includes('URL')).join('\n'));
