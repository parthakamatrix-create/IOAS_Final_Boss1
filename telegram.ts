import { db } from './store.js';
import { handleChatbotMessage } from './chatbot.js';
import { runScraperPipeline } from './scraper.js';

let isPolling = false;
let pollingAbortController: AbortController | null = null;

export async function sendTelegramMessage(chatId: string | number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });

    if (!res.ok) {
      // Fallback without parse_mode in case Markdown formatting fails
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text
        })
      });
    }
    return true;
  } catch (err) {
    console.error(`[Telegram] Failed to send message to ${chatId}:`, (err as Error).message);
    return false;
  }
}

export async function startTelegramBot(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.log('[Telegram] TELEGRAM_BOT_TOKEN not provided, bot listener disabled.');
    return;
  }

  if (isPolling) return;
  isPolling = true;

  try {
    // Verify bot identity
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const meData = await meRes.json() as any;
    if (meData?.ok) {
      console.log(`[Telegram] Bot connected successfully: @${meData.result?.username} (${meData.result?.first_name})`);
    } else {
      console.warn('[Telegram] Could not verify bot token with getMe:', meData?.description);
    }
  } catch (e) {
    console.warn('[Telegram] Network check failed for getMe:', (e as Error).message);
  }

  let offset = 0;

  const pollLoop = async () => {
    while (isPolling) {
      try {
        pollingAbortController = new AbortController();
        const timeoutId = setTimeout(() => pollingAbortController?.abort(), 35000);

        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=25`;
        const res = await fetch(url, { signal: pollingAbortController.signal });
        clearTimeout(timeoutId);

        if (!res.ok) {
          await new Promise(r => setTimeout(r, 4000));
          continue;
        }

        const data = await res.json() as any;
        if (data?.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;
            await handleUpdate(update);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.warn('[Telegram] Polling loop notice:', err.message);
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  };

  pollLoop().catch(err => {
    console.error('[Telegram] Polling crashed:', err);
    isPolling = false;
  });
}

async function handleUpdate(update: any) {
  const message = update?.message;
  if (!message || !message.text) return;

  const chatId = String(message.chat?.id || '');
  const text = message.text.trim();
  const userName = message.from?.first_name || message.from?.username || 'Telegram User';

  console.log(`[Telegram] Message from ${userName} (${chatId}): ${text}`);

  // 1. /start command
  if (text.startsWith('/start')) {
    const welcomeMsg = 
      `👋 *Welcome to the IOAS Smart Bot, ${userName}!*\n\n` +
      `I track Hackathons, Competitions, and Scopus Conferences.\n\n` +
      `💡 *Commands & Features:*\n` +
      `• Ask me anything naturally, e.g. _"What AI hackathons are coming up?"_\n` +
      `• \`/subscribe AI, Web3, FinTech\` — Subscribe this chat for automated deadline alerts\n` +
      `• \`/hackathons\` — View active hackathons & competitions\n` +
      `• \`/conferences\` — View Scopus-indexed conferences\n` +
      `• \`/refresh\` — Scan live platforms for new opportunities`;
    await sendTelegramMessage(chatId, welcomeMsg);
    return;
  }

  // 2. /subscribe command
  if (text.startsWith('/subscribe')) {
    const interests = text.replace('/subscribe', '').trim();
    if (!interests) {
      await sendTelegramMessage(
        chatId, 
        "⚠️ Please provide your interest keywords!\n\nExample: `/subscribe AI, Web3, Case Study`"
      );
      return;
    }

    const existingUser = db.findUserByPhone(chatId);
    if (existingUser) {
      db.updateUser(existingUser.id, {
        interests,
        whatsapp_enabled: true
      });
      await sendTelegramMessage(
        chatId,
        `✅ *Preferences Updated!*\n\nYour alert interests are now set to: *${interests}*.\nYou will receive real-time deadline warnings directly in this chat.`
      );
    } else {
      db.addUser({
        name: userName,
        phone_number: chatId,
        interests,
        preferred_types: 'Hackathon,Competition,Conference',
        whatsapp_enabled: true
      });
      await sendTelegramMessage(
        chatId,
        `🎉 *Subscribed Successfully!*\n\n` +
        `You're now registered for deadline alerts with interests: *${interests}*.\n` +
        `We'll ping you at 7 days, 3 days, and 24 hours before deadlines!`
      );
    }
    return;
  }

  // 3. /hackathons
  if (text === '/hackathons' || text.toLowerCase() === 'hackathons') {
    const opps = db.getOpportunities().filter(o => o.type === 'Hackathon' || o.type === 'Competition').slice(0, 5);
    let reply = "🚀 *Upcoming Hackathons & Competitions:*\n\n";
    for (const o of opps) {
      const reg = o.registration_deadline ? o.registration_deadline.split('T')[0] : 'Open';
      reply += `• *${o.title}*\n  Platform: ${o.source_platform} | Reg: ${reg}\n  🔗 ${o.url}\n\n`;
    }
    await sendTelegramMessage(chatId, reply);
    return;
  }

  // 4. /conferences
  if (text === '/conferences' || text.toLowerCase() === 'conferences') {
    const opps = db.getOpportunities().filter(o => o.type === 'Conference').slice(0, 5);
    let reply = "📚 *Scopus-Indexed Conferences:*\n\n";
    for (const o of opps) {
      const sub = o.submission_deadline ? o.submission_deadline.split('T')[0] : 'N/A';
      reply += `• *${o.title}*\n  Verified Scopus: ${o.is_scopus_indexed ? '✅' : '❌'} | Sub: ${sub}\n  🔗 ${o.url}\n\n`;
    }
    await sendTelegramMessage(chatId, reply);
    return;
  }

  // 5. /refresh or /scan
  if (text.startsWith('/refresh') || text.startsWith('/scan') || text.toLowerCase().includes('refresh')) {
    await sendTelegramMessage(chatId, "🔄 Scanning Unstop, Devfolio, and IEEE for the latest opportunities...");
    try {
      const count = await runScraperPipeline();
      await sendTelegramMessage(chatId, `✅ Scan complete! Synced ${count} new or updated opportunities.`);
    } catch {
      await sendTelegramMessage(chatId, "⚠️ Scan completed with current cached records.");
    }
    return;
  }

  // 6. Natural Language Assistant (Chatbot / Gemini integration)
  const reply = await handleChatbotMessage(chatId, text);
  await sendTelegramMessage(chatId, reply);
}

export function stopTelegramBot(): void {
  isPolling = false;
  if (pollingAbortController) {
    pollingAbortController.abort();
  }
}
