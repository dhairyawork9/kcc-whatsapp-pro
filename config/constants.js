require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  VERIFY_TOKEN: process.env.VERIFY_TOKEN || 'kcc_pro_secret_2026',
  WHATSAPP_TOKEN: process.env.WHATSAPP_TOKEN,
  PHONE_NUMBER_ID: process.env.PHONE_NUMBER_ID,
  ADMIN_PHONE_NUMBER: process.env.ADMIN_PHONE_NUMBER,
  GRAPH_API_URL: `https://graph.facebook.com/v19.0/${process.env.PHONE_NUMBER_ID}/messages`,
  COURSES_CSV: process.env.COURSES_SHEET_CSV_URL,
  PRODUCTS_CSV: process.env.PRODUCTS_SHEET_CSV_URL
};
