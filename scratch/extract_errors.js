import fs from 'fs';

const logFile = 'c:\\Users\\Imran hossan\\store\\Codalina-backend\\logs\\app.log';
const content = fs.readFileSync(logFile, 'utf8');
const lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('Cast to embedded failed')) {
    console.log('--- ERROR FOUND ---');
    // Print 20 lines after the error to see the full value
    for (let j = 0; j < 20; j++) {
      if (lines[i + j]) console.log(lines[i + j]);
    }
  }
}
