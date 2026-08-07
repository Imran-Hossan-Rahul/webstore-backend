const mongoose = require('mongoose'); 
mongoose.connect('mongodb://127.0.0.1:27017/Craftsmans').then(() => { 
  mongoose.connection.db.collection('marketconfigs').findOne({singletonKey: 'MARKET_CONFIG'}).then(c => 
    mongoose.connection.db.collection('marketproducts').find({_id: {$in: c.trendingNow}}).toArray()
  ).then(res => {
    console.log(JSON.stringify(res.map(p => ({ title: p.title, photos: p.photos })), null, 2));
  }).finally(()=>process.exit(0)) 
});
