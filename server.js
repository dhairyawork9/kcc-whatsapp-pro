const { getShopItems } = require('./sheetCatalogService');
const express = require('express');
const config = require('./config/constants');
const metaService = require('./services/metaService');

const app = express();
app.use(express.json());

// In-memory session tracking for language preference
const userSessions = new Map();

function getSession(from) {
  if (!userSessions.has(from)) {
    userSessions.set(from, { lang: 'gu' });
  }
  return userSessions.get(from);
}

// In-memory deduplication cache
const processedMessageIds = new Set();

// 1. Health check endpoint (for UptimeRobot keep-alive)
app.get('/', (req, res) => {
  res.status(200).send('KCC WhatsApp Pro Bot is active and running.');
});

// 2. Meta Webhook Verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.VERIFY_TOKEN) {
    console.log('[Webhook Verified Successfully]');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// 3. Incoming Message Processing
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

  // A. Plain Text: Strict "start" filter
  if (message.type === 'text') {
    const text = message.text.body.trim().toLowerCase();

    if (text === 'start') {
      console.log(`[Bot Activated] "start" received from +${from}`);
      await metaService.sendLanguageSelector(from);
    } else {
      // Completely silent: ignore all normal chatter
      console.log(`[Passthrough] Ignored message from +${from}: "${message.text.body}"`);
    }
    return;
  }

  // B. Interactive Button & List Selections
  if (message.type === 'interactive') {
    const actionId = message.interactive.button_reply?.id || message.interactive.list_reply?.id || '';
    console.log(`[Interactive Action] +${from} clicked: ${actionId}`);

    // Language selection
    if (actionId === 'lang_gu') {
      session.lang = 'gu';
      await metaService.sendMainMenu(from, 'gu');
    } else if (actionId === 'lang_en') {
      session.lang = 'en';
      await metaService.sendMainMenu(from, 'en');
    } 
    // Navigation
    else if (actionId === 'nav_menu_main') {
      await metaService.sendMainMenu(from, session.lang);
    } else if (actionId === 'nav_courses') {
      await metaService.sendCourseList(from, session.lang);
    } else if (actionId === 'nav_info') {
      await metaService.sendCentreInfo(from, session.lang);
    } 
    // --- SHOP HANDLERS START ---
    else if (actionId === 'nav_shop' || actionId === 'btn_shop' || actionId === 'menu_shop') {
      const items = await getShopItems();

      if (!items || items.length === 0) {
        const emptyMsg = session.lang === 'gu'
          ? 'હાલમાં સ્ટોકમાં વસ્તુઓ ઉપલબ્ધ નથી. કૃપા કરીને થોડા સમય પછી તપાસો.'
          : 'Currently no items available in stock. Please check back later.';
        await metaService.sendTextMessage(from, emptyMsg);
        return;
      }

      // WhatsApp list rows (maximum 10 rows per interactive list)
      const rows = items.slice(0, 10).map((item) => ({
        id: `shop_${item.id}`,
        title: item.title.slice(0, 24),
        description: `${item.price} | ${item.category}`.slice(0, 72)
      }));

      const headerText = session.lang === 'gu' ? 'કૌશલ્ય સ્ટોર' : 'KCC Store';
      const bodyText = session.lang === 'gu' 
        ? 'અમારી પાસે ઉપલબ્ધ સાધનો અને સામગ્રીની યાદી નીચે મુજબ છે. વિગતો જોવા માટે વસ્તુ પસંદ કરો:' 
        : 'Here are the available items in our store. Select an item for details:';
      const buttonLabel = session.lang === 'gu' ? 'વસ્તુઓ જુઓ' : 'View Items';
      const sectionTitle = session.lang === 'gu' ? 'ઉપલબ્ધ વસ્તુઓ' : 'Available Items';

      await metaService.sendListMessage(from, headerText, sectionTitle, bodyText, buttonLabel, [
        { title: sectionTitle, rows }
      ]);
    }
    // Individual Shop Item Clicked
    else if (actionId.startsWith('shop_item_')) {
      const items = await getShopItems();
      const rawId = actionId.replace('shop_', '');
      const selected = items.find(i => i.id === rawId);

      if (selected) {
        const itemMsg = session.lang === 'gu'
          ? `📦 *${selected.title}*\n\n💰 કિંમત: *${selected.price}*\n📂 કેટેગરી: ${selected.category}\n\nખરીદી અથવા વધુ માહિતી માટે સેન્ટરનો સંપર્ક કરો.`
          : `📦 *${selected.title}*\n\n💰 Price: *${selected.price}*\n📂 Category: ${selected.category}\n\nContact the centre to purchase or inquire.`;
        await metaService.sendTextMessage(from, itemMsg);
      }
    }
    // --- SHOP HANDLERS END ---
    // Course details & inquiry
    else if (actionId.startsWith('crs_idx_')) {
      const crsIdx = parseInt(actionId.replace('crs_idx_', ''), 10);
      await metaService.sendCourseDetails(from, crsIdx, session.lang);
    } else if (actionId.startsWith('enq_crs_')) {
      const crsIdx = parseInt(actionId.replace('enq_crs_', ''), 10);
      await metaService.handleCourseEnquiry(from, crsIdx, senderName, session.lang);
    }
  }
});

app.listen(config.PORT, () => {
  console.log(`Server started on http://localhost:${config.PORT}`);
});
