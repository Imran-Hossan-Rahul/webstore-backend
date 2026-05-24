import { sanitizeInput } from './middlewares/securityMiddleware.js';

const req = {
  body: {
    title: "test",
    content: "<p>test</p>",
    tags: ["a", "b"]
  },
  query: {},
  params: {}
};

const res = {};
const next = (err) => {
  if (err) console.error("Next called with error:", err);
  else console.log("Next called without error. req.body:", req.body);
};

try {
  sanitizeInput(req, res, next);
} catch (err) {
  console.error("Caught error:", err);
}
