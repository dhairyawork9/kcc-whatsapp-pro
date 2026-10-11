// sheetCatalogService.js
const SHEET_ID = '11IzWbS5OJ31XbvF4FT9KBJLiuu-kBDyR7oyAyGZ3XoY';
// Direct export endpoint:
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

let cachedItems = [];
let lastFetchedAt = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

function parseCSV(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  // Parse header row
  const headers = lines[0].split(',').map(h => h.replace(/^["'\s]+|["'\s]+$/g, '').toLowerCase());
  const items = [];

  for (let i = 1; i < lines.length; i++) {
    // Regex splits commas while ignoring commas inside quotes
    const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.replace(/^["'\s]+\vert{}["'\s]+$/g, ''));
    if (!values[0]) continue;

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    const itemName = row.item || values[0];
    const category = row.category || values[1] || 'General';
    const price = row.price || values[2] || '';
    const available = (row.available || values[4] || 'Available').toLowerCase();

    // Check if available
    if (itemName && (available === 'available' || available === 'yes' || available === 'true')) {
      items.push({
        id: `item_${i}`,
        title: itemName.slice(0, 24), // Max 24 chars for WhatsApp
        category: category,
        price: price.startsWith('₹') ? price : `₹${price}`
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
    if (!res.ok) throw new Error(`Google Sheet fetch error: ${res.statusText}`);
    const csvText = await res.text();
    const parsed = parseCSV(csvText);
    
    if (parsed.length > 0) {
      cachedItems = parsed;
      lastFetchedAt = now;
      console.log(`[Shop] Successfully loaded ${cachedItems.length} items from Google Sheet`);
    } else {
      console.log('[Shop] Parsed 0 items, check sheet headers/rows.');
    }
  } catch (err) {
    console.error('[Shop Fetch Error]:', err.message);
  }

  return cachedItems;
}

module.exports = { getShopItems };
