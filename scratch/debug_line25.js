import fs from 'fs';

const content = fs.readFileSync('scratch/publish_phase_1_3.js', 'utf8');
const lines = content.split(/\r?\n/);
const line25 = lines[24]; // 25th line (0-indexed 24)

console.log("Line 25 length:", line25.length);

// Search for any unescaped backticks
const backticks = [];
const btRegex = /`/g;
let btMatch;
while ((btMatch = btRegex.exec(line25)) !== null) {
  // Check if it is escaped
  const isEscaped = line25[btMatch.index - 1] === '\\';
  backticks.push({ index: btMatch.index, escaped: isEscaped, context: line25.substring(btMatch.index - 5, btMatch.index + 15) });
}
console.log("Backticks found:", backticks);

// Search for any dollar signs
const dollars = [];
const dRegex = /\$/g;
let dMatch;
while ((dMatch = dRegex.exec(line25)) !== null) {
  dollars.push({ index: dMatch.index, context: line25.substring(dMatch.index - 5, dMatch.index + 15) });
}
console.log("Dollars found:", dollars);
