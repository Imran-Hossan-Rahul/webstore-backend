import fs from 'fs';

const rawCode = fs.readFileSync('scratch/publish_phase_1_3.js', 'utf8');

// We want to extract the topics.
// Let's find the start of each topic by searching for `title:` or the object brackets.
// Since the file has 10 topics, we can find the start of each one.
// Let's write a custom parser that reads the file line-by-line.

const lines = rawCode.split(/\r?\n/);
const topics = [];
let currentTopic = null;
let isCollectingContent = false;
let contentLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  if (line.startsWith('title: "')) {
    // Start of a new topic object!
    if (currentTopic) {
      // Save previous topic if any (though content collector handles it usually)
    }
    const title = line.substring('title: "'.length, line.length - 2); // remove ", at the end
    currentTopic = { title, tags: [], category: '', readTime: '', content: '' };
    isCollectingContent = false;
    contentLines = [];
    continue;
  }

  if (currentTopic) {
    if (line.startsWith('subtitle: "')) {
      currentTopic.subtitle = line.substring('subtitle: "'.length, line.length - 2);
    } else if (line.startsWith('tags: [')) {
      // parse tags array, e.g. ["http", "networking"]
      const tagsStr = line.substring('tags: ['.length, line.indexOf('],'));
      currentTopic.tags = tagsStr.split(',').map(t => t.trim().replace(/"/g, ''));
    } else if (line.startsWith('category: "')) {
      currentTopic.category = line.substring('category: "'.length, line.length - 2);
    } else if (line.startsWith('readTime: "')) {
      currentTopic.readTime = line.substring('readTime: "'.length, line.length - 2);
    } else if (line.startsWith('content: `')) {
      isCollectingContent = true;
      // Start collecting content, remove 'content: `' from the beginning
      const rawContentStart = lines[i].trim().substring('content: `'.length);
      contentLines.push(rawContentStart);
    } else if (isCollectingContent) {
      // Check if this line ends the content
      if (line.endsWith('`') || line.endsWith('`,') || (line === '`' || line === '},' || line === '},' || line === '  },')) {
        // Wait, the content ends with </div></div>` or similar
        let lastLine = lines[i];
        let ended = false;
        if (lastLine.includes('</div></div>`')) {
          const contentEndIndex = lastLine.lastIndexOf('</div></div>`');
          contentLines.push(lastLine.substring(0, contentEndIndex + '</div></div>'.length));
          ended = true;
        } else if (lastLine.trim() === '`' || lastLine.trim() === '},' || lastLine.trim() === '},') {
          ended = true;
        }

        if (ended) {
          isCollectingContent = false;
          // Combine content and clean it up
          let fullContent = contentLines.join('\n');
          
          // Clean stray line numbers inside the content (e.g. "18: ", "19: ", etc. at the start of a line)
          // Also handle lines like "83: 18: " or "127: 18:" where the model copy-pasted double numbers
          // Let's use a regex to clean up line numbers like "127: 18:" or "25: "
          fullContent = fullContent.split('\n').map(l => {
            // Remove line numbers at start of line inside content: e.g. "26:   |" -> "  |" or "18: " -> ""
            // Let's match optional leading whitespace, then digits, followed by a colon and optional spaces, repeatedly
            let cleaned = l;
            while (/^\s*\d+:\s*/.test(cleaned)) {
              cleaned = cleaned.replace(/^\s*\d+:\s*/, '');
            }
            return cleaned;
          }).join('\n');

          currentTopic.content = fullContent;
          topics.push(currentTopic);
          currentTopic = null;
        } else {
          contentLines.push(lines[i]);
        }
      } else {
        contentLines.push(lines[i]);
      }
    }
  }
}

console.log("Successfully parsed topics count:", topics.length);
topics.forEach((t, index) => {
  console.log(`Topic ${index + 1}: ${t.title} (content length: ${t.content.length})`);
});

// Write to JSON file
fs.writeFileSync('scratch/topics.json', JSON.stringify(topics, null, 2), 'utf8');
console.log("✅ Wrote clean topics to scratch/topics.json!");
