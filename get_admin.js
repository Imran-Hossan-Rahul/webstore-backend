const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://Imran:imran-store-cluster@store-cluster.siw5a75.mongodb.net/").then(async () => {
    const db = mongoose.connection.db;
    const collection = db.collection("users");
    const admin = await collection.findOne({ $or: [{ isSuperAdmin: true }, { role: "admin" }] });
    console.log("Admin User:", admin ? {
        email: admin.email,
        role: admin.role,
        isSuperAdmin: admin.isSuperAdmin,
        passwordHash: admin.password
    } : "Not found");
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
