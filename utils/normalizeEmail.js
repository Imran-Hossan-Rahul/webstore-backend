import validator from "validator";

/**
 * Normalize and validate email
 * @param {string} email - user input email
 * @param {object} options - optional normalization settings
 * @param {boolean} options.normalizeGmail - remove dots and +alias for gmail
 * @returns {object} { valid: boolean, email: string }
 */
export const normalizeEmail = (email, options = { normalizeGmail: false }) => {
  if (!email || typeof email !== "string") return { valid: false, email: "" };

  let normalized = email.trim().toLowerCase();

  // Gmail normalization disabled — removing dots causes login mismatches
  // if (options.normalizeGmail && normalized.endsWith("@gmail.com")) { ... }

  // Validate using validator.js
  const isValid = validator.isEmail(normalized, {
    allow_utf8_local_part: true,
  });

  return { valid: isValid, email: isValid ? normalized : "" };
};
