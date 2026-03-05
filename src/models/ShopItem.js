// src/models/ShopItem.js
import mongoose from 'mongoose';

const shopItemSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  priceType: { type: String, default: 'daily' }, // 'daily', 'one-time', etc.
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('ShopItem', shopItemSchema);
