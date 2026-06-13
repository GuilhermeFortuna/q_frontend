export interface NewsArticle {
  id: string
  title: string
  source: string
  publishedAt: string
  summary: string
  content: string
  videoUrl?: string
}

export const mockArticles: NewsArticle[] = [
  {
    id: 'fed-rates-2026',
    title: 'Fed Signals Shift: Pivot Expected on Inflation Softening',
    source: 'Reuters Financial',
    publishedAt: '2 hours ago',
    summary:
      'Federal Reserve officials signaled they are nearing a rate cut, pointing to a cooling labor market and easing inflation figures.',
    content: `WASHINGTON — The Federal Reserve held its benchmark interest rate steady on Wednesday but opened the door to a rate cut at its next meeting, citing progress toward its inflation target and a cooling labor market.\n\nIn its policy statement, the central bank said inflation has eased over the past year but "remains somewhat elevated." However, it noted that there has been "some further progress" toward its 2 percent inflation goal.\n\nFed Chair Jerome Powell said in a press conference that a rate cut could be on the table for the upcoming meeting if the economic data continues to show cooling inflation. "The consensus of the committee is that we are getting closer to the point where it will be appropriate to reduce our policy rate," Powell said.\n\nQuantitative strategists should prepare for potential volatility spikes in short-term interest rate futures (STIRs). Forward yield curves are already shifting, indicating high probability of a 25 basis point reduction. Backtests on trend-following strategies during past easing cycles suggest allocating to duration plays could yield high Sharpe ratios over the medium term.`,
  },
  {
    id: 'vale3-iron-ore-surge',
    title: 'VALE3 Rallies 4.2% as Iron Ore Rebounds Above $110/Ton',
    source: 'Bloomberg Markets',
    publishedAt: '4 hours ago',
    summary:
      'Shares of mining giant Vale SA surged in early trading following a significant rebound in iron ore futures on global exchanges.',
    content: `SÃO PAULO — Vale SA (VALE3) shares rallied 4.2% in trading today, leading gains on the B3 index after benchmark iron ore futures surged back above $110 per metric ton on major global exchanges.\n\nAnalysts attribute the price recovery to restocking activity by Chinese steel mills ahead of the winter season and speculations regarding a new economic stimulus package from Beijing targeting infrastructure.\n\n"We are seeing a sudden squeeze in the spot market," said Marcus Thorne, a senior commodities researcher at MetalCorp. "Inventories at ports are low, and the immediate demand for high-grade iron ore remains robust, which directly benefits premium producers like Vale."\n\nFor quantitative traders, the correlation between VALE3 and iron ore futures is reaching a rolling 30-day high of 0.82. Mean-reversion algorithms that exploit short-term spreads between the physical commodity futures and ADR equity tickers have triggered buy signals. Portfolio managers are recommended to hedge currency exposure using local futures (WDO$).`,
  },
  {
    id: 'order-book-microstructure',
    title: 'VIDEO: Explaining High-Frequency Market Microstructure',
    source: 'Quant Academy',
    publishedAt: '1 day ago',
    summary:
      'An educational guide and video lecture detailing order book dynamics, queue position, and market microstructure strategies.',
    content: `Understanding how orders are matched, queued, and executed at the microsecond level is key to designing profitable high-frequency trading (HFT) algorithms.\n\nIn this video lecture, Dr. Sarah Jenkins breaks down the mechanics of Limit Order Books (LOB), explaining the differences between price-time priority queues and pro-rata allocation systems. She also reviews the impact of latency arbitrage on market makers and how retail traders can minimize slippage.\n\nKey Concepts covered:\n1. Limit Orders vs. Market Orders impact on liquidity.\n2. Information asymmetry and the Bid-Ask Spread.\n3. The role of Order Flow Toxicity (VPIN metrics).\n\nWatch the full video lecture below to learn how to incorporate limit order queue metrics into your strategy backtests.`,
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  },
]
