import Joi from "joi";

export const createTemplateSchema = () =>
  Joi.object({
    title: Joi.string().min(2).max(200).trim().required(),
    description: Joi.string().min(10).max(2000).trim().required(),

    tags: Joi.alternatives().try(
      Joi.array().items(Joi.string().trim()),
      Joi.string().allow("").trim()
    ),
    tech: Joi.alternatives().try(Joi.string(), Joi.array().items(Joi.string().trim()).default([])),

    category: Joi.string()
      .valid(
        "UI",
        "Site Templates",
        "eCommerce",
        "Admin Dashboard",
        "Animation",
        "Blogging",
        "Marketing",
        "Mobile Ui",
        "Components"
      )
      .required(),

    cardShape: Joi.string()
      .valid(
        "square-small", "square-medium", 
        "rectangle-horizontal", "rectangle-vertical",
        "tower", "skyscraper",
        "banner-wide", "featured",
        "poster", "cinematic"
      )
      .default("square-medium"),

    priceType: Joi.string().valid("free", "paid").required(),
    
    price: Joi.when("priceType", {
      is: "paid",
      then: Joi.number().positive().required(),
      otherwise: Joi.number().valid(0)
    }),

    discount: Joi.number().min(0).max(100).default(0),
    currency: Joi.string().uppercase().default("USD"),

    githubLink: Joi.string().uri().allow(""),
    liveLink: Joi.string().uri().allow(""),

    // 🚨 FILE FIELDS REMOVED FROM HERE 🚨
    fileUrl: Joi.string().allow(""),
    fileType: Joi.string().valid("zip", "json", "js", "css", "html", "other"),
    fileSize: Joi.number().min(0).max(500).allow(null),

    verifiedSeller: Joi.boolean().default(false),
    status: Joi.string()
      .valid("pending", "approved", "rejected")
      .default("pending"),
  });