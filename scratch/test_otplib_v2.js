import { OTP } from "otplib";
const authenticator = new OTP();

const secret = authenticator.generateSecret();
const token = authenticator.generate(secret);
const result = authenticator.verifySync({ token, secret });
console.log("Result:", result);
process.exit(0);
