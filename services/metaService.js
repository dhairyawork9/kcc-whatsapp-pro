const axios = require('axios');
const config = require('../config/constants');
const catalogService = require('./catalogService');

// Base HTTP request to Meta Graph API
async function sendRaw(payload) {
  if (!config.WHATSAPP_TOKEN || !config.PHONE_NUMBER_ID) {
    console.log('[Meta API Mock Output]:', JSON.stringify(payload, null, 2));
    return;
  }

  try {
    const res = await axios.post(config.GRAPH_API_URL, payload, {
      headers: {
        Authorization: `Bearer ${config.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    return res.data;
  } catch (err) {
    console.error('[Meta API Send Error]:', err.response?.data || err.message);
  }
}

// 1. Send Simple Plain Text
async function sendTextMessage(to, text) {
  return sendRaw({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  });
}

// 2. Step 1 Menu: Language Selector (Triggered by "start")
async function sendLanguageSelector(to) {
  return sendRaw({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: { type: 'text', text: 'Kaushalya Computer Centre' },
      body: { text: 'નમસ્તે! Please select your preferred language:\nકૃપા કરીને તમારી ભાષા પસંદ કરો:' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'lang_gu', title: 'ગુજરાતી' } },
          { type: 'reply', reply: { id: 'lang_en', title: 'English' } }
        ]
      }
    }
  });
}

// 3. Step 2 Menu: Main Menu (Bilingual)
async function sendMainMenu(to, lang = 'gu') {
  const isGu = lang === 'gu';
  const bodyText = isGu
    ? 'કૌશલ્ય કમ્પ્યુટર સેન્ટરમાં આપનું સ્વાગત છે. તમને શેમાં રસ છે?'
    : 'Welcome to Kaushalya Computer Centre. How can we help you today?';

  return sendRaw({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'nav_courses', title: isGu ? 'કોમ્પ્યુટર કોર્સ' : 'Courses' } },
          { type: 'reply', reply: { id: 'nav_shop_menu', title: isGu ? 'દુકાન એક્સેસરીઝ' : 'Shop Items' } },
          { type: 'reply', reply: { id: 'nav_info', title: isGu ? 'કેન્દ્ર માહિતી' : 'About KCC' } }
        ]
      }
    }
  });
}

// 4. Send Courses as Interactive List
async function sendCourseList(to, lang = 'gu') {
  const isGu = lang === 'gu';
  const courses = await catalogService.fetchCourses();

  const rows = courses.slice(0, 10).map(c => ({
    id: `crs_idx_${c.index}`,
    title: (isGu ? c.name_gu : c.name).substring(0, 24),
    description: `${c.duration} | ${c.fee}`.substring(0, 72)
  }));

  return sendRaw({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: isGu ? 'ઉપલબ્ધ કોર્સ' : 'Available Courses' },
      body: { text: isGu ? 'વિગતવાર માહિતી મેળવવા માટે કોઈપણ કોર્સ પસંદ કરો:' : 'Select any course below for syllabus and fee details:' },
      action: {
        button: isGu ? 'કોર્સ પસંદ કરો' : 'View Courses',
        sections: [{ title: isGu ? 'કોર્સ યાદી' : 'Course List', rows }]
      }
    }
  });
}

// 5. Send Specific Course Details with "Inquire" button
async function sendCourseDetails(to, courseIndex, lang = 'gu') {
  const isGu = lang === 'gu';
  const courses = await catalogService.fetchCourses();
  const course = courses.find(c => c.index === courseIndex) || courses[0];

  const details = isGu
    ? `🎓 *${course.name_gu}*\n\n⏱ *સમયગાળો:* ${course.duration}\n💰 *ફી:* ${course.fee}\n\n📚 *અભ્યાસક્રમ (Syllabus):*\n${course.syllabus}`
    : `🎓 *${course.name}*\n\n⏱ *Duration:* ${course.duration}\n💰 *Fee:* ${course.fee}\n\n📚 *Syllabus:*\n${course.syllabus}`;

  return sendRaw({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: details },
      action: {
        buttons: [
          { type: 'reply', reply: { id: `enq_crs_${course.index}`, title: isGu ? 'એડમિશન પૂછપરછ' : 'Inquire Now' } },
          { type: 'reply', reply: { id: 'nav_courses', title: isGu ? 'બીજા કોર્સ' : 'Other Courses' } },
          { type: 'reply', reply: { id: 'nav_menu_main', title: isGu ? 'મુખ્ય મેનુ' : 'Main Menu' } }
        ]
      }
    }
  });
}

// 6. Handle Course Inquiry -> Notify Admin
async function handleCourseEnquiry(from, courseIndex, studentName, lang = 'gu') {
  const isGu = lang === 'gu';
  const courses = await catalogService.fetchCourses();
  const course = courses.find(c => c.index === courseIndex) || courses[0];

  // Reply to Student
  const studentReply = isGu
    ? `✅ *આભાર, ${studentName}!* તમારી ${course.name_gu} માટેની પૂછપરછ નોંધાઈ ગઈ છે. અમારા શિક્ષક ટૂંક સમયમાં તમારો સંપર્ક કરશે.`
    : `✅ *Thank you, ${studentName}!* Your inquiry for ${course.name} has been received. Our team will contact you shortly.`;

  await sendTextMessage(from, studentReply);

  // Send Alert to Center Admin
  if (config.ADMIN_PHONE_NUMBER) {
    const adminAlert =
      `🚨 *NEW ADMISSION INQUIRY!*\n\n` +
      `👤 *Student:* ${studentName}\n` +
      `📱 *Phone:* +${from}\n` +
      `🎓 *Course:* ${course.name} (${course.fee})\n` +
      `⏰ *Time:* ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`;

    await sendTextMessage(config.ADMIN_PHONE_NUMBER, adminAlert);
  }
}

// 7. Send Center Info & Contact
async function sendCentreInfo(to, lang = 'gu') {
  const isGu = lang === 'gu';
  const infoText = isGu
    ? `📍 *કૌશલ્ય કમ્પ્યુટર સેન્ટર (KCC)*\n\n🏢 *સરનામું:* કડાકીયા બજાર, કઠલાલ રોડ, કપડવંજ.\n📞 *સંપર્ક:* +91 94270 XXXXX\n⏰ *સમય:* સવારે 8:00 થી સાંજે 7:00 (સોમ-શનિ)\n\nGovernment Recognized Certificate Courses & IT Hardware Services.`
    : `📍 *Kaushalya Computer Centre (KCC)*\n\n🏢 *Address:* Kadakiya Bazar, Kathlal Road, Kapadvanj.\n📞 *Contact:* +91 94270 XXXXX\n⏰ *Timings:* 8:00 AM - 7:00 PM (Mon-Sat)\n\nGovernment Recognized Certificate Courses & IT Hardware Services.`;

  return sendRaw({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: infoText },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'nav_courses', title: isGu ? 'કોર્સ જુઓ' : 'View Courses' } },
          { type: 'reply', reply: { id: 'nav_menu_main', title: isGu ? 'મુખ્ય મેનુ' : 'Main Menu' } }
        ]
      }
    }
  });
}

module.exports = {
  sendTextMessage,
  sendLanguageSelector,
  sendMainMenu,
  sendCourseList,
  sendCourseDetails,
  handleCourseEnquiry,
  sendCentreInfo
};
