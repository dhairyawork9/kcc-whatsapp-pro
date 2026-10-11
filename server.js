// --- SHOP HANDLERS START ---
    else if (
      actionId === 'nav_shop' ||
      actionId === 'nav_shop_menu' ||
      actionId === 'btn_shop' ||
      actionId === 'menu_shop'
    ) {
      const items = await getShopItems();

      if (!items || items.length === 0) {
        const emptyMsg = session.lang === 'gu'
          ? 'હાલમાં સ્ટોકમાં વસ્તુઓ ઉપલબ્ધ નથી. કૃપા કરીને થોડા સમય પછી તપાસો.'
          : 'Currently no items available in stock. Please check back later.';
        await metaService.sendTextMessage(from, emptyMsg);
        return;
      }

      // Build safe rows ensuring strict WhatsApp character limits
      const rows = items.slice(0, 10).map((item, idx) => {
        const cleanTitle = (item.title || `Item ${idx + 1}`).trim().substring(0, 24);
        const cleanDesc = `${item.price || ''} | ${item.category || ''}`.trim().substring(0, 72);
        
        return {
          id: `shop_${item.id || idx}`,
          title: cleanTitle,
          description: cleanDesc
        };
      });

      const bodyText = session.lang === 'gu'
        ? 'અમારી પાસે ઉપલબ્ધ સાધનોની યાદી નીચે મુજબ છે:'
        : 'Available items in our store:';

      const buttonLabel = session.lang === 'gu' ? 'વસ્તુઓ જુઓ' : 'View Items'; // Must be <= 20 chars

      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: from,
        type: "interactive",
        interactive: {
          type: "list",
          header: {
            type: "text",
            text: "KCC Store"
          },
          body: {
            text: bodyText
          },
          footer: {
            text: "Kaushalya Computer Centre"
          },
          action: {
            button: buttonLabel,
            sections: [
              {
                title: "Products",
                rows: rows
              }
            ]
          }
        }
      };

      try {
        console.log(`[Shop] Sending list payload with ${rows.length} items to +${from}...`);
        
        if (typeof metaService.sendRawMessage === 'function') {
          const res = await metaService.sendRawMessage(payload);
          console.log('[Shop] Message send response:', res);
        } else if (typeof metaService.sendMessage === 'function') {
          const res = await metaService.sendMessage(payload);
          console.log('[Shop] Message send response:', res);
        } else if (typeof metaService.sendListMessage === 'function') {
          await metaService.sendListMessage(from, "KCC Store", "Products", bodyText, buttonLabel, [
            { title: "Products", rows }
          ]);
        } else {
          console.error('[Shop Error] No suitable send function found on metaService!');
        }
      } catch (sendErr) {
        console.error('[Shop Send Error]:', sendErr.response?.data || sendErr.message);
      }
    }
    // Individual Shop Item Clicked
    else if (actionId.startsWith('shop_item_') || actionId.startsWith('shop_')) {
      const items = await getShopItems();
      const rawId = actionId.replace('shop_', '');
      const selected = items.find(i => i.id === rawId || `shop_${i.id}` === actionId);

      if (selected) {
        const itemMsg = session.lang === 'gu'
          ? `📦 *${selected.title}*\n\n💰 કિંમત: *${selected.price}*\n📂 કેટેગરી: ${selected.category}\n\nખરીદી માટે સેન્ટર પર મુલાકાત લો અથવા સંપર્ક કરો.`
          : `📦 *${selected.title}*\n\n💰 Price: *${selected.price}*\n📂 Category: ${selected.category}\n\nVisit the centre or contact us to purchase.`;
        await metaService.sendTextMessage(from, itemMsg);
      }
    }
    // --- SHOP HANDLERS END ---
