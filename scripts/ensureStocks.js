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
      // ── Core ──
      { ticker: 'NEXI', name: 'NEXI Coin', price: 150, volatility: 0.12, factors: { memberGrowth: 0.15, messageActivity: 0.25 } },

      // ── Technology ──
      { ticker: 'TECH', name: 'Tech Giants Inc.', price: 300, volatility: 0.08 },
      { ticker: 'AAPL', name: 'Apple Corp.', price: 420, volatility: 0.06 },
      { ticker: 'MSFT', name: 'Microsoft Ltd.', price: 480, volatility: 0.05 },
      { ticker: 'GGLE', name: 'Alphabet Inc.', price: 350, volatility: 0.07 },
      { ticker: 'AMZN', name: 'Amazon Group', price: 390, volatility: 0.08 },
      { ticker: 'META', name: 'Meta Platforms', price: 310, volatility: 0.09 },
      { ticker: 'NVDA', name: 'NovaTech GPUs', price: 550, volatility: 0.14 },
      { ticker: 'CHIP', name: 'ChipWorks Semi', price: 180, volatility: 0.11 },
      { ticker: 'AIML', name: 'AI/ML Dynamics', price: 260, volatility: 0.16 },
      { ticker: 'CYBER', name: 'CyberShield Sec.', price: 145, volatility: 0.10 },
      { ticker: 'CLOUD', name: 'CloudNine Hosting', price: 210, volatility: 0.08 },

      // ── Gaming ──
      { ticker: 'GME', name: 'GameStop Corp.', price: 50, volatility: 0.20 },
      { ticker: 'GAME', name: 'GameDev Studios', price: 95, volatility: 0.13 },
      { ticker: 'ESPT', name: 'eSports League Co.', price: 65, volatility: 0.15 },

      // ── Crypto & Blockchain ──
      { ticker: 'CRYPTO', name: 'Crypto Index', price: 200, volatility: 0.15 },
      { ticker: 'BITC', name: 'Bitcoin Trust', price: 500, volatility: 0.18 },
      { ticker: 'ETHE', name: 'Ethereum Fund', price: 320, volatility: 0.17 },
      { ticker: 'BLOCK', name: 'Blockchain Infra', price: 110, volatility: 0.13 },

      // ── Finance & Banking ──
      { ticker: 'FINANCE', name: 'Finance Group', price: 110, volatility: 0.06 },
      { ticker: 'BANK', name: 'Global Bank Corp.', price: 160, volatility: 0.05 },
      { ticker: 'INSUR', name: 'InsureAll Ltd.', price: 85, volatility: 0.04 },
      { ticker: 'FINTK', name: 'FinTek Pay', price: 130, volatility: 0.10 },

      // ── Retail & Consumer ──
      { ticker: 'RETAIL', name: 'Retail Leaders', price: 80, volatility: 0.10 },
      { ticker: 'LUXE', name: 'Luxe Brands Co.', price: 240, volatility: 0.07 },
      { ticker: 'FOOD', name: 'FoodCorp Global', price: 70, volatility: 0.04 },
      { ticker: 'BREW', name: 'BrewHouse Inc.', price: 55, volatility: 0.06 },

      // ── Energy ──
      { ticker: 'ENERGY', name: 'Energy Co.', price: 120, volatility: 0.09 },
      { ticker: 'OIL', name: 'PetroGlobe Oil', price: 140, volatility: 0.11 },
      { ticker: 'SOLAR', name: 'SolarFlare Energy', price: 100, volatility: 0.12 },
      { ticker: 'NUKE', name: 'NuclePower Inc.', price: 175, volatility: 0.08 },
      { ticker: 'WIND', name: 'WindStream Energy', price: 88, volatility: 0.09 },

      // ── Healthcare & Pharma ──
      { ticker: 'HEALTH', name: 'Health Corp.', price: 90, volatility: 0.07 },
      { ticker: 'PHARMA', name: 'PharmaCure Inc.', price: 195, volatility: 0.10 },
      { ticker: 'BIO', name: 'BioGenix Labs', price: 230, volatility: 0.14 },

      // ── Automotive & Transport ──
      { ticker: 'AUTO', name: 'AutoMakers Ltd.', price: 155, volatility: 0.08 },
      { ticker: 'ELEC', name: 'ElectraCar Co.', price: 280, volatility: 0.13 },
      { ticker: 'AIR', name: 'AeroJet Airways', price: 105, volatility: 0.11 },
      { ticker: 'SHIP', name: 'OceanFreight Inc.', price: 60, volatility: 0.07 },

      // ── Space & Defence ──
      { ticker: 'SPACE', name: 'StellarX Aerospace', price: 340, volatility: 0.15 },
      { ticker: 'DEFNS', name: 'DefenceCore Corp.', price: 200, volatility: 0.06 },
      { ticker: 'ORBIT', name: 'OrbitLink Satellites', price: 125, volatility: 0.12 },

      // ── Media & Entertainment ──
      { ticker: 'MEDIA', name: 'MediaWave Corp.', price: 115, volatility: 0.09 },
      { ticker: 'STRM', name: 'StreamFlix Inc.', price: 190, volatility: 0.10 },
      { ticker: 'MUSIC', name: 'BeatDrop Records', price: 45, volatility: 0.11 },

      // ── Real Estate & Telecom ──
      { ticker: 'REIT', name: 'Prime Realty Trust', price: 135, volatility: 0.05 },
      { ticker: 'TELCO', name: 'TelcoNet Group', price: 95, volatility: 0.06 },

      // ── Mining & Commodities ──
      { ticker: 'MINE', name: 'DeepRock Mining', price: 75, volatility: 0.12 },
      { ticker: 'GOLD', name: 'GoldVault Reserve', price: 310, volatility: 0.08 },
      { ticker: 'STEEL', name: 'IronForge Metals', price: 65, volatility: 0.09 },

      // ── Travel & Leisure ──
      { ticker: 'TRVL', name: 'TravelSphere Co.', price: 82, volatility: 0.10 },
      { ticker: 'HOTEL', name: 'GrandStay Hotels', price: 110, volatility: 0.07 },
      { ticker: 'CRUIS', name: 'OceanVoyage Lines', price: 58, volatility: 0.11 },

      // ── Meme & Speculative ──
      { ticker: 'MEME', name: 'MemeStock Inc.', price: 25, volatility: 0.25 },
      { ticker: 'MOON', name: 'ToTheMoon Fund', price: 15, volatility: 0.30 },
      { ticker: 'DOGE', name: 'DogeIndustries', price: 10, volatility: 0.28 },
      { ticker: 'APE', name: 'DiamondHands Ltd.', price: 35, volatility: 0.22 },
      { ticker: 'YOLO', name: 'YOLO Ventures', price: 20, volatility: 0.26 },
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
