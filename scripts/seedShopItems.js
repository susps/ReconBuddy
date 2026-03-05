// scripts/seedShopItems.js
import mongoose from 'mongoose';
import ShopItem from '../src/models/ShopItem.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const MONGO_URI = process.env.MONGODB_URI;

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    await ShopItem.updateOne(
      { key: 'casino_membership' },
      {
        key: 'casino_membership',
        name: 'Casino Membership',
        description: 'Grants high-roller status for exclusive casino games. Price is per day.',
        price: 50000,
        priceType: 'daily',
      },
      { upsert: true }
    );
    console.log('Shop items seeded.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error seeding shop items:', err);
    process.exit(1);
  }
}

seed();
