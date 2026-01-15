import fs from 'fs';
const env = fs.readFileSync('.env', 'utf8');
const dbLine = env.split('\n').find(l => l.startsWith('DATABASE_URL='));
if (dbLine) {
    const parts = dbLine.split('@');
    if (parts.length > 1) {
        console.log('DB HOST:', parts[1]);
    } else {
        console.log('DB LINE:', dbLine);
    }
} else {
    console.log('DB URL NOT FOUND');
}
