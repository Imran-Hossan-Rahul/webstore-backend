import MarketConfig from '../models/MarketConfig.model.js';

// Get or Create MarketConfig (Singleton)
export const getMarketConfig = async (req, res) => {
  try {
    let config = await MarketConfig.findOne({ singletonKey: 'MARKET_CONFIG' })
      .populate('flashDeals')
      .populate('trendingNow');

    if (!config) {
      config = await MarketConfig.create({ singletonKey: 'MARKET_CONFIG' });
    }

    res.status(200).json(config);
  } catch (error) {
    console.error('Error fetching market config:', error);
    res.status(500).json({ message: 'Failed to fetch market configuration' });
  }
};

// Update MarketConfig (Admin only)
export const updateMarketConfig = async (req, res) => {
  try {
    const { flashDeals, trendingNow, todaysOffer, brandSpotlight } = req.body;

    const config = await MarketConfig.findOneAndUpdate(
      { singletonKey: 'MARKET_CONFIG' },
      { flashDeals, trendingNow, todaysOffer, brandSpotlight },
      { new: true, upsert: true }
    )
    .populate('flashDeals')
    .populate('trendingNow');

    res.status(200).json(config);
  } catch (error) {
    console.error('Error updating market config:', error);
    res.status(500).json({ message: 'Failed to update market configuration' });
  }
};
