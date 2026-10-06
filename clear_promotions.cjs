const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: './.env.local' });
if (!process.env.MONGODB_URI) {
    dotenv.config({ path: './.env' });
}

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const module = await import('./models/MarketConfig.model.js');
        const MarketConfig = module.default;
        
        await MarketConfig.updateMany({}, {
            $set: {
                trendingNow: [],
                flashDeals: [],
                promotionBanners: []
            }
        });
        console.log('Promotions cleared!');
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
run();
