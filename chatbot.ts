import { db } from './store.js';
import { GoogleGenAI } from '@google/genai';
import { Opportunity } from './types.js';

let geminiDisabled = false;

function getAiClient(): GoogleGenAI | null {
  if (geminiDisabled) return null;
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key || key.length < 10 || key.includes('your_') || key === 'undefined') {
    return null;
  }
  try {
    return new GoogleGenAI({ apiKey: key });
  } catch {
    geminiDisabled = true;
    return null;
  }
}

export async function handleChatbotMessage(phone: string, text: string): Promise<string> {
  const cleanText = (text || '').trim();
  const lowerMsg = cleanText.toLowerCase();

  // 1. Handle subscription intent
  if (lowerMsg.includes('subscribe')) {
    const interests = cleanText.replace(/subscribe/i, '').replace(/[/]/g, '').trim();
    const existing = db.findUserByPhone(phone);
    if (existing) {
      db.updateUser(existing.id, { interests: interests || existing.interests });
      return `✅ *Your alert preferences have been updated!*\n\nInterests: *${interests || 'General Technology'}*\nYou will receive automated deadline notifications for matching events.`;
    } else {
      db.addUser({
        name: 'Chat Subscriber',
        phone_number: phone,
        interests: interests || 'General Technology',
        preferred_types: 'Hackathon,Competition,Conference',
        whatsapp_enabled: true
      });
      return `🎉 *Subscribed to IOAS Alerts!*\n\nInterests: *${interests || 'General Technology'}*\nWe will notify you at 7-day, 3-day, and 24-hour deadline intervals.`;
    }
  }

  // 2. Try Gemini AI if valid client is available
  const aiClient = getAiClient();
  if (aiClient) {
    try {
      const opps = db.getFutureOpportunities().slice(0, 15);
      let dbContext = "AVAILABLE UPCOMING OPPORTUNITIES IN DATABASE:\n";
      for (const o of opps) {
        const reg = o.registration_deadline ? o.registration_deadline.split('T')[0] : 'N/A';
        const scopus = o.is_scopus_indexed ? "Yes" : "No";
        dbContext += `- Title: ${o.title} | Type: ${o.type} | Category: ${o.category || 'N/A'} | Reg Deadline: ${reg} | Scopus: ${scopus} | Link: ${o.url}\n`;
      }

      const prompt = `You are the IOAS (Intelligent Opportunity Aggregation System) virtual assistant.
You are talking to a student/developer on WhatsApp/Telegram.
Be friendly, concise, and helpful. Use emojis naturally.
Use the following database records to answer their query. Do not invent opportunities not in this list.
If they ask for something not in the list, politely tell them it's not currently available.
If they want to sign up for automated background alerts, tell them to type 'subscribe <their interests>'.

${dbContext}

User query: ${cleanText}`;

      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt
      });

      if (response && response.text) {
        return response.text.trim();
      }
    } catch (e: any) {
      // If API key is invalid or quota exceeded, disable AI to avoid repeat failures
      const errMsg = e?.message || '';
      if (errMsg.includes('API_KEY_INVALID') || errMsg.includes('API key not valid') || errMsg.includes('400')) {
        geminiDisabled = true;
      }
      // Seamlessly fall through to smart rule-based handler below
    }
  }

  // 3. Built-in Semantic Matcher (Always reliable, zero API errors)
  return generateSmartReply(lowerMsg);
}

function generateSmartReply(query: string): string {
  const allOpps = db.getOpportunities();
  const futureOpps = db.getFutureOpportunities();

  // Help / Intro queries
  if (query === 'help' || query.includes('what can you do') || query === '/help' || query === 'hi' || query === 'hello') {
    return (
      `👋 *Hello! I am the IOAS Opportunity Assistant.*\n\n` +
      `Here is what I can do:\n` +
      `• *Search Hackathons*: ask _"Show AI hackathons"_ or _"ETHIndia"_\n` +
      `• *Search Conferences*: ask _"Scopus conferences"_\n` +
      `• *Urgent Deadlines*: ask _"What deadlines are coming up?"_\n` +
      `• *Subscribe to Alerts*: type _"subscribe AI, Web3, FinTech"_`
    );
  }

  // Urgent deadlines check
  if (query.includes('urgent') || query.includes('deadline') || query.includes('closing') || query.includes('soon')) {
    const now = new Date();
    const urgent = futureOpps
      .filter(o => {
        if (!o.registration_deadline) return false;
        const diff = (new Date(o.registration_deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 15;
      })
      .slice(0, 4);

    if (urgent.length > 0) {
      let reply = "⚡ *Opportunities with Upcoming Deadlines:*\n\n";
      for (const o of urgent) {
        const reg = o.registration_deadline ? o.registration_deadline.split('T')[0] : 'N/A';
        reply += `🚨 *${o.title}* (${o.type})\n📅 Closes: ${reg}\n🔗 ${o.url}\n\n`;
      }
      return reply.trim();
    }
  }

  // Conference specific query
  if (query.includes('conference') || query.includes('scopus') || query.includes('paper') || query.includes('journal')) {
    let confs = allOpps.filter(o => o.type === 'Conference');
    if (query.includes('ai') || query.includes('intelligence')) {
      confs = confs.filter(o => (o.category || '').toLowerCase().includes('ai') || o.title.toLowerCase().includes('ai'));
    }

    if (confs.length > 0) {
      let reply = "📚 *Verified Research Conferences:*\n\n";
      for (const o of confs.slice(0, 3)) {
        const scopus = o.is_scopus_indexed ? "✅ Verified Scopus" : "Academic";
        const sub = o.submission_deadline ? o.submission_deadline.split('T')[0] : 'Open';
        reply += `• *${o.title}*\n  ${scopus} | Sub Deadline: ${sub}\n  🔗 ${o.url}\n\n`;
      }
      return reply.trim();
    }
  }

  // Hackathons & Competitions query
  if (query.includes('hackathon') || query.includes('competition') || query.includes('coding') || query.includes('challenge')) {
    let matches = allOpps.filter(o => o.type === 'Hackathon' || o.type === 'Competition');
    
    // Topic filtering
    if (query.includes('ai') || query.includes('machine learning')) {
      matches = matches.filter(o => (o.title + ' ' + (o.category || '')).toLowerCase().includes('ai'));
    } else if (query.includes('web3') || query.includes('blockchain') || query.includes('crypto')) {
      matches = matches.filter(o => (o.title + ' ' + (o.category || '')).toLowerCase().includes('web3') || (o.title + ' ' + (o.category || '')).toLowerCase().includes('crypto'));
    }

    if (matches.length > 0) {
      let reply = "🚀 *Upcoming Hackathons & Challenges:*\n\n";
      for (const o of matches.slice(0, 4)) {
        const reg = o.registration_deadline ? o.registration_deadline.split('T')[0] : 'Open';
        reply += `• *${o.title}*\n  Platform: ${o.source_platform} | Reg: ${reg}\n  🔗 ${o.url}\n\n`;
      }
      return reply.trim();
    }
  }

  // Keyword-based search across all opportunities
  const keywords = query.split(/\s+/).filter(w => w.length > 2 && !['show', 'what', 'find', 'give', 'list', 'the', 'for', 'any'].includes(w));
  if (keywords.length > 0) {
    const matched = allOpps.filter(o => {
      const haystack = (o.title + ' ' + (o.category || '') + ' ' + o.source_platform + ' ' + (o.organizer || '')).toLowerCase();
      return keywords.some(k => haystack.includes(k));
    });

    if (matched.length > 0) {
      let reply = `🎯 *Found ${matched.length} Matching Opportunities:*\n\n`;
      for (const o of matched.slice(0, 4)) {
        const reg = o.registration_deadline ? o.registration_deadline.split('T')[0] : 'Open';
        reply += `• *${o.title}* (${o.type})\n  Platform: ${o.source_platform} | Deadline: ${reg}\n  🔗 ${o.url}\n\n`;
      }
      return reply.trim();
    }
  }

  // Default fallback with helpful direction
  return (
    `I couldn't find a direct match for "${query}".\n\n` +
    `Try asking for:\n` +
    `• *"AI Hackathons"*\n` +
    `• *"Scopus Conferences"*\n` +
    `• *"Urgent Deadlines"*\n` +
    `• Or type *"subscribe AI, Web3"* to receive automated deadline alerts!`
  );
}
