import { MongoClient, ServerApiVersion } from 'mongodb';

async function initDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI?.trim();

  if (!MONGODB_URI) {
    console.warn('No MONGODB_URI provided – database disabled');
    return;
  }

  try {
    const mongo = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });

    await mongo.connect();
    await mongo.db().command({ ping: 1 });

    client.db = mongo.db(); // or mongo.db('nexi') if you have a specific DB name
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    client.db = null;
  }
}