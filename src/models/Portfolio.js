// src/models/Portfolio.js
import mongoose from 'mongoose';

const portfolioSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  stocks: [{
    ticker: { type: String, required: true },
    quantity: { type: Number, default: 0 },
    buyPrice: { type: Number, default: 0 }, // average buy price
  }],
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('Portfolio', portfolioSchema);