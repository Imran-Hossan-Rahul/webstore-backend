import mongoose from 'mongoose';

const deliveryConfigSchema = new mongoose.Schema({
  singletonKey: {
    type: String,
    default: 'DELIVERY_CONFIG',
    unique: true
  },
  insideDhaka: {
    upTo150g: { type: Number, default: 55 },
    upTo500g: { type: Number, default: 65 },
    upTo1kg: { type: Number, default: 75 },
    additionalPerKg: { type: Number, default: 20 }
  },
  subUrban: {
    upTo1kg: { type: Number, default: 105 },
    additionalPerKg: { type: Number, default: 20 }
  },
  outsideDhaka: {
    upTo500g: { type: Number, default: 115 },
    upTo1kg: { type: Number, default: 135 },
    additionalPerKg: { type: Number, default: 20 }
  },
  codPercentage: {
    type: Number,
    default: 1
  },
  subUrbanThanas: {
    type: [String],
    default: ['Savar', 'Keraniganj', 'Dhamrai', 'Dohar', 'Nawabganj']
  }
}, { timestamps: true });

const DeliveryConfig = mongoose.models.DeliveryConfig || mongoose.model('DeliveryConfig', deliveryConfigSchema);

export default DeliveryConfig;
