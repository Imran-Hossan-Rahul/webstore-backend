import { OTP } from "otplib";

try {
    const authenticator = new OTP();
    const secret = "KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRJZ"; // valid 32 byte base32 secret
    // generate a valid token
    const token = authenticator.generate(secret);
    const result = authenticator.verifySync({ token, secret });
    console.log("Verify Result:", result);
    process.exit(0);
} catch (e) {
    console.error("OTP Error:", e);
    process.exit(1);
}
