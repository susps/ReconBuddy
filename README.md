# ReconBuddy

A feature-rich Discord bot built with **discord.js v14**, featuring a full economy system, stock market, casino games, moderation tools, ticket system, anti-raid protection, and a web dashboard with admin controls.

## Features

- **Economy** — Balance, daily rewards with streak multipliers, work, pay, shop, inventory, leaderboards
- **Stock Market** — 55+ tradeable stocks across 14 sectors with dynamic pricing, volatility, and portfolio tracking
- **Casino** — Slots, roulette, coinflip, jackpot, and high-low games
- **Moderation** — Ban, kick, mute, timeout, warn, purge, slowmode, anti-raid (join & message spam protection)
- **Tickets** — Support ticket creation, staff assignment, logging, archive/delete on close
- **Listeners** — Configurable event logging to channels (40+ Discord events)
- **Dashboard** — Web UI with OAuth2 login, casino, stock trading, bot stats, and admin panel
- **Admin Panel** — Guild settings editor, listener manager, and warning viewer (requires Administrator permission)
- **Utility** — Help, ping, uptime, server info, user info, invite tracking, reminders, notes, roles
- **Security** — 2FA-protected owner commands, anti-raid with configurable thresholds

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or newer
- [MongoDB](https://www.mongodb.com/) (Atlas or local instance)
- A [Discord Application](https://discord.com/developers/applications) with a bot token

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd ReconBuddy
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
# Required
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_application_id
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/reconbuddy

# Dashboard & OAuth2
DISCORD_SECRET=your_client_secret
DASHBOARD_URL=http://localhost:3001
DASHBOARD_PORT=3001
COOKIE_SECRET=random_secret_string

# Bot config
OWNER_IDS=your_discord_id
LOG_CHANNEL_ID=channel_id_for_bot_logs

# Optional
NODE_ENV=development
LOG_LEVEL=info
DISCORD_LOG_WEBHOOK=https://discord.com/api/webhooks/...
OWNER_2FA_SECRET=base32_secret_for_owner_2fa
RIOT_API_KEY=your_riot_api_key
```

### 4. Deploy slash commands

```bash
npm run deploy
```

This registers all slash commands with Discord. Run this again whenever you add or change commands.

### 5. Seed stock market data (optional)

```bash
node scripts/ensureStocks.js
```

### 6. Start the bot

```bash
# Production
npm start

# Development (auto-reload on file changes)
npm run dev
```

The dashboard will be available at `http://localhost:3001` (or your configured `DASHBOARD_URL`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the bot |
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm run deploy` | Deploy slash commands to Discord |
| `npm run clear` | Remove all registered slash commands |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## Project Structure

```
ReconBuddy/
├── config/              # Global config files (welcome.json)
├── dashboard/public/    # Dashboard web UI
├── data/                # Runtime data (antiraid, tickets, invites)
├── scripts/             # Setup scripts (deploy commands, seed stocks)
├── src/
│   ├── index.js         # Entry point — bot startup + Express server
│   ├── commands/        # Slash commands organized by category
│   │   ├── economy/     # balance, daily, pay, shop, stock, work
│   │   ├── fun/         # casino, slots, roulette, coinflip, etc.
│   │   ├── moderation/  # ban, kick, warn, mute, antiraid setup
│   │   ├── owner/       # eval, reload, dbwipe (2FA-protected)
│   │   └── utility/     # help, ping, tickets, listeners, notes
│   ├── components/      # Button, modal, and select menu handlers
│   ├── events/          # Discord event handlers
│   ├── handlers/        # Component loader
│   ├── models/          # Mongoose schemas (User, Stock, Portfolio, ShopItem)
│   ├── services/        # Business logic (economy, stock market, tickets, etc.)
│   └── utils/           # Logger, database, status rotator
├── listeners.json       # Event listener configuration
├── warnings.json        # User warnings data
└── package.json
```

## Dashboard

The dashboard runs on Express alongside the bot process and provides:

- **Casino** — Play slots, roulette, coinflip, and jackpot from the browser
- **Stock Market** — View live prices, buy/sell shares, manage portfolio
- **Bot Stats** — Uptime, memory usage, guild count, user count
- **User Profile** — View balance, daily streak, portfolio, and warnings
- **Admin Panel** — Server management for users with Administrator permission:
  - **Settings** — Welcome messages, ticket config, anti-raid thresholds
  - **Listeners** — Add/remove event logging channels
  - **Warnings** — View and remove user warnings

Authentication uses Discord OAuth2. Only guilds where the user has Administrator permission and the bot is present appear in the admin panel.

## Discord Bot Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application and add a bot
3. Enable these **Privileged Gateway Intents**:
   - Server Members Intent
   - Message Content Intent
4. Generate an invite URL with these scopes: `bot`, `applications.commands`
5. Required bot permissions: `Administrator` (or individually: Manage Roles, Kick/Ban Members, Manage Channels, Manage Messages, etc.)

## OAuth2 Redirect URI

For the dashboard login, add this redirect URI in your Discord application's OAuth2 settings:

```
http://localhost:3001/auth/callback
```

Replace with your production URL as needed.

## License

ISC
