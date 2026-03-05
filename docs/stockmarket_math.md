# Stock Market Mathematical Model Documentation

This document describes the underlying math and formulas used by the stock market service (`src/services/stockMarket.js`) in ReconBuddy. It covers how prices are calculated, how market signals are derived, and the logic governing buy/sell operations.

## Initialization

On import, `initStocks()` runs automatically and ensures the following default stocks exist in the database:

| Ticker   | Name              | Starting Price | Volatility |
|----------|-------------------|----------------|------------|
| NEXI     | NEXI Coin         | 150            | 0.10       |
| TECH     | Tech Giants Inc.  | 280            | 0.08       |
| GME      | GameStop Corp.    | 45             | 0.18       |
| CRYPTO   | Crypto Index      | 220            | 0.15       |
| RETAIL   | Retail Leaders    | 75             | 0.09       |

If a ticker already exists it is left untouched.

## Constants

| Constant              | Value       | Purpose                                         |
|-----------------------|-------------|-------------------------------------------------|
| `K_IMMEDIATE`         | 0.15        | Per-trade price-impact sensitivity               |
| `MAX_IMMEDIATE_IMPACT`| 0.01 (±1%)  | Cap on a single trade's price movement           |
| `K_VOLUME`            | 0.5         | Hourly aggregate trade-volume sensitivity        |
| `MAX_VOLUME_IMPACT`   | 3.0 (±300%) | Cap on hourly trade-volume price movement        |
| `MIN_PRICE`           | 5           | Absolute price floor                             |
| Stock supply limit    | 5,000,000   | Maximum shares in circulation per ticker         |

## Price Update Overview

Prices are updated hourly via a cron job (`0 * * * *`) that calls `updateAllPrices(client)`. The algorithm applies five sequential steps to each stock's current price.

### Step 1 — Random Fluctuation

```js
const randomPct = (Math.random() - 0.5) * stock.volatility * 2;
newPrice *= (1 + randomPct);
```

This produces a uniformly distributed percentage change in the range $[-volatility,\ +volatility]$. Each stock has its own `volatility` value (see table above).

### Step 2 — Light Upward Trend

```js
const trendPct = 0.0015;
newPrice *= (1 + trendPct);
```

A constant +0.15% bias per tick prevents long-term price decay.

### Step 3 — Gentle Mean Reversion

```js
const longTermMean = stock.ticker === 'NEXI' ? 160 : 200;
const deviation = (longTermMean - newPrice) / longTermMean;
newPrice += deviation * 0.8;
```

Each ticker has a fixed target price (`longTermMean`). The deviation from that target is computed as a fraction, then scaled by 0.8 and added directly to the price. This nudges the price back toward its anchor without hard-capping it.

$$
deviation = \frac{longTermMean - price}{longTermMean}
$$

$$
newPrice = price + deviation \times 0.8
$$

### Step 4 — NEXI Server Influence (NEXI ticker only)

```js
const totalMembers = client.guilds.cache.reduce((sum, g) => sum + g.memberCount, 0);
const memberImpact = (totalMembers / 10000) * 0.008;
newPrice *= (1 + memberImpact);
```

Only the NEXI ticker receives a very small upward nudge proportional to the bot's total member count across all guilds. Other tickers are unaffected.

### Step 5 — Hourly Trade-Volume Impact

Between ticks, every `buyStock` / `sellStock` call increments `stock.metadata.pendingBuys` or `stock.metadata.pendingSells` via `recordTrade()`. During the hourly update these counters are consumed:

$$
V_{net} = pendingBuys - pendingSells
$$

$$
volumeRatio = \frac{V_{net}}{\max(1,\ S_{circ})}
$$

$$
rawVolumeImpact = K_{VOLUME} \cdot volumeRatio
$$

$$
liquidityScale = \frac{1}{1 + \log_{10}(\max(1,\ newPrice))}
$$

$$
volumeImpactPct = \operatorname{clamp}(rawVolumeImpact \cdot liquidityScale,\ -MAX\_VOLUME\_IMPACT,\ +MAX\_VOLUME\_IMPACT)
$$

$$
newPrice = newPrice \times (1 + volumeImpactPct)
$$

Where $S_{circ}$ is the current circulating supply (total shares held by all users for this ticker). The pending counters are reset to zero after each tick.

### Final Safety Bounds

After all steps:

```js
newPrice = Math.max(MIN_PRICE, Math.round(newPrice * 100) / 100);
```

The price is floored at `MIN_PRICE` (5) and rounded to two decimal places. There is no global maximum-percentage-change cap — the individual step caps (volatility range, trend constant, mean-reversion scale, volume impact cap) provide stability.

### History

The last 24 price entries are kept in `stock.history`. After each tick the new price is pushed and the oldest entry is shifted out if the array exceeds 24 elements.

---

## Trade Volume / Order Flow Impact

Trade activity (user buys and sells) exerts direct upward or downward pressure on a price. This is split into two layers: an **immediate per-trade impact** and an **hourly aggregate impact**.

### Immediate Per-Trade Impact

Each buy or sell nudges the stock price the moment the trade executes via `applyImmediateTradeImpact()`. This makes the market feel responsive and rewards early movers.

- $S_{circ}$ = current shares in circulation for this ticker (`getCirculatingSupply`)
- $liquidityScale = \frac{1}{1 + \log_{10}(\max(1,\ price))}$
- $rawImpact = \frac{quantity}{\max(1,\ S_{circ})} \times K_{IMMEDIATE} \times liquidityScale$
- $cappedImpact = \min(rawImpact,\ MAX\_IMMEDIATE\_IMPACT)$
- $direction = +1$ for buys, $-1$ for sells
- $newPrice = \max(MIN\_PRICE,\ \operatorname{round2}(price \times (1 + direction \times cappedImpact)))$

Constants (current values):
- `K_IMMEDIATE` = 0.15
- `MAX_IMMEDIATE_IMPACT` = 0.01 (±1% cap per individual trade)

This ensures single large trades cannot move the price more than 1%, while small trades relative to circulation have a proportionally smaller effect. High-priced stocks are further dampened by the liquidity scale.

### Hourly Aggregate Impact

See **Step 5** above. All trade volumes accumulated between hourly ticks via `recordTrade()` are aggregated and applied as a second layer of pressure during `updateAllPrices`.

Constants (current values):
- `K_VOLUME` = 0.5
- `MAX_VOLUME_IMPACT` = 3.0 (±300% cap per hourly tick)
- `MIN_PRICE` = 5 (absolute price floor)

### Recording Trade Volumes

`recordTrade(stock, quantity, side)` increments `stock.metadata.pendingBuys` or `stock.metadata.pendingSells` and saves the document immediately. Both `buyStock` and `sellStock` call this before applying the immediate impact.

```js
async function recordTrade(stock, quantity, side) {
  stock.metadata = stock.metadata || { pendingBuys: 0, pendingSells: 0 };
  if (side === 'buy')  stock.metadata.pendingBuys  = (stock.metadata.pendingBuys  || 0) + quantity;
  else                 stock.metadata.pendingSells = (stock.metadata.pendingSells || 0) + quantity;
  stock.markModified('metadata');
  await stock.save();
}
```

In `updateAllPrices`, $V_{net} = pendingBuys - pendingSells$ is computed, used for price impact, then both counters are reset to zero for the next tick.

---

## Buy/Sell Calculations

### Buying (`buyStock`)

1. Look up the stock by ticker.
2. Check remaining shares: `getRemainingSharesForTicker` ensures the purchase would not push circulation above the 5,000,000 share limit.
3. Cost = `Math.round(stock.price * quantity)`.
4. Balance check — user must have enough coins.
5. Deduct coins via `removeCoins`.
6. Record trade volume and apply immediate price bump.
7. Update (or create) the user's portfolio:
   - If the user already holds shares of this ticker, the average buy price is recalculated:
     $$avgBuyPrice = \frac{(oldBuyPrice \times oldQty) + (currentPrice \times newQty)}{oldQty + newQty}$$
   - Otherwise a new entry is pushed.

### Selling (`sellStock`)

1. Look up the stock by ticker.
2. Verify the user's portfolio holds enough shares.
3. Revenue = `Math.round(stock.price * quantity)`.
4. Record trade volume and apply immediate price dip.
5. Deduct shares; remove the entry entirely if quantity reaches zero.
6. Credit coins via `addCoins`.

### Circulation Tracking

Two helpers manage share supply:

**`getCirculatingSupply(ticker)`** — returns total shares currently held across all portfolios for a ticker (used for price-impact calculations):

```js
async function getCirculatingSupply(ticker) {
  const portfolios = await Portfolio.find({ 'stocks.ticker': ticker });
  let total = 0;
  for (const p of portfolios) {
    const h = p.stocks.find(s => s.ticker === ticker);
    if (h) total += h.quantity;
  }
  return total;
}
```

**`getRemainingSharesForTicker(ticker)`** — returns `5,000,000 - circulatingSupply` (used to enforce the per-stock share cap on buys).

---

## Chart Generation

The `generateChart(ticker)` helper renders a 800×400 canvas line chart of the last 24 hourly price entries:

- Background: `#2f3136` (Discord dark theme).
- Line colour: `#57f287` (green), 3px stroke.
- X-axis: evenly spaced across the canvas width.
- Y-axis: normalized by `(price - min) / (max - min)`.
- Labels: ticker name, min price, max price.

Returns a PNG buffer.

---

## Exported API

| Function                          | Description                                  |
|-----------------------------------|----------------------------------------------|
| `initStocks()`                    | Seed default stocks if missing               |
| `updateAllPrices(client)`         | Hourly price recalculation                   |
| `startPriceUpdates(client)`       | Schedule the hourly cron job                 |
| `getStock(ticker)`                | Fetch a single stock document                |
| `getMarket()`                     | Fetch all stocks sorted by price descending  |
| `buyStock(userId, username, ticker, quantity)` | Execute a buy                   |
| `sellStock(userId, ticker, quantity)` | Execute a sell                           |
| `getPortfolio(userId)`            | Return a user's holdings                     |
| `getRemainingSharesForTicker(ticker)` | Shares still available for purchase      |
| `generateChart(ticker)`           | Render a 24h price-history PNG               |
| `wipeStocks()`                    | **Owner only** — delete all stock documents  |
| `wipePortfolios()`                | **Owner only** — delete all portfolio documents |

---

This documentation should help maintainers understand and potentially modify the financial model powering ReconBuddy's stock market. For algorithm changes or new signals, consult this file and update accordingly.
