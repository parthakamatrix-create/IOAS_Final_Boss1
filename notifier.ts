import { db } from './store.js';
import { Opportunity, User } from './types.js';
import { sendTelegramMessage } from './telegram.js';

function formatDate(isoStr: string | null | undefined): string {
  if (!isoStr) return "N/A";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "N/A";
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function checkRules(deadlineName: string, deadlineDateStr: string | null | undefined, now: Date): string[] {
  if (!deadlineDateStr) return [];
  const target = new Date(deadlineDateStr);
  if (isNaN(target.getTime())) return [];

  const diffDays = (target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  const rulesMet: string[] = [];

  if (diffDays >= 6.0 && diffDays < 7.0) {
    rulesMet.push(`${deadlineName}_7_days`);
  } else if (diffDays >= 2.0 && diffDays < 3.0) {
    rulesMet.push(`${deadlineName}_3_days`);
  } else if (diffDays > 0.0 && diffDays <= 1.0) {
    rulesMet.push(`${deadlineName}_24_hours`);
  } else if (diffDays >= -1.0 && diffDays <= 0.0) {
    rulesMet.push(`${deadlineName}_today`);
  }

  return rulesMet;
}

export function matchesPreferences(user: User, opp: Opportunity): boolean {
  if (!user.whatsapp_enabled) {
    return false;
  }

  if (user.preferred_types) {
    const types = user.preferred_types.split(',').map(t => t.trim().toLowerCase());
    if (!types.includes(opp.type.toLowerCase())) {
      return false;
    }
  }

  if (user.interests) {
    const interests = user.interests.split(',').map(i => i.trim().toLowerCase()).filter(Boolean);
    if (interests.length > 0) {
      const oppCat = (opp.category || "").toLowerCase();
      const oppTitle = opp.title.toLowerCase();
      const match = interests.some(i => oppTitle.includes(i) || oppCat.includes(i));
      if (!match) {
        return false;
      }
    }
  }

  return true;
}

export function generateAlertText(opp: Opportunity, ruleType: string): string {
  let urgency = "";
  if (ruleType.includes('7_days') || ruleType.includes('3_days')) {
    urgency = "⚠️ Upcoming Deadline Reminder";
  } else if (ruleType.includes('24_hours')) {
    urgency = "🚨 URGENT: 24 Hours Left!";
  } else if (ruleType.includes('today')) {
    urgency = "🔥 FINAL REMINDER: Deadline Today!";
  } else if (ruleType === 'new') {
    urgency = "🆕 New Opportunity Alert";
  }

  let text = "🚨 *Opportunity Alert*\n\n";
  if (urgency) {
    text = `${urgency}\n\n🚨 *Opportunity Alert*\n\n`;
  }

  text += `*${opp.title}*\n\n`;

  if (opp.category) {
    text += `🎯 Category: ${opp.category}\n`;
  }
  text += `🏆 Type: ${opp.type}\n`;
  if (opp.organizer) {
    text += `🏢 Organizer: ${opp.organizer}\n`;
  }

  text += `\n📅 Registration Deadline:\n${formatDate(opp.registration_deadline)}\n`;
  text += `\n📝 Submission Deadline:\n${formatDate(opp.submission_deadline)}\n`;

  if (opp.notification_date) {
    text += `\n📩 Notification Date:\n${formatDate(opp.notification_date)}\n`;
  }
  if (opp.camera_ready_deadline) {
    text += `\n📄 Camera-Ready:\n${formatDate(opp.camera_ready_deadline)}\n`;
  }

  if (opp.is_scopus_indexed) {
    text += `\n✅ Verified Scopus-Indexed\n`;
  }

  text += `\n🔗 Link: ${opp.url}`;
  return text;
}

export async function sendWhatsappAlerts(): Promise<string[]> {
  const opportunities = db.getOpportunities();
  const subscribedUsers = db.getUsers().filter(u => u.whatsapp_enabled);

  const alertsSent: string[] = [];
  const now = new Date();

  for (const opp of opportunities) {
    const rules: string[] = [];

    const createdAt = new Date(opp.created_at);
    if ((now.getTime() - createdAt.getTime()) < 24 * 60 * 60 * 1000) {
      rules.push('new');
    }

    rules.push(...checkRules('registration', opp.registration_deadline, now));
    rules.push(...checkRules('submission', opp.submission_deadline, now));
    rules.push(...checkRules('notification', opp.notification_date, now));
    rules.push(...checkRules('camera_ready', opp.camera_ready_deadline, now));

    for (const rule of rules) {
      const msgText = generateAlertText(opp, rule);

      for (const user of subscribedUsers) {
        if (matchesPreferences(user, opp)) {
          const history = db.getAlertHistory(user.id, opp.id, rule);
          if (history) {
            continue;
          }

          db.addAlertHistory(user.id, opp.id, rule);
          const fullMessage = `To ${user.name} (${user.phone_number}):\n` + msgText;
          alertsSent.push(fullMessage);

          // Telegram Bot dispatch
          if (process.env.TELEGRAM_BOT_TOKEN && /^-?\d+$/.test(user.phone_number)) {
            sendTelegramMessage(user.phone_number, msgText).catch(() => {});
          }

          // Optional Webhook dispatch
          const webhookUrl = process.env.WEBHOOK_URL;
          if (webhookUrl) {
            try {
              const cleanPhone = user.phone_number.replace('whatsapp:', '').replace('+', '');
              fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_name: user.name,
                  user_phone: cleanPhone,
                  message_text: msgText
                })
              }).catch(() => {});
            } catch {}
          }
        }
      }
    }
  }

  if (alertsSent.length > 0) {
    db.addAlertBatch(alertsSent);
  }

  return alertsSent;
}
