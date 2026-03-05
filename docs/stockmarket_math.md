# Stock Market Mathematical Model Documentation

This document describes the underlying math and formulas used by the stock market service (`src/services/stockMarket.js`) in ReconBuddy. It covers how prices are calculated, how market signals are derived, and the logic governing buy/sell operations.

## Price Update Overview
Prices are updated hourly using `updateAllPrices`, which applies several steps to calculate a new price for each stock. The process combines randomness with game-specific market signals and protective caps.

1. **Base Price and Constants**
   - `stock.price` – current price from the database.
   - `STOCK_CAP` – maximum total shares available for each ticker (50 000). Not used in price math but relevant for circulation.
   - `MAX_PCT_CHANGE` – the largest percentage change permitted per tick (5%).
   - `MIN_PRICE` – floor price, set to `1` to avoid zero or negative values.

2. **Random Fluctuation**
   - A basic stochastic component is added via:
     ```js
     const baseFluctuationPct = (Math.random() - 0.5) * (stock.volatility || 0.1);
     newPrice = Math.max(MIN_PRICE, newPrice * (1 + baseFluctuationPct));
     ```
   - This produces a uniformly distributed percentage change in `[-volatility/2, +volatility/2]`.
   - `stock.volatility` is provided per stock (e.g. 0.12 for NEXI).

3. **Market Signals**
   Global Discord metrics are used to nudge prices:
   - `totalMembers`, `onlineMembers`, `totalGuilds`, and `textChannels` are aggregated once per tick.
   - Previous values are stored in `stock.metadata` for delta calculations.

   **Derived percentages**:
   ```js
   const memberGrowthPct = (memberDelta / Math.max(1, prevMembers)) * memberGrowthFactor * 0.05;
   const guildGrowthPct  = (guildDelta  / Math.max(1, prevGuilds))  * 0.03;
   const engagementPct   = onlineRatio * 0.02;
   const channelActivityPct = (textChannels / Math.max(1, totalGuilds)) * messageActivityFactor * 0.02;
   ```
   - `memberGrowthFactor` and `messageActivityFactor` come from `stock.factors` (defaults to 0.02 if unspecified).
   - These formulas convert raw deltas/ratios into small impact percentages relative to the stock price.
   - `memberDelta` / `guildDelta` compute absolute growth; dividing by previous totals yields a rate.

Trade Volume / Order Flow Impact
---------------------------------
Trade activity (user buys and sells) exerts direct upward or downward pressure on a price. This is split into two layers: an **immediate per-trade impact** and an **hourly aggregate impact**.

### Immediate Per-Trade Impact
Each buy or sell nudges the stock price the moment the trade executes. This makes the market feel responsive and rewards early movers.

- $S_{circ}$ = current shares in circulation for this ticker
- $liquidityScale = \frac{1}{1 + \log_{10}(\max(1, price))}$
- $rawImpact = \frac{quantity}{\max(1, S_{circ})} \times k_{immediate} \times liquidityScale$
- $cappedImpact = \min(rawImpact,\ MAX\_IMMEDIATE\_IMPACT)$
- $direction = +1$ for buys, $-1$ for sells
- $newPrice = price \times (1 + direction \times cappedImpact)$

Constants (current values):
- `K_IMMEDIATE` = 0.15
- `MAX_IMMEDIATE_IMPACT` = 0.01 (±1% cap per individual trade)

This ensures single large trades cannot move the price more than 1%, while small trades relative to circulation have a proportionally smaller effect. High-priced stocks are further dampened by the liquidity scale.

### Hourly Aggregate Impact
In addition to immediate impacts, all trade volumes accumulated between hourly ticks are aggregated and applied as a second layer of pressure during `updateAllPrices`.

Variables and formulas:

- V_net = sum(buys - sells) over the recent window (shares)
- S_circ = current shares in circulation for the ticker (sum of all user holdings) or STOCK_CAP as a normaliser
- volumeRatio = V_net / max(1, S_circ)
- k_volume = sensitivity constant (example: 0.5)
- rawVolumeImpact = volumeRatio * k_volume
- liquidityScale = 1 / (1 + log10(max(1, stock.price)))  // same liquidity scaling used elsewhere
- volumeImpactPct = clamp(rawVolumeImpact * liquidityScale, -MAX_VOLUME_IMPACT, +MAX_VOLUME_IMPACT)

Where `MAX_VOLUME_IMPACT` is a safety cap on how much trade flow alone can move the price in one tick (example: 0.03 = 3%).

Application (pseudo-formula):

$$
V_{net} = \sum_{t=0}^{w} (buys_t - sells_t)
$$

$$
volumeRatio = \frac{V_{net}}{\max(1, S_{circ})}
$$

$$
rawVolumeImpact = k_{volume} \cdot volumeRatio
$$

$$
volumeImpactPct = \operatorname{clamp}(rawVolumeImpact \cdot liquidityScale, -MAX_{V}, MAX_{V})
$$

Then add `volumeImpactPct` to the aggregated `totalImpactPct` before the final `MAX_PCT_CHANGE` cap is applied. This keeps order-flow effects commensurate with other market signals and the existing safety limits.

Constants (current values):
- `K_VOLUME` = 0.5
- `MAX_VOLUME_IMPACT` = 0.03 (±3% cap per hourly tick)
- `MIN_PRICE` = 5 (absolute price floor)

Recording trade volumes
----------------------
To support this calculation the market needs a compact record of recent trade volumes per ticker. Recommended options:

- Maintain `stock.metadata.volumeHistory` as a short ring buffer of `{timestamp, buys, sells, net}` entries (one entry per tick, since updates run hourly).
- Maintain `stock.metadata.lastNetVolume` or `pendingBuys`/`pendingSells` as quick-access counters consumed by `updateAllPrices`.

Implementation notes:

- In `buyStock` / `sellStock`, increment a per-ticker counter or append to the current tick's `volumeHistory` entry. Example pseudocode to call from `buyStock` / `sellStock`:

```js
function recordTrade(stock, quantity, side) {
  // side === 'buy' or 'sell'
  stock.metadata = stock.metadata || {};
  stock.metadata.pendingBuys = stock.metadata.pendingBuys || 0;
  stock.metadata.pendingSells = stock.metadata.pendingSells || 0;
  if (side === 'buy') stock.metadata.pendingBuys += quantity;
  else stock.metadata.pendingSells += quantity;
}
```

Then in `updateAllPrices`, compute `V_net = pendingBuys - pendingSells` (or aggregate `volumeHistory`) and use it to compute `volumeImpactPct`, then clear the pending counters for the next tick.

Parameter guidance
------------------
- `k_volume` (sensitivity): 0.3–0.7 is a reasonable starting range. Lower makes trade flow less impactful.
- `MAX_VOLUME_IMPACT` (per-tick cap): 0.02–0.05 (2–5%) to maintain stability.
- `S_circ` normaliser: prefer current circulating supply (sum of user holdings) so small-cap tickers are affected more by the same absolute volume.

Integration point
-----------------
Add `volumeImpactPct` to `totalImpactPct` before mean reversion and liquidity scaling (or immediately after, depending on desired order of effects). The existing `MAX_PCT_CHANGE` cap will still apply, ensuring safety.

4. **Mean Reversion**
   - If the current price deviates from the recent average (last 3+ history entries), a corrective pressure is added:
     ```js
     const deviation = (stock.price - avg) / Math.max(1, avg);
     totalImpactPct += -Math.sign(deviation) * Math.min(0.02, Math.abs(deviation) * 0.05);
     ```
   - The effect opposes the direction of deviation, capped at ±2% per tick.

5. **Liquidity Scaling**
   - Higher-priced assets move less to simulate lower liquidity:
     ```js
     const liquidityScale = 1 / (1 + Math.log10(Math.max(1, stock.price)));
     totalImpactPct *= liquidityScale;
     ```
   - This shrinks the aggregate impact percentage when price grows.

6. **Capping and Application**
   - Aggregate impact is capped to `[-MAX_PCT_CHANGE, +MAX_PCT_CHANGE]`.
   - The new price is computed as:
     ```js
     newPrice = Math.max(MIN_PRICE, Math.round(newPrice * (1 + cappedPct)));
     ```
   - History is updated, and `stock.metadata` is refreshed for the next tick.

## Buy/Sell Calculations
The stock transaction functions use simple arithmetic:

- **Buying**:
  - Cost = `stock.price * quantity`.
  - Balance check ensures user has enough coins.
  - Cap check prevents buying when total shares in circulation would exceed `STOCK_CAP`.
  - Portfolio entry updates average buy price when acquiring additional shares.

- **Selling**:
  - Revenue = `stock.price * quantity`.
  - Shares are deducted from the portfolio; if quantity drops to zero, the entry is removed.
  - Coins are added back to the user via economy service.

### Circulation Tracking
To enforce caps, the code iterates all portfolios:
```js
async function getTotalSharesForTicker(ticker) {
  const portfolios = await Portfolio.find({});
  let total = 0;
  for (const portfolio of portfolios) {
    const stock = portfolio.stocks.find(s => s.ticker === ticker);
    if (stock) total += stock.quantity;
  }
  return total;
}
```
Remaining shares available = `STOCK_CAP - total`.

## Chart Generation
The `generateChart` helper normalizes historical prices to a canvas by:
- Mapping prices to an x-axis spanning the canvas width.
- Scaling y positions by `(price - min) / (max - min)`.
- Drawing a simple line chart with labelled min/max.

---

This documentation should help maintainers understand and potentially modify the financial model powering ReconBuddy's stock market. For algorithm changes or new signals, consult this file and update accordingly.