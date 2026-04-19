import dotenv from "dotenv";


dotenv.config();

const requiredEnvs = [
  "JWT_SECRET_ACCESS_TOKEN",
  "JWT_SECRET_REFRESH_TOKEN",
  "MONGODB_URI",
  "ENCRYPTION_KEY",
  "CLIENT_URL",
  "NODE_ENV",
  "PORT",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

requiredEnvs.forEach((env) => {
  if (!process.env[env]) {
    console.error(`ERROR: Missing required env variable ${env}`);
    process.exit(1);
  }
});

export const MONGODB_CONNECTION_STRING = process.env.MONGODB_URI
export const JWT_ACCESS_SECRET = process.env.JWT_SECRET_ACCESS_TOKEN;
export const JWT_REFRESH_SECRET = process.env.JWT_SECRET_REFRESH_TOKEN;
export const JWT_ACCESS_EXPIRY = process.env.JWT_SECRET_ACCESS_TOKEN_EXPIRY || "15m";
export const JWT_REFRESH_EXPIRY = process.env.JWT_SECRET_REFRESH_TOKEN_EXPIRY || "7d";
export const JWT_ISSUER = process.env.JWT_ISSUER || "myapp";
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
export const CLIENT_URL =  process.env.CLIENT_URL
export const NODE_ENV = process.env.NODE_ENV
export const PORT = process.env.PORT;
export const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
export const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
export const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

