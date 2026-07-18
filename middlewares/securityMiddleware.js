import { NODE_ENV } from "../config/index.js";
import sanitizeHtml from "sanitize-html";

/**
 * Enforce HTTPS in production
 */
export const enforceHTTPS = (req, res, next) => {
  if (NODE_ENV === "production" && req.headers["x-forwarded-proto"] !== "https") {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
};

/**
 * Additional security headers
 */
export const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable XSS protection
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Permissions policy
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");

  // HSTS (Strict-Transport-Security)
  if (NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  
  next();
};

/**
 * Global Input Sanitization Middleware
 * Recursively sanitizes req.body, req.query, and req.params
 */
export const sanitizeInput = (req, res, next) => {
  const sanitize = (value, key) => {
    if (typeof value === "string") {
      // Do not sanitize passwords to avoid corrupting them
      if (key && key.toLowerCase().includes('password')) return value.trim();

      // For rich text fields like blog content, use a permissive config that supports Tiptap
      if (key === 'content' || key === 'description' || key === 'bio' || key === 'html' || key === 'excerpt') {
        return sanitizeHtml(value, {
          allowedTags: sanitizeHtml.defaults.allowedTags.concat([
            'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'hr', 
            'table', 'thead', 'tbody', 'tr', 'th', 'td', 'colgroup', 'col', 
            'section', 'article', 'iframe', 'video', 'audio', 'source', 
            'u', 's', 'mark', 'sup', 'sub', 'pre', 'code'
          ]),
          allowedAttributes: {
            '*': ['style', 'class', 'id', /^data-.*/],
            'a': ['href', 'name', 'target', 'rel'],
            'img': ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading'],
            'iframe': ['src', 'width', 'height', 'allow', 'allowfullscreen', 'frameborder'],
            'video': ['src', 'controls', 'width', 'height', 'autoplay', 'muted', 'loop', 'poster'],
            'audio': ['src', 'controls', 'autoplay', 'muted', 'loop'],
            'source': ['src', 'type'],
            'th': ['colspan', 'rowspan'],
            'td': ['colspan', 'rowspan'],
            'col': ['span']
          },
          allowedSchemes: ['http', 'https', 'ftp', 'mailto', 'tel'], // ✅ FIX: removed 'data:' global scheme — XSS vector
          allowedSchemesByTag: {
            img: ['http', 'https', 'data'],   // data: allowed only for inline images
            video: ['http', 'https', 'data'],
            audio: ['http', 'https', 'data']
          },
          allowVulnerableTags: false // ✅ FIX: was true — now enforces strict attribute rules on iframe/video
        }).trim();
      }

      // For normal fields, use a stricter config but still allow basic text
      return sanitizeHtml(value, {
        allowedTags: ["b", "i", "em", "strong", "a", "p", "br", "ul", "ol", "li", "code", "pre"],
        allowedAttributes: {
          "a": ["href", "name", "target"],
          "code": ["class"]
        },
        allowedSchemes: ["http", "https", "mailto"]
      }).trim();
    }
    if (typeof value === "object" && value !== null) {
      for (let k in value) {
        value[k] = sanitize(value[k], k);
      }
    }
    return value;
  };

  if (req.body) req.body = sanitize(req.body, 'body');
  if (req.query) req.query = sanitize(req.query, 'query');
  if (req.params) req.params = sanitize(req.params, 'params');

  next();
};

/**
 * Remove sensitive headers
 */
export const removeSensitiveHeaders = (req, res, next) => {
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  next();
};

