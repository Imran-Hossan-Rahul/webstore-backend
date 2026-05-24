import { OTP } from "otplib";

try {
    const authenticator = new OTP();
    const secret = "KVKFKRCPNZQUYMLXOVYDSQKJKZDTSRJZ"; // 32 chars, valid base32
    const token = "123456";
    const result = authenticator.verifySync({ token, secret });
    console.log("Verify Result:", result);
    process.exit(0);
} catch (e) {
    console.error("OTP Error:", e);
    process.exit(1);
}
