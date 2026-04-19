const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://Imran:imran-store-cluster@store-cluster.siw5a75.mongodb.net/").then(async () => {
    const db = mongoose.connection.db;
    const collection = db.collection("users");
    const admin = await collection.findOne({ $or: [{ isSuperAdmin: true }, { role: "admin" }] });
    console.log("\n--- ADMIN CREDENTIALS ---");
    console.log("Email:", admin ? admin.email : "Not found");
    console.log("Role:", admin ? admin.role : "Not found");
    console.log("IsSuperAdmin:", admin ? admin.isSuperAdmin : "Not found");
    console.log("-------------------------\n");
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
