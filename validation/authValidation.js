import Joi from "joi";

// --- i18n-ready messages
const messages = {
  en: {
    nameRequired: "Name is required",
    nameMin: "Name must be at least 2 characters",
    nameMax: "Name can be at most 50 characters",
    emailRequired: "Email is required",
    emailValid: "Please enter a valid email",
    passwordRequired: "Password is required",
    passwordMin: "Password must be at least 8 characters long",
    passwordPattern:
      "Password must contain at least one uppercase, one lowercase, one number, and one special character",
  },
  // future: bn, es, fr etc.
};

export const getMessages = (lang = "en") => messages[lang] || messages.en;

export const registerSchema = (lang = "en") => {
  const msg = getMessages(lang);

  return Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
      "string.empty": msg.nameRequired,
      "string.min": msg.nameMin,
      "string.max": msg.nameMax,
    }),
    email: Joi.string().email().required().messages({
      "string.empty": msg.emailRequired,
      "string.email": msg.emailValid,
    }),
    password: Joi.string()
      .min(8)
      .pattern(
        new RegExp(
          "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
        )
      )
      .required()
      .messages({
        "string.empty": msg.passwordRequired,
        "string.min": msg.passwordMin,
        "string.pattern.base": msg.passwordPattern,
      }),
  });
};


export const loginSchema = (lang = "en") => {
  const msg = getMessages(lang);
  return Joi.object({
    email: Joi.string().email().required().messages({
      "string.empty": msg.emailRequired,
      "string.email": msg.emailValid,
    }),
    password: Joi.string().required().messages({
      "string.empty": msg.passwordRequired,
    }),
  });
};

export const forgotPasswordSchema = (lang = "en") => {
  const msg = getMessages(lang);
  return Joi.object({
    email: Joi.string().email().required().messages({
      "string.empty": msg.emailRequired,
      "string.email": msg.emailValid,
    }),
  });
};

export const resetPasswordSchema = (lang = "en") => {
  const msg = getMessages(lang);
  return Joi.object({
    token: Joi.string().required().messages({
      "string.empty": "Token is required",
    }),
    password: Joi.string()
      .min(8)
      .pattern(
        new RegExp(
          "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$"
        )
      )
      .required()
      .messages({
        "string.empty": msg.passwordRequired,
        "string.min": msg.passwordMin,
        "string.pattern.base": msg.passwordPattern,
      }),
  });
};

