const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://Imran:imran-store-cluster@store-cluster.siw5a75.mongodb.net/").then(async () => {
    const db = mongoose.connection.db;
    const collection = db.collection("users");
    const users = await collection.find({}).limit(5).toArray();
    console.log("Users in DB:");
    users.forEach(u => {
        console.log(`- ${u.email} (Role: ${u.role}, Active: ${u.isActive}, isSuperAdmin: ${u.isSuperAdmin})`);
    });
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
