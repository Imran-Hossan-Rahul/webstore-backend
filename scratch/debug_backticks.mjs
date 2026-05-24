import fs from 'fs';

const content = fs.readFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/publish_phase_1_5.js', 'utf8');

const title = "Using Native process.env to Load API Configurations";
const titleIdx = content.indexOf(`title: "${title}"`);
console.log("titleIdx:", titleIdx);

const contentIdx = content.indexOf('content: `', titleIdx);
const contentStart = contentIdx + 10;
console.log("contentStart:", contentStart);

let searchPos = contentStart;
while (true) {
  const backtickIdx = content.indexOf('`', searchPos);
  if (backtickIdx === -1) {
    console.log("No more backticks found.");
    break;
  }
  const rest = content.substring(backtickIdx + 1, backtickIdx + 40);
  console.log(`Found backtick at ${backtickIdx}. Rest (trimmed): "${rest.trim().substring(0, 20)}"`);
  searchPos = backtickIdx + 1;
}
