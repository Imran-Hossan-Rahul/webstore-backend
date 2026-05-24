import { OTP } from "otplib";
const authenticator = new OTP();
console.log(authenticator.generateSecret().length);
