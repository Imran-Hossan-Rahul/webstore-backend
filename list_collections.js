import { MongoClient } from 'mongodb';

async function run() {
  const uri = 'mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/';
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db('test');
    
    const collections = await db.listCollections().toArray();
    console.log(collections.map(c => c.name));
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
