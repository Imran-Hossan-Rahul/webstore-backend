const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
    const res = await mongoose.connection.collection('jobs').updateMany({}, { $rename: { 'Patron': 'patron' } });
    console.log("Updated", res);
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
