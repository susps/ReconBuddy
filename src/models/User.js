// src/models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  balance: { type: Number, default: 0 },
  lastDaily: { type: Date, default: null },
  dailyStreak: { type: Number, default: 0 },
  lastWork: { type: Date, default: null },
  inventory: { type: [mongoose.Schema.Types.Mixed], default: [] },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('User', userSchema);