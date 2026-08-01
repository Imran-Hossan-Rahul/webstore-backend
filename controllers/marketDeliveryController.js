import MarketProduct from '../models/MarketProduct.model.js';
import MarketCategory from '../models/MarketCategory.model.js';
import DeliveryConfig from '../models/DeliveryConfig.model.js';

export const calculateDelivery = async (req, res) => {
  try {
    const { district, thana, items, isCod } = req.body;

    if (!district || !thana || !items || !items.length) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // 1. Calculate Total Weight and Subtotal
    let totalWeightInGrams = 0;
    let subtotal = 0;

    for (const item of items) {
      const product = await MarketProduct.findById(item.id);
      if (!product) continue;

      const price = product.selling_price || product.basePrice || 0;
      subtotal += price * item.quantity;

      // Fetch the most specific category available for max weight
      let category = null;
      if (product.childCategory_id) category = await MarketCategory.findById(product.childCategory_id);
      if (!category && product.subCategory_id) category = await MarketCategory.findById(product.subCategory_id);
      if (!category && product.category_id) category = await MarketCategory.findById(product.category_id);

      // Ensure we get the maxWeightPerPiece
      let maxWeight = 0;
      if (category && category.maxWeightPerPiece) {
        maxWeight = category.maxWeightPerPiece;
      }
      
      totalWeightInGrams += maxWeight * item.quantity;
    }

    // 2. Fetch Config
    let config = await DeliveryConfig.findOne({ singletonKey: 'DELIVERY_CONFIG' });
    if (!config) {
        // Fallback defaults
        config = {
            insideDhaka: { upTo150g: 55, upTo500g: 65, upTo1kg: 75, additionalPerKg: 20 },
            subUrban: { upTo1kg: 105, additionalPerKg: 20 },
            outsideDhaka: { upTo500g: 115, upTo1kg: 135, additionalPerKg: 20 },
            codPercentage: 1,
            subUrbanThanas: ['Savar', 'Keraniganj', 'Dhamrai', 'Dohar', 'Nawabganj']
        };
    }

    // 3. Determine Zone
    let zone = 'outsideDhaka';
    const districtLower = district.toLowerCase().trim();
    const thanaLower = thana.toLowerCase().trim();

    if (districtLower === 'dhaka') {
      const isSubUrban = config.subUrbanThanas.some(t => t.toLowerCase() === thanaLower);
      if (isSubUrban) {
        zone = 'subUrban';
      } else {
        zone = 'insideDhaka';
      }
    }

    // 4. Calculate Weight Charge
    let charge = 0;
    
    if (zone === 'insideDhaka') {
        if (totalWeightInGrams <= 150) {
            charge = config.insideDhaka.upTo150g;
        } else if (totalWeightInGrams <= 500) {
            charge = config.insideDhaka.upTo500g;
        } else if (totalWeightInGrams <= 1000) {
            charge = config.insideDhaka.upTo1kg;
        } else {
            charge = config.insideDhaka.upTo1kg;
            const extraKgs = Math.ceil((totalWeightInGrams - 1000) / 1000);
            charge += (extraKgs * config.insideDhaka.additionalPerKg);
        }
    } else if (zone === 'subUrban') {
        if (totalWeightInGrams <= 1000) {
            charge = config.subUrban.upTo1kg;
        } else {
            charge = config.subUrban.upTo1kg;
            const extraKgs = Math.ceil((totalWeightInGrams - 1000) / 1000);
            charge += (extraKgs * config.subUrban.additionalPerKg);
        }
    } else {
        // outsideDhaka
        if (totalWeightInGrams <= 500) {
            charge = config.outsideDhaka.upTo500g;
        } else if (totalWeightInGrams <= 1000) {
            charge = config.outsideDhaka.upTo1kg;
        } else {
            charge = config.outsideDhaka.upTo1kg;
            const extraKgs = Math.ceil((totalWeightInGrams - 1000) / 1000);
            charge += (extraKgs * config.outsideDhaka.additionalPerKg);
        }
    }

    // 5. COD Calculation
    let codCharge = 0;
    if (isCod) {
        // 1% COD charge on subtotal + delivery fee
        const collectableAmount = subtotal + charge;
        codCharge = Math.round((collectableAmount * config.codPercentage) / 100);
    }
    
    // Add COD to total delivery cost (or we can just return it separately, but standard practice is to include it in the shipping total or display it)
    const totalDeliveryCharge = charge + codCharge;

    res.status(200).json({
      success: true,
      data: {
        zone,
        totalWeightInGrams,
        baseCharge: charge,
        codCharge,
        totalDeliveryCharge
      }
    });

  } catch (error) {
    console.error('Calculate Delivery Error:', error);
    res.status(500).json({ success: false, message: 'Server error calculating delivery' });
  }
};
