import Joi from "joi";

// Validation schema for creating creator account
export const createCreatorSchema = () => {
  return Joi.object({
    displayName: Joi.string().min(2).max(50).required().messages({
      "string.empty": "Display name is required",
      "string.min": "Display name must be at least 2 characters",
      "string.max": "Display name can be at most 50 characters",
    }),
    bio: Joi.string().max(500).allow("").messages({
      "string.max": "Bio can be at most 500 characters",
    }),
    skills: Joi.array().items(Joi.string()).max(20).messages({
      "array.max": "You can add up to 20 skills only",
    }),
    workType: Joi.string().valid("solo", "team").messages({
      "any.only": "Work type must be either 'solo' or 'team'",
    }),
    portfolio: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        url: Joi.string().uri().required(),
        description: Joi.string().allow(""),
        thumbnail: Joi.string().uri().allow(""),
      })
    ),
    socialLinks: Joi.object({
      github: Joi.string().uri().allow(""),
      linkedin: Joi.string().uri().allow(""),
      twitter: Joi.string().uri().allow(""),
      website: Joi.string().uri().allow(""),
      behance: Joi.string().uri().allow(""),
      dribbble: Joi.string().uri().allow(""),
    }),
  });
};

// Validation schema for updating creator profile
export const updateCreatorSchema = () => {
  return Joi.object({
    displayName: Joi.string().min(2).max(50).messages({
      "string.min": "Display name must be at least 2 characters",
      "string.max": "Display name can be at most 50 characters",
    }),
    bio: Joi.string().max(500).allow("").messages({
      "string.max": "Bio can be at most 500 characters",
    }),
    skills: Joi.array().items(Joi.string()).max(20).messages({
      "array.max": "You can add up to 20 skills only",
    }),
    workType: Joi.string().valid("solo", "team").messages({
      "any.only": "Work type must be either 'solo' or 'team'",
    }),
    portfolio: Joi.array().items(
      Joi.object({
        title: Joi.string().required(),
        url: Joi.string().uri().required(),
        description: Joi.string().allow(""),
        thumbnail: Joi.string().uri().allow(""),
      })
    ),
    socialLinks: Joi.object({
      github: Joi.string().uri().allow(""),
      linkedin: Joi.string().uri().allow(""),
      twitter: Joi.string().uri().allow(""),
      website: Joi.string().uri().allow(""),
      behance: Joi.string().uri().allow(""),
      dribbble: Joi.string().uri().allow(""),
    }),
  });
};
