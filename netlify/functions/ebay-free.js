import * as cheerio from "cheerio";

export async function handler(event) {
  const query = event.queryStringParameters.q;

  if (!query) {
    return { statusCode: 400, body: JSON.stringify({ error: "Recherche vide" }) };
  }

  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "fr-FR,fr;q=0.9"
  };

  try {
    // 1. Objets VENDUS sur eBay
    const soldUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Complete=1&LH_Sold=1`;
    const soldRes = await fetch(soldUrl, { headers });
    const soldHtml = await soldRes.text();
    const $sold = cheerio.load(soldHtml);

    const prices = [];
    $sold(".s-item__price").each((_, el) => {
      const txt = $sold(el).text().replace(/\s/g, '').replace(',', '.');
      const match = txt.match(/(\d+\.?\d*)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (val > 1) prices.push(val);
      }
    });

    // 2. Objets EN VENTE actuellement
    const activeUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent(query)}`;
    const activeRes = await fetch(activeUrl, { headers });
    const activeHtml = await activeRes.text();
    const $active = cheerio.load(activeHtml);
    
    let activeCount = $active(".s-item").length - 1;
    activeCount = Math.max(activeCount, 1);
    const soldCount = prices.length;

    prices.sort((a, b) => a - b);
    const medianPrice = prices.length > 0 ? prices[Math.floor(prices.length / 2)] : 0;

    // 3. Calcul de la demande (STR)
    const str = Math.round((soldCount / activeCount) * 100);

    // 4. Calcul du Prix Max pour un x3 net
    // Revente nette = Prix médian - 15% (commissions) - 2€ (frais emballage)
    const netResale = (medianPrice * 0.85) - 2;
    
    // Pour tripler sa mise : Prix max d'achat = Net divisé par 3
    let maxBuyPrice = 0;
    if (netResale > 6 && soldCount >= 2) {
      maxBuyPrice = Math.floor(netResale / 3);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        medianPrice,
        maxPrice: maxBuyPrice,
        str,
        soldCount,
        activeCount
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
