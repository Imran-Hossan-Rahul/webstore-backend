import fs from "fs";
import path from "path";
import chalk from "chalk";

const LOG_FILE = path.join(process.cwd(), "logs/app.log");

// সার্ভারলেস এনভায়রনমেন্টে ফাইল সিস্টেম চেক
const isServerless =
  process.env.VERCEL ||
  (process.env.NODE_ENV === "production" && !fs.existsSync("/tmp"));

if (!isServerless) {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
}

const levels = { info: "INFO", warn: "WARN", error: "ERROR" };

function formatMessage(level, message) {
  const timestamp = new Date().toLocaleString();
  return `[${timestamp}] [${levels[level]}] ${message}`;
}

function writeLog(level, message) {
  const formatted = formatMessage(level, message);

  // 1. Console Logging (with Chalk safety)
  try {
    switch (level) {
      case "info":
        console.log(chalk.blue ? chalk.blue(formatted) : formatted);
        break;
      case "warn":
        console.warn(chalk.yellow ? chalk.yellow(formatted) : formatted);
        break;
      case "error":
        console.error(chalk.red ? chalk.red(formatted) : formatted);
        break;
    }
  } catch (e) {
    console.log(formatted);
  }

  // 2. File Logging (Skip if Serverless)
  if (!isServerless) {
    fs.appendFile(LOG_FILE, formatted + "\n", (err) => {
      if (err) {
        // ফাইল রাইট করতে না পারলে অন্তত কনসোলে জানানো, কিন্তু অ্যাপ ক্রাশ করবে না
      }
    });
  }
}

const logger = {
  info: (msg) => writeLog("info", msg),
  warn: (msg) => writeLog("warn", msg),
  error: (msg) => writeLog("error", msg),
};

export default logger;
