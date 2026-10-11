const SHEET_ID = '11IzWbS5OJ31XbvF4FT9KBJLiuu-kBDyR7oyAyGZ3XoY';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;

let cachedItems = [];
let lastFetchedAt = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // Refreshes every 5 minutes

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^"\vert{}"$/g, '').trim());
    if (values.length < headers.length) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    if (row.item && (!row.available || row.available.toLowerCase() === 'available')) {
      items.push({
        id: `item_${i}`,
        title: row.item.slice(0, 24),
        category: row.category || 'General',
        price: `₹${row.price}`,
        unit: row.unit || ''
      });
    }
  }
  return items;
}

async function getShopItems() {
  const now = Date.now();
  if (cachedItems.length > 0 && (now - lastFetchedAt) < CACHE_DURATION_MS) {
    return cachedItems;
  }

  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) throw new Error(`Fetch error: ${res.statusText}`);
    const csvText = await res.text();
    cachedItems = parseCSV(csvText);
    lastFetchedAt = now;
    console.log(`[Shop] Loaded ${cachedItems.length} items from Google Sheet`);
  } catch (err) {
    console.error('[Shop Fetch Error]:', err.message);
  }

  return cachedItems;
}

module.exports = { getShopItems };
