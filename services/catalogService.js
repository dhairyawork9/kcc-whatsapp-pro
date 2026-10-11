const axios = require('axios');
const config = require('../config/constants');

// Parse basic CSV text into clean rows
function parseCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    // Regex matches CSV columns handling quoted commas safely
    const matches = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
    const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));

    if (cols.length >= headers.length) {
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] || '';
      });
      rows.push(row);
    }
  }
  return rows;
}

// Fetch Courses from Google Sheet CSV (with offline fallback)
async function fetchCourses() {
  if (!config.COURSES_CSV) {
    return [
      { index: 1, name: 'CCC (Basic Computer)', name_gu: 'CCC (બેઝિક કમ્પ્યુટર)', duration: '3 Months', fee: '₹2,500', syllabus: 'Windows, MS Word, Excel, PowerPoint, Internet' },
      { index: 2, name: 'Tally Prime with GST', name_gu: 'ટેલી પ્રાઇમ (GST સાથે)', duration: '2.5 Months', fee: '₹3,500', syllabus: 'Accounting, Inventory, GST Invoicing, Balance Sheet' },
      { index: 3, name: 'DTP & Graphic Design', name_gu: 'DTP અને ગ્રાફિક ડિઝાઇન', duration: '2 Months', fee: '₹3,000', syllabus: 'Photoshop, CorelDRAW, PageMaker, Printing prep' }
    ];
  }

  try {
    const res = await axios.get(config.COURSES_CSV, { timeout: 5000 });
    const rows = parseCSV(res.data);
    return rows.map((r, idx) => ({
      index: idx + 1,
      name: r['Course Name'] || r['name'] || 'Course',
      name_gu: r['Course Name (GU)'] || r['name_gu'] || r['Course Name'] || 'Course',
      duration: r['Duration'] || r['duration'] || '',
      fee: r['Fee'] || r['fee'] || '',
      syllabus: r['Syllabus'] || r['syllabus'] || ''
    }));
  } catch (err) {
    console.error('[Catalog Error] Failed to fetch courses CSV, using fallback:', err.message);
    return [];
  }
}

// Fetch Products from Google Sheet CSV (with offline fallback)
async function fetchProducts() {
  if (!config.PRODUCTS_CSV) {
    return [
      { index: 1, category: 'Keyboards & Mouse', category_gu: 'કીબોર્ડ અને માઉસ', item: 'USB Optical Mouse', item_gu: 'USB ઓપ્ટિકલ માઉસ', price: '₹180', status: 'In Stock' },
      { index: 2, category: 'Keyboards & Mouse', category_gu: 'કીબોર્ડ અને માઉસ', item: 'Multimedia Keyboard', item_gu: 'મલ્ટિમીડિયા કીબોર્ડ', price: '₹350', status: 'In Stock' },
      { index: 3, category: 'Cables & Adapters', category_gu: 'કેબલ અને એડેપ્ટર', item: 'HDMI Cable (1.5m)', item_gu: 'HDMI કેબલ (1.5m)', price: '₹120', status: 'In Stock' },
      { index: 4, category: 'Storage Devices', category_gu: 'સ્ટોરેજ ડિવાઇસ', item: '32GB USB 3.0 Pen Drive', item_gu: '32GB પેન ડ્રાઇવ', price: '₹320', status: 'In Stock' }
    ];
  }

  try {
    const res = await axios.get(config.PRODUCTS_CSV, { timeout: 5000 });
    const rows = parseCSV(res.data);
    return rows.map((r, idx) => ({
      index: idx + 1,
      category: r['Category'] || r['category'] || 'Accessories',
      category_gu: r['Category (GU)'] || r['category_gu'] || r['Category'] || 'Accessories',
      item: r['Item Name'] || r['item'] || 'Item',
      item_gu: r['Item Name (GU)'] || r['item_gu'] || r['Item Name'] || 'Item',
      price: r['Price'] || r['price'] || '',
      status: r['Status'] || r['status'] || 'In Stock'
    }));
  } catch (err) {
    console.error('[Catalog Error] Failed to fetch products CSV, using fallback:', err.message);
    return [];
  }
}

module.exports = {
  fetchCourses,
  fetchProducts
};
