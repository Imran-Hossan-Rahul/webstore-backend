import { authenticator } from "otplib";

const secret = authenticator.generateSecret();
const token = authenticator.generate(secret);
const isValid = authenticator.verify({ token, secret });
console.log("Is valid:", isValid);
process.exit(0);
