const fs = require('fs');
const path = 'config/db.js';
let c = fs.readFileSync(path, 'utf8');
c = c.replace(/w: "majority",/g, 'w: "majority",\n      family: 4, // Force IPv4 to prevent IPv6 network drops');
fs.writeFileSync(path, c);
