// validations/trackSchemas.js
import Joi from "joi";

/**
 * i18n-ready error messages (future-proof)
 */
const messages = {
  en: {
    required: "{{#label}} is required",
    stringEmpty: "{{#label}} cannot be empty",
    invalidEnum: "{{#label}} must be one of {{#valids}}",
    minNumber: "{{#label}} must be at least {{#limit}}",
    minDate: "{{#label}} must be a valid date",
  },
};

/**
 * Get i18n messages
 */
const getMessages = (lang = "en") => messages[lang] || messages.en;

/**
 * ----------------------------
 * Track Visit Schema
 * ----------------------------
 * Used for first hit / page load
 */
export const trackVisitSchema = (lang = "en") => {
  const msg = getMessages(lang);

  return Joi.object({
    sessionId: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "sessionId"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "sessionId"),
      }),
    visitorId: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "visitorId"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "visitorId"),
      }),
    landingPath: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "landingPath"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "landingPath"),
      }),
    referrer: Joi.string().allow(null, "").default("Direct"),
    utm: Joi.object({
      utm_source: Joi.string().allow(null, ""),
      utm_medium: Joi.string().allow(null, ""),
      utm_campaign: Joi.string().allow(null, ""),
      utm_term: Joi.string().allow(null, ""),
      utm_content: Joi.string().allow(null, ""),
    }).required(),
    userAgent: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "userAgent"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "userAgent"),
      }),
    timestamp: Joi.date()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "timestamp"),
        "date.base": msg.minDate.replace("{{#label}}", "timestamp"),
      }),
  });
};

/**
 * ----------------------------
 * Track Event Schema
 * ----------------------------
 * Used for click, scroll, signup, custom events
 */
export const trackEventSchema = (lang = "en") => {
  const msg = getMessages(lang);

  return Joi.object({
    sessionId: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "sessionId"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "sessionId"),
      }),
    visitorId: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "visitorId"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "visitorId"),
      }),
    eventType: Joi.string()
      .valid("pageview", "click", "scroll", "signup_click", "custom")
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "eventType"),
        "any.only": msg.invalidEnum.replace("{{#label}}", "eventType"),
      }),
    page: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "page"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "page"),
      }),
    element: Joi.string().allow(null, ""),
    value: Joi.any(),
    timestamp: Joi.date()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "timestamp"),
        "date.base": msg.minDate.replace("{{#label}}", "timestamp"),
      }),
  });
};

/**
 * ----------------------------
 * Track Session Schema
 * ----------------------------
 * Used for session end/update (duration, pageviews)
 */
export const trackSessionSchema = (lang = "en") => {
  const msg = getMessages(lang);

  return Joi.object({
    sessionId: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "sessionId"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "sessionId"),
      }),
    visitorId: Joi.string()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "visitorId"),
        "string.empty": msg.stringEmpty.replace("{{#label}}", "visitorId"),
      }),
    endedAt: Joi.date()
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "endedAt"),
        "date.base": msg.minDate.replace("{{#label}}", "endedAt"),
      }),
    duration: Joi.number()
      .min(0)
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "duration"),
        "number.min": msg.minNumber
          .replace("{{#label}}", "duration")
          .replace("{{#limit}}", "0"),
      }),
    pageViews: Joi.number()
      .min(1)
      .required()
      .messages({
        "any.required": msg.required.replace("{{#label}}", "pageViews"),
        "number.min": msg.minNumber
          .replace("{{#label}}", "pageViews")
          .replace("{{#limit}}", "1"),
      }),
  });
};
