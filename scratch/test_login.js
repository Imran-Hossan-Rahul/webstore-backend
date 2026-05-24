import mongoose from "mongoose";
import dotenv from "dotenv";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import User from "../models/User.model.js";
import { loginUser } from "../controllers/authController.js";
import logger from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "../.env") });

async function test() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("Connected to MongoDB");

        const req = {
            body: {
                email: "imranhossanrahul.dev@gmail.com",
                password: "Admin@1234566"
            },
            headers: {
                "user-agent": "Mozilla/5.0"
            },
            ip: "127.0.0.1"
        };

        const res = {
            status: function(code) {
                console.log("Status Code:", code);
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                console.log("JSON Response:", JSON.stringify(data, null, 2));
                return this;
            },
            cookie: function(name, value, options) {
                console.log(`Setting cookie ${name}=${value}`);
                return this;
            }
        };

        await loginUser(req, res);
        process.exit(0);
    } catch (err) {
        console.error("Test Script Error:", err);
        process.exit(1);
    }
}

test();
