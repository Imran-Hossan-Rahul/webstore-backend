// middleware/verifyAccessToken.js
import jwt from "jsonwebtoken";
import { JWT_ACCESS_SECRET } from "../config/index.js";


export const verifyAccessToken = (req, res, next) => {
  try {
    let token;
    // 🔹 1. Authorization header
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    }
    
    // 🔹 2. Cookie (Priority for million-dollar security)
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Access token missing" });
    }


    // Verify JWT token with explicit algorithm
    const payload = jwt.verify(token, JWT_ACCESS_SECRET, {
      algorithms: ["HS256"],
    });

    // Attach user info to request for downstream use
    req.user = payload;

    next();
  } catch (err) {
    // Optional logging for debugging
    console.warn("JWT verification failed:", err.message);

    // Handle expired token
    if (err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ success: false, message: "Access token expired" });
    }

    // Handle invalid token
    return res
      .status(401)
      .json({ success: false, message: "Invalid access token" });
  }
};
