import mongoose from "mongoose";

(async () => {
    try {
        await mongoose.connect('mongodb+srv://Imran:imran@store-cluster.siw5a75.mongodb.net/webstore');
        const db = mongoose.connection.db;
        const users = await db.collection('users').find({ 
            $expr: { $gt: ['$walletBalance', { $ifNull: ['$totalEarnings', 0] }] } 
        }).toArray();
        
        console.log(`Found ${users.length} users with anomalies.`);
        for (let user of users) { 
            await db.collection('users').updateOne(
                { _id: user._id }, 
                { $set: { totalEarnings: user.walletBalance } }
            ); 
        } 
        console.log('Fixed users successfully.');
        process.exit(0);
    } catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
