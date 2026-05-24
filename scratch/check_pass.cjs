const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://Imran:imran-store-cluster@store-cluster.siw5a75.mongodb.net/");
        const db = mongoose.connection.db;
        const collection = db.collection("users");
        const user = await collection.findOne({ email: "imranhossanrahul.dev@gmail.com" });
        if (user) {
            const isMatch = await bcrypt.compare("Admin@1234566", user.password);
            console.log("Password match for imranhossanrahul.dev@gmail.com:", isMatch);
        } else {
            console.log("User not found");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
