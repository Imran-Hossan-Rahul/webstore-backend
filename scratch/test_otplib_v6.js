import { OTP } from "otplib";

try {
    const authenticator = new OTP();
    const result = authenticator.verifySync({ token: "123456", secret: "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456" });
    console.log("Verify Result:", result);
    process.exit(0);
} catch (e) {
    console.error("OTP Error:", e);
    process.exit(1);
}
