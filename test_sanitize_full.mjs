import { sanitizeInput } from './middlewares/securityMiddleware.js';

const req = {
  body: {
    title: 'test',
    content: '<p>test</p>',
    tags: ['a', 'b'],
    category: 'uncategorized',
    cardShape: 'square-medium',
    proTips: ['a'],
    keyTakeaways: ['b'],
    focusKeywords: ['c']
  },
  query: {},
  params: {}
};

const res = {};
const next = (err) => {
  if (err) console.error("Next called with error:", err);
  else console.log("Next called without error");
};

try {
  sanitizeInput(req, res, next);
} catch (err) {
  console.error("Caught error:", err);
}
