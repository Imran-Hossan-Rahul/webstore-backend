const mongoose = require("mongoose");
require("dotenv").config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb+srv://Imran:imran-store-cluster@store-cluster.siw5a75.mongodb.net/");
        
        // I need to use the User model to trigger the pre-save hook for password hashing
        // Wait, User.model.js is an ES module. I can't require it directly in CommonJS without experimental-modules or dynamic import
        // Let's use dynamic import
        const UserModule = await import("./models/User.model.js");
        const User = UserModule.default;

        const admin = await User.findOne({ $or: [{ isSuperAdmin: true }, { role: "admin" }] });
        if (admin) {
            admin.password = "SuperAdmin@123!";  // Must pass complexity regex in model
            // also clear password history so we don't hit the "cannot reuse old password" error
            admin.passwordHistory = [];
            await admin.save();
            console.log("Password updated successfully to: SuperAdmin@123!");
        } else {
             console.log("Admin not found");
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
