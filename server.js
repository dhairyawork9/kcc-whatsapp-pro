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