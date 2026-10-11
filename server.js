const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());

// ==========================================
// 1. ENVIRONMENT CONFIG & SESSION STATE
// ==========================================
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'kcc_secure_webhook_verify_token_2026';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;

// Track language preference and state in memory
const userSessions = new Map();
function getSession(from) {
  if (!userSessions.has(from)) {
    userSessions.set(from, { lang: 'gu', active: true });
  }
  return userSessions.get(from);
}

// In-memory deduplication cache
const processedMessageIds = new Set();

// ==========================================
// 2. EMBEDDED DATA: COURSES & SHOP INVENTORY
// ==========================================
const coursesData = [
  {
    id: 1,
    title: 'CCC',
    fullName: 'Course on Computer Concepts (CCC)',
    duration: '3 Months',
    fee: '₹2,500',
    details: 'Computer Fundamentals, MS Office (Word, Excel, PowerPoint), Gujarati/English Typing, Internet & Email. Ideal for government exam requirements.'
  },
  {
    id: 2,
    title: 'Tally Prime + GST',
    fullName: 'Tally Prime with GST Certification',
    duration: '2 Months',
    fee: '₹3,500',
    details: 'Accounting entries, balance sheets, inventory control, GST billing, and return filing basics.'
  },
  {
    id: 3,
    title: 'DCA Diploma',
    fullName: 'Diploma in Computer Applications (DCA)',
    duration: '6 Months',
    fee: '₹5,000',
    details: 'Comprehensive computer training including advanced MS Office, DTP, Photoshop basics, and internet tools.'
  }
];

const shopData = [
  { id: 'item_1', title: 'Logitech Keyboard', price: '₹350', category: 'Accessories' },
  { id: 'item_2', title: 'Zebronics Mouse', price: '₹250', category: 'Accessories' },
  { id: 'item_3', title: 'SMPS Power Supply', price: '₹150', category: 'Accessories' },
  { id: 'item_4', title: 'Power Cable', price: '₹150', category: 'Cables' },
  { id: 'item_5', title: 'Audio Wire', price: '₹100', category: 'Cables' },
  { id: 'item_6', title: 'Battery Cell', price: '₹10', category: 'Accessories' },
  { id: 'item_7', title: 'WiFi Adapter', price: '₹250', category: 'Adapters' },
  { id: 'item_8', title: 'Bluetooth Adapter', price: '₹250', category: 'Adapters' }
];

// ==========================================
// 3. WHATSAPP CLOUD API HELPERS
// ==========================================
function sendWhatsAppPayload(payload) {
  return new Promise((resolve, reject) => {
    const dataString = JSON.stringify(payload);
    const options = {
      hostname: 'graph.facebook.com',
      path: `/v18.0/${PHONE_NUMBER_ID}/messages`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            console.error('[Meta API Error Body]:', body);
            reject(new Error(`Meta API HTTP ${res.statusCode}: ${body}`));
          }
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', (err) => {
      console.error('[Network Error]:', err.message);
      reject(err);
    });

    req.write(dataString);
    req.end();
  });
}

async function sendTextMessage(to, text) {
  return sendWhatsAppPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: { body: text }
  });
}

// WhatsApp Interactive Button Message (Max 3 buttons)
async function sendButtons(to, bodyText, buttons) {
  return sendWhatsAppPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) }
        }))
      }
    }
  });
}

// WhatsApp Interactive List Message (Up to 10 rows)
async function sendList(to, headerText, bodyText, buttonLabel, sectionTitle, rows) {
  return sendWhatsAppPayload({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: headerText.slice(0, 60) },
      body: { text: bodyText },
      footer: { text: 'Kaushalya Computer Centre' },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [
          {
            title: sectionTitle.slice(0, 24),
            rows: rows.map(r => ({
              id: r.id,
              title: r.title.slice(0, 24),
              description: (r.description || '').slice(0, 72)
            }))
          }
        ]
      }
    }
  });
}

// ==========================================
// 4. STEP-BY-STEP SCREEN FLOWS
// ==========================================

// Step 1: Greeting & Language Picker
async function sendWelcomeScreen(to) {
  const greeting = "નમસ્તે! કૌશલ્ય કોમ્પ્યુટર સેન્ટરમાં તમારું સ્વાગત છે.\n\nWelcome to Kaushalya Computer Centre (KCC).\n\nકૃપા કરીને તમારી ભાષા પસંદ કરો / Please select your language:";
  const buttons = [
    { id: 'lang_gu', title: 'ગુજરાતી' },
    { id: 'lang_en', title: 'English' }
  ];
  return sendButtons(to, greeting, buttons);
}

// Step 2: Main Menu (Courses / Shop / Contact)
async function sendMainMenu(to, lang) {
  const isGu = lang === 'gu';
  const text = isGu
    ? "મુખ્ય મેનુ:\n\nતમે કઈ માહિતી મેળવવા માંગો છો તે પસંદ કરો:"
    : "Main Menu:\n\nPlease select what you would like to explore:";

  const buttons = [
    { id: 'nav_courses', title: isGu ? '🎓 કોર્સ માહિતી' : '🎓 Courses' },
    { id: 'nav_shop_menu', title: isGu ? '🏪 સ્ટોર સાધનો' : '🏪 Shop Items' },
    { id: 'nav_contact', title: isGu ? '📞 સંપર્ક વિગત' : '📞 Contact Us' }
  ];
  return sendButtons(to, text, buttons);
}

// Step 3: Courses List
async function sendCourseListScreen(to, lang) {
  const isGu = lang === 'gu';
  const header = isGu ? "કોર્સ યાદી" : "Course Catalog";
  const body = isGu ? "નીચે આપેલ લિસ્ટમાંથી જે કોર્સની વિગતો જાણવી હોય તે પસંદ કરો:" : "Select a course to view duration, syllabus and fee details:";
  const buttonLabel = isGu ? "કોર્સ પસંદ કરો" : "Select Course";
  const sectionTitle = isGu ? "ઉપલબ્ધ કોર્સ" : "Available Courses";

  const rows = coursesData.map(c => ({
    id: `crs_view_${c.id}`,
    title: c.title,
    description: `${c.duration} | ${c.fee}`
  }));

  return sendList(to, header, body, buttonLabel, sectionTitle, rows);
}

// Step 4: Course Details Screen (With Inquiry / Back / Stop)
async function sendCourseDetailsScreen(to, courseId, lang) {
  const isGu = lang === 'gu';
  const course = coursesData.find(c => c.id === courseId);
  if (!course) return sendMainMenu(to, lang);

  let details = isGu
    ? `🎓 *${course.fullName}*\n\n⏱️ *સમયગાળો:* ${course.duration}\n💰 *ફી:* ${course.fee}\n\n📝 *વિગત:* ${course.details}`
    : `🎓 *${course.fullName}*\n\n⏱️ *Duration:* ${course.duration}\n💰 *Fees:* ${course.fee}\n\n📝 *Details:* ${course.details}`;

  const buttons = [
    { id: `enq_crs_${course.id}`, title: isGu ? 'ઇન્ક્વાયરી કરો' : 'Inquire Now' },
    { id: 'nav_menu_main', title: isGu ? 'મુખ્ય મેનુ' : 'Main Menu' },
    { id: 'flow_stop', title: isGu ? 'બંધ કરો' : 'Stop' }
  ];
  return sendButtons(to, details, buttons);
}

// Step 5: Shop Options (Filter by Category OR Full List)
async function sendShopMenuScreen(to, lang) {
  const isGu = lang === 'gu';
  const text = isGu
    ? "🏪 *કૌશલ્ય સ્ટોર*\n\nતમે સામગ્રી કેવી રીતે જોવા માંગો છો તે પસંદ કરો:"
    : "🏪 *KCC Store*\n\nChoose how you would like to view our store inventory:";

  const buttons = [
    { id: 'shop_by_cat', title: isGu ? 'કેટેગરી મુજબ' : 'By Category' },
    { id: 'shop_full_list', title: isGu ? 'બધી વસ્તુઓ' : 'Full List' },
    { id: 'nav_menu_main', title: isGu ? 'મુખ્ય મેનુ' : 'Main Menu' }
  ];
  return sendButtons(to, text, buttons);
}

// Step 6: Shop Categories Picker
async function sendShopCategoriesScreen(to, lang) {
  const isGu = lang === 'gu';
  const categories = [...new Set(shopData.map(item => item.category))];

  const header = isGu ? "કેટેગરી પસંદ કરો" : "Select Category";
  const body = isGu ? "જે કેટેગરીના સાધનો જોવા હોય તે પસંદ કરો:" : "Choose a category to view items:";
  const buttonLabel = isGu ? "કેટેગરી જુઓ" : "View Categories";
  const sectionTitle = isGu ? "કેટેગરી યાદી" : "Categories";

  const rows = categories.map((cat, idx) => ({
    id: `shop_cat_${idx}_${cat}`,
    title: cat,
    description: `View items under ${cat}`
  }));

  return sendList(to, header, body, buttonLabel, sectionTitle, rows);
}

// Step 7: Display Filtered Category Items
async function sendShopCategoryItemsScreen(to, categoryName, lang) {
  const isGu = lang === 'gu';
  const filtered = shopData.filter(i => i.category.toLowerCase() === categoryName.toLowerCase());

  let text = isGu ? `📂 *કેટેગરી: ${categoryName}*\n\n` : `📂 *Category: ${categoryName}*\n\n`;
  filtered.forEach((item, idx) => {
    text += `${idx + 1}. *${item.title}* - ${item.price}\n`;
  });

  const buttons = [
    { id: 'shop_by_cat', title: isGu ? 'બીજી કેટેગરી' : 'Other Category' },
    { id: 'nav_menu_main', title: isGu ? 'મુખ્ય મેનુ' : 'Main Menu' },
    { id: 'flow_stop', title: isGu ? 'બંધ કરો' : 'Stop' }
  ];
  return sendButtons(to, text, buttons);
}

// Step 8: Full Shop Inventory Screen
async function sendFullShopListScreen(to, lang) {
  const isGu = lang === 'gu';
  let text = isGu ? "📦 *કૌશલ્ય સ્ટોર: સંપૂર્ણ લિસ્ટ*\n\n" : "📦 *KCC Store: Complete Inventory*\n\n";

  shopData.forEach((item, idx) => {
    text += `${idx + 1}. *${item.title}*\n   💰 ભાવ: *${item.price}* (${item.category})\n`;
  });

  text += isGu
    ? "\nખરીદી માટે સેન્ટર પર રૂબરૂ મુલાકાત લો."
    : "\nVisit our centre to purchase or pickup items.";

  const buttons = [
    { id: 'nav_shop_menu', title: isGu ? 'સ્ટોર મેનુ' : 'Store Menu' },
    { id: 'nav_menu_main', title: isGu ? 'મુખ્ય મેનુ' : 'Main Menu' },
    { id: 'flow_stop', title: isGu ? 'બંધ કરો' : 'Stop' }
  ];
  return sendButtons(to, text, buttons);
}

// Step 9: Contact Us Screen
async function sendContactScreen(to, lang) {
  const isGu = lang === 'gu';
  const text = isGu
    ? "📍 *કૌશલ્ય કોમ્પ્યુટર સેન્ટર (KCC)*\n\n🏢 *સરનામું:* કપડવંજ, ગુજરાત\n📞 *ફોન નંબર:* +91 94272 21062\n🕒 *સમય:* સોમવાર - શનિવાર (સવારે 8:00 થી સાંજે 7:00)\n\nકોમ્પ્યુટર ક્લાસ, જોબ ટ્રેનિંગ અને કોમ્પ્યુટર એક્સેસરીઝ માટે પધારો."
    : "📍 *Kaushalya Computer Centre (KCC)*\n\n🏢 *Address:* Kapadvanj, Gujarat\n📞 *Contact:* +91 94272 21062\n🕒 *Timings:* Monday to Saturday (8:00 AM - 7:00 PM)\n\nVisit us for computer courses, certifications, and hardware accessories.";

  const buttons = [
    { id: 'nav_menu_main', title: isGu ? 'મુખ્ય મેનુ' : 'Main Menu' },
    { id: 'flow_stop', title: isGu ? 'બંધ કરો' : 'Stop' }
  ];
  return sendButtons(to, text, buttons);
}

// ==========================================
// 5. SERVER ROUTES & WEBHOOKS
// ==========================================
app.get('/', (req, res) => {
  res.status(200).send('KCC WhatsApp Single-File Service Active.');
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (!body.object || !body.entry?.[0]?.changes?.[0]?.value?.messages) return;

  const value = body.entry[0].changes[0].value;
  const message = value.messages[0];
  const messageId = message.id;
  const from = message.from;
  const senderName = value.contacts?.[0]?.profile?.name || 'Customer';

  // Deduplication check
  if (processedMessageIds.has(messageId)) return;
  processedMessageIds.add(messageId);
  if (processedMessageIds.size > 500) {
    processedMessageIds.delete(processedMessageIds.values().next().value);
  }

  const session = getSession(from);

  // A. Plain Text Handling
  if (message.type === 'text') {
    const text = message.text.body.trim().toLowerCase();

    if (text === 'start' || text === 'hi' || text === 'hello') {
      session.active = true;
      await sendWelcomeScreen(from);
    } else if (text === 'stop') {
      session.active = false;
      await sendTextMessage(from, "તમારો આભાર! ફરી વાતચીત કરવા 'start' લખીને મોકલો.\n\nThank you! Send 'start' anytime to talk again.");
    }
    return;
  }

  // B. Interactive Reply Handling
  if (message.type === 'interactive') {
    const actionId = message.interactive.button_reply?.id || message.interactive.list_reply?.id || '';
    console.log(`[Action Received] +${from} clicked: ${actionId}`);

    // Stop flow
    if (actionId === 'flow_stop') {
      session.active = false;
      const bye = session.lang === 'gu'
        ? "તમારો આભાર! કોઈ પણ સહાય માટે તમે 'start' લખી શકો છો."
        : "Thank you! You can type 'start' whenever you need help.";
      await sendTextMessage(from, bye);
      return;
    }

    // Language Selection
    if (actionId === 'lang_gu') {
      session.lang = 'gu';
      await sendMainMenu(from, 'gu');
    } else if (actionId === 'lang_en') {
      session.lang = 'en';
      await sendMainMenu(from, 'en');
    }

    // Main Menu Navigation
    else if (actionId === 'nav_menu_main') {
      await sendMainMenu(from, session.lang);
    }

    // Courses Flow
    else if (actionId === 'nav_courses') {
      await sendCourseListScreen(from, session.lang);
    } else if (actionId.startsWith('crs_view_')) {
      const crsId = parseInt(actionId.replace('crs_view_', ''), 10);
      await sendCourseDetailsScreen(from, crsId, session.lang);
    } else if (actionId.startsWith('enq_crs_')) {
      const crsId = parseInt(actionId.replace('enq_crs_', ''), 10);
      const crs = coursesData.find(c => c.id === crsId);
      const enqReply = session.lang === 'gu'
        ? `✅ આભાર ${senderName}! અમે *${crs.fullName}* માટે તમારી ઇન્ક્વાયરી નોંધી લીધી છે. અમારો પ્રતિનિધિ ટૂંક સમયમાં તમારો સંપર્ક કરશે.`
        : `✅ Thank you ${senderName}! We have received your inquiry for *${crs.fullName}*. Our team will contact you shortly.`;
      
      await sendTextMessage(from, enqReply);
      await sendMainMenu(from, session.lang);
    }

    // Shop Flow
    else if (actionId === 'nav_shop_menu') {
      await sendShopMenuScreen(from, session.lang);
    } else if (actionId === 'shop_by_cat') {
      await sendShopCategoriesScreen(from, session.lang);
    } else if (actionId.startsWith('shop_cat_')) {
      const categoryName = actionId.split('_').slice(3).join('_');
      await sendShopCategoryItemsScreen(from, categoryName, session.lang);
    } else if (actionId === 'shop_full_list') {
      await sendFullShopListScreen(from, session.lang);
    }

    // Contact Flow
    else if (actionId === 'nav_contact' || actionId === 'nav_info') {
      await sendContactScreen(from, session.lang);
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
