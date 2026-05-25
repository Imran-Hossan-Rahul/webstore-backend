import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Post from './models/Post.model.js';
import Artifact from './models/Artifact.model.js';
import Codex from './models/Codex.model.js';

dotenv.config();

async function fixTitles() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const regex = /^\[Demo\s*.*?\]\s*/i;

    const models = [
      { name: 'Post', model: Post },
      { name: 'Artifact', model: Artifact },
      { name: 'Codex', model: Codex }
    ];

    for (const { name, model } of models) {
      if (!model) continue;
      
      const docs = await model.find({ title: { $regex: regex } });
      console.log(`Found ${docs.length} ${name} documents with Demo prefix.`);
      
      let updated = 0;
      for (const doc of docs) {
        if (doc.title) {
          const oldTitle = doc.title;
          const newTitle = doc.title.replace(regex, '');
          await model.updateOne({ _id: doc._id }, { $set: { title: newTitle } });
          console.log(`Updated [${name}]: "${oldTitle}" -> "${newTitle}"`);
          updated++;
        }
      }
      console.log(`Successfully updated ${updated} ${name} documents.\n`);
    }

    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixTitles();
