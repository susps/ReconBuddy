// src/models/Stock.js
import mongoose from 'mongoose';

const stockSchema = new mongoose.Schema({
  ticker: { type: String, required: true, unique: true, uppercase: true },
  name: { type: String, required: true },
  price: { type: Number, default: 100 },
  volatility: { type: Number, default: 0.05 }, // 5% fluctuation range
  lastUpdated: { type: Date, default: Date.now },
  history: [{
    timestamp: { type: Date, default: Date.now },
    price: { type: Number, required: true },
  }], // last 24 hours of prices
  factors: { type: Object, default: { memberGrowth: 0.1, messageActivity: 0.2 } }, // for NEXI
});

export default mongoose.model('Stock', stockSchema);