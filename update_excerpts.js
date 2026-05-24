import { MongoClient } from 'mongodb';

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
}

async function run() {
  const uri = 'mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('test');
    
    // Find all codices
    const codices = await db.collection('codexs').find({}).toArray();
    console.log(`Found ${codices.length} codices`);
    
    for (const c of codices) {
      if (c.content) {
        let text = stripHtml(c.content);
        let newExcerpt = text.substring(0, 800) + "..";
        await db.collection('codexs').updateOne({ _id: c._id }, { $set: { excerpt: newExcerpt } });
        console.log(`Updated excerpt for ${c._id}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
