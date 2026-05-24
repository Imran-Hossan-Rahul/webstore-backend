import { OTP } from "otplib";
import { NobleCryptoPlugin } from "@otplib/plugin-crypto-noble";
import { ScureBase32Plugin } from "@otplib/plugin-base32-scure";

try {
    const authenticator = new OTP();
    // By default OTP might not have crypto plugins configured. Let's see if it works without plugins out of the box in v13, as in userController.js.
    const secret = authenticator.generateSecret();
    const token = authenticator.generate(secret);
    const result = authenticator.verifySync({ token, secret });
    console.log("Verify Result:", result);
    process.exit(0);
} catch (e) {
    console.error("OTP Error:", e);
    process.exit(1);
}
