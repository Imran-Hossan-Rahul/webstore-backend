const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://Imran:imran-store-cluster@store-cluster.siw5a75.mongodb.net/").then(async () => {
    const db = mongoose.connection.db;
    const collection = db.collection("users");
    const user = await collection.findOne({ email: "admin@webstore.com" });
    if (user) {
        console.log("User Found:", {
            email: user.email,
            isActive: user.isActive,
            passwordHash: user.password ? "Exists" : "Missing",
            role: user.role,
            isSuperAdmin: user.isSuperAdmin
        });
    } else {
        console.log("User admin@webstore.com not found in database.");
    }
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
