// src/services/economy.js
import User from '../models/User.js';

// Get or create user
export async function getUser(userId, username) {
  let user = await User.findOne({ userId });

  if (!user) {
    if (!username) {
      throw new Error('Username is required when creating a new user document.');
    }

    user = new User({
      userId,
      username,
      balance: 0,
    });

    await user.save();
  }

  return user;
}

// Add coins
export async function addCoins(userId, amount, username) {
  const user = await getUser(userId, username);
  user.balance += amount;
  await user.save();
  return user.balance;
}

// Remove coins (with check)
export async function removeCoins(userId, amount, username) {
  const user = await getUser(userId, username);
  if (user.balance < amount) {
    throw new Error('Insufficient balance');
  }
  user.balance -= amount;
  await user.save();
  return user.balance;
}

// Transfer coins
export async function transferCoins(fromId, toId, amount, fromUsername, toUsername) {
  if (amount <= 0) throw new Error('Amount must be positive');
  const fromUser = await getUser(fromId, fromUsername);
  const toUser = await getUser(toId, toUsername);

  if (fromUser.balance < amount) {
    throw new Error('Insufficient balance');
  }

  fromUser.balance -= amount;
  toUser.balance += amount;

  await fromUser.save();
  await toUser.save();

  return { fromBalance: fromUser.balance, toBalance: toUser.balance };
}

// Daily reward (24-hour cooldown, 100–300 coins, with streak multiplier)
export async function claimDaily(userId, username) {
  const user = await getUser(userId, username);
  const now = Date.now();
  const lastDaily = user.lastDaily ? new Date(user.lastDaily).getTime() : 0;
  const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
  const STREAK_EXPIRE = 48 * 60 * 60 * 1000; // Lose streak if 48+ hours pass

  // Check if user already claimed today
  if (now - lastDaily < DAILY_COOLDOWN) {
    const remaining = Math.ceil((DAILY_COOLDOWN - (now - lastDaily)) / 1000 / 60);
    throw new Error(`You already claimed today! Next claim in ~${remaining} minutes.`);
  }

  // Check if streak is still active (claimed within last 48 hours)
  if (now - lastDaily > STREAK_EXPIRE) {
    user.dailyStreak = 0; // Streak broken
  }

  // Increment streak
  user.dailyStreak = (user.dailyStreak || 0) + 1;

  // Calculate reward with streak multiplier
  const baseReward = Math.floor(Math.random() * 201) + 100; // 100–300
  const streak = user.dailyStreak;
  let multiplier = 1;

  if (streak >= 2) multiplier = Math.min(1 + (streak - 1) * 0.15, 2); // Max 2x at streak 6+

  const reward = Math.floor(baseReward * multiplier);

  user.balance += reward;
  user.lastDaily = now;

  await user.save();

  return {
    reward,
    streak: user.dailyStreak,
    multiplier,
  };
}

// Work (30-min cooldown, 50–150 coins)
export async function work(userId, username) {
  const user = await getUser(userId, username);
  const now = Date.now();
  const lastWork = user.lastWork ? new Date(user.lastWork).getTime() : 0;

  if (now - lastWork < 30 * 60 * 1000) {
    const remaining = Math.ceil((30 * 60 * 1000 - (now - lastWork)) / 1000 / 60);
    throw new Error(`You can work again in ~${remaining} minutes.`);
  }

  const earned = Math.floor(Math.random() * 101) + 50; // 50–150
  user.balance += earned;
  user.lastWork = now;

  await user.save();
  return earned;
}

// Leaderboard (top 10 richest in guild)
export async function getLeaderboard(guildId) {
  const users = await User.find({}).sort({ balance: -1 }).limit(10);
  return users.map((u, i) => ({
    rank: i + 1,
    userId: u.userId,
    balance: u.balance,
  }));
}