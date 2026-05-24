import fs from 'fs';

const topics = JSON.parse(fs.readFileSync('scratch/topics.json', 'utf8'));

// Print Topic 5 (index 4) title and code blocks
console.log("=== TOPIC 5: " + topics[4].title + " ===");
console.log("Content preview (part of it):");
const content5 = topics[4].content;
const codeIndex = content5.indexOf('<pre><code class="language-javascript">');
if (codeIndex !== -1) {
  console.log(content5.substring(codeIndex, codeIndex + 600));
} else {
  console.log(content5.substring(0, 500));
}

// Print Topic 6 (index 5) title and code blocks
console.log("\n=== TOPIC 6: " + topics[5].title + " ===");
console.log("Content preview (part of it):");
const content6 = topics[5].content;
const codeIndex6 = content6.indexOf('<pre><code class="language-javascript">');
if (codeIndex6 !== -1) {
  console.log(content6.substring(codeIndex6, codeIndex6 + 600));
} else {
  console.log(content6.substring(0, 500));
}
