import 'dotenv/config';
import mongoose from 'mongoose';
import Stock from '../src/models/Stock.js';

async function ensure() {
  const MONGODB_URI = process.env.MONGODB_URI?.trim();
  if (!MONGODB_URI) {
    console.error('MONGODB_URI missing; cannot connect');
    process.exit(1);
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
    });

    console.log('Connected to MongoDB');

    const defaults = [
      {
        ticker: 'NEXI',
        name: 'NEXI Coin',
        price: 150,
        volatility: 0.12,
        factors: { memberGrowth: 0.15, messageActivity: 0.25 },
      },
      { ticker: 'TECH', name: 'Tech Giants Inc.', price: 300, volatility: 0.08 },
      { ticker: 'GME', name: 'GameStop Corp.', price: 50, volatility: 0.2 },
      { ticker: 'CRYPTO', name: 'Crypto Index', price: 200, volatility: 0.15 },
      { ticker: 'RETAIL', name: 'Retail Leaders', price: 80, volatility: 0.1 },
      { ticker: 'ENERGY', name: 'Energy Co.', price: 120, volatility: 0.09 },
      { ticker: 'HEALTH', name: 'Health Corp.', price: 90, volatility: 0.07 },
      { ticker: 'FINANCE', name: 'Finance Group', price: 110, volatility: 0.06 },
    ];

    let created = 0;
    for (const def of defaults) {
      const found = await Stock.findOne({ ticker: def.ticker });
      if (!found) {
        await Stock.create(def);
        created++;
        console.log(`Created ${def.ticker}`);
      } else {
        console.log(`Found ${def.ticker} (skipping)`);
      }
    }

    console.log(`Done. ${created} stock(s) created.`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to ensure stocks:', err);
    try { await mongoose.disconnect(); } catch {};
    process.exit(1);
  }
}

ensure();
