import fs from 'fs';

const content = fs.readFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/publish_phase_1_5.js', 'utf8');

const topics = [];
let pos = 0;

while (true) {
  const titleIdx = content.indexOf('title: "', pos);
  if (titleIdx === -1) break;
  
  // Extract Title
  const titleEnd = content.indexOf('",', titleIdx);
  const title = content.substring(titleIdx + 8, titleEnd);
  
  // Extract Subtitle
  const subtitleIdx = content.indexOf('subtitle: "', titleEnd);
  const subtitleEnd = content.indexOf('",', subtitleIdx);
  const subtitle = content.substring(subtitleIdx + 11, subtitleEnd);
  
  // Extract Tags
  const tagsIdx = content.indexOf('tags: [', subtitleEnd);
  const tagsEnd = content.indexOf('],', tagsIdx);
  const tagsStr = content.substring(tagsIdx + 7, tagsEnd);
  const tags = tagsStr.split(',').map(t => t.trim().replace(/"/g, '').replace(/'/g, ''));
  
  // Extract Category
  const categoryIdx = content.indexOf('category: "', tagsEnd);
  const categoryEnd = content.indexOf('",', categoryIdx);
  const category = content.substring(categoryIdx + 11, categoryEnd);
  
  // Extract ReadTime
  const readTimeIdx = content.indexOf('readTime: "', categoryEnd);
  const readTimeEnd = content.indexOf('",', readTimeIdx);
  const readTime = content.substring(readTimeIdx + 11, readTimeEnd);
  
  // Extract Content
  const contentIdx = content.indexOf('content: `', readTimeEnd);
  const contentStart = contentIdx + 10;
  
  let contentEnd = -1;
  let searchPos = contentStart;
  while (true) {
    const backtickIdx = content.indexOf('`', searchPos);
    if (backtickIdx === -1) break;
    
    // Get subsequent text and strip all whitespaces to normalize checking
    const subsequent = content.substring(backtickIdx + 1, backtickIdx + 100);
    const normalized = subsequent.replace(/\s+/g, '');
    
    if (normalized.startsWith('},{') || normalized.startsWith('}]') || normalized.startsWith(',') || normalized.startsWith(']')) {
      contentEnd = backtickIdx;
      break;
    }
    searchPos = backtickIdx + 1;
  }
  
  if (contentEnd === -1) {
    console.error("Could not find end of content for topic:", title);
    break;
  }
  
  const body = content.substring(contentStart, contentEnd);
  
  topics.push({
    title,
    subtitle,
    tags,
    category,
    readTime,
    content: body
  });
  
  pos = contentEnd + 1;
}

fs.writeFileSync('c:/Users/Imran hossan/store/webstore-backend/scratch/articles.json', JSON.stringify(topics, null, 2));
console.log(`✅ Extracted ${topics.length} topics successfully to articles.json!`);
