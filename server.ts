import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import flash from 'connect-flash';
import path from 'path';
import dotenv from 'dotenv';
import { db } from './store.js';
import { runScraperPipeline } from './scraper.js';
import { sendWhatsappAlerts } from './notifier.js';
import { handleChatbotMessage } from './chatbot.js';
import { startTelegramBot } from './telegram.js';
import { hackathonService } from './services/hackathonService.js';
import { devfolioService } from './services/devfolioService.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session and Flash middleware
app.use(
  session({
    secret: process.env.SECRET_KEY || 'ioas-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 * 60 }
  }) as any
);
app.use(flash() as any);

// Expose flash messages to all templates
app.use((req: Request, res: Response, next: NextFunction) => {
  const successMsgs = req.flash('success');
  const dangerMsgs = req.flash('danger');
  const infoMsgs = req.flash('info');

  const flashMessages: { category: string; text: string }[] = [];
  successMsgs.forEach(msg => flashMessages.push({ category: 'success', text: msg }));
  dangerMsgs.forEach(msg => flashMessages.push({ category: 'danger', text: msg }));
  infoMsgs.forEach(msg => flashMessages.push({ category: 'info', text: msg }));

  res.locals.flashMessages = flashMessages;
  next();
});

// Routes
// 1. Dashboard
app.get('/', (req: Request, res: Response) => {
  const opportunities = db.getFutureOpportunities();
  const users = db.getUsers();

  const hackathons = opportunities.filter(o => o.type === 'Hackathon');
  const competitions = opportunities.filter(o => o.type === 'Competition');
  const conferences = opportunities.filter(o => o.type === 'Conference');

  res.render('index', {
    opportunities,
    hackathons,
    competitions,
    conferences,
    users
  });
});

// 2. Run Aggregation Pipeline
app.post('/run-scraper', async (req: Request, res: Response) => {
  try {
    const count = await runScraperPipeline();
    req.flash('success', `Successfully ran aggregation pipeline! ${count} opportunities collected or updated.`);
  } catch (err) {
    console.error('Error running scraper pipeline:', err);
    req.flash('danger', 'Error running scraper pipeline.');
  }
  res.redirect('/');
});

// 2b. Fetch Devpost Hackathons via Apify Service Layer and store in memory
app.post('/fetch-hackathons', async (req: Request, res: Response) => {
  try {
    const result = await hackathonService.syncAndStoreInMemory({ maxItems: 10 });
    if (result.success) {
      req.flash('success', `⚡ Apify Service: Stored ${result.added} new hackathons in memory (${result.updated} refreshed). Total: ${result.total}`);
    } else {
      req.flash('danger', `Apify Service: ${result.error || 'Failed to fetch hackathons'}`);
    }
  } catch (err: any) {
    console.error('Error in /fetch-hackathons:', err);
    req.flash('danger', 'Error fetching hackathons from Apify.');
  }
  res.redirect('/');
});

// 2c. Fetch Devfolio Hackathons via Service Layer and store in memory
app.post('/fetch-devfolio', async (req: Request, res: Response) => {
  try {
    const result = await devfolioService.syncAndStoreInMemory({ maxItems: 15 });
    if (result.success) {
      req.flash('success', `⚡ Devfolio Service: Stored ${result.added} new hackathons in memory (${result.updated} refreshed). Total: ${result.total}`);
    } else {
      req.flash('danger', `Devfolio Service: ${result.error || 'Failed to fetch Devfolio hackathons'}`);
    }
  } catch (err: any) {
    console.error('Error in /fetch-devfolio:', err);
    req.flash('danger', 'Error fetching hackathons from Devfolio.');
  }
  res.redirect('/');
});

// 3. Send WhatsApp Alerts
app.post('/send-alerts', async (req: Request, res: Response) => {
  try {
    const alerts = await sendWhatsappAlerts();
    req.flash('success', `Successfully sent ${alerts.length} WhatsApp alerts!`);
  } catch (err) {
    console.error('Error sending alerts:', err);
    req.flash('danger', 'Error sending alerts.');
  }
  res.redirect('/alerts');
});

// 4. Subscribe
app.post('/subscribe', (req: Request, res: Response) => {
  const { name, phone, interests, branch } = req.body;
  let preferred_types = req.body.preferred_types;
  const whatsapp_enabled = req.body.whatsapp_enabled === 'on';

  if (!name || !phone) {
    req.flash('danger', 'Name and Phone are required!');
    return res.redirect('/');
  }

  // Handle single value or array for checkboxes
  let preferredTypesStr = '';
  if (Array.isArray(preferred_types)) {
    preferredTypesStr = preferred_types.join(',');
  } else if (typeof preferred_types === 'string') {
    preferredTypesStr = preferred_types;
  }

  const existing = db.findUserByPhone(phone);
  if (existing) {
    db.updateUser(existing.id, {
      name,
      interests,
      branch,
      preferred_types: preferredTypesStr,
      whatsapp_enabled
    });
    req.flash('success', 'Your preferences have been updated!');
  } else {
    db.addUser({
      name,
      phone_number: phone,
      interests,
      branch,
      preferred_types: preferredTypesStr,
      whatsapp_enabled
    });
    req.flash('success', 'Successfully subscribed to alerts!');
  }

  res.redirect('/');
});

// 5. WhatsApp Alerts Log
app.get('/alerts', (req: Request, res: Response) => {
  const batches = db.getAlertBatches();
  let latestMessages: string[] = [];
  if (batches.length > 0) {
    latestMessages = batches[batches.length - 1].messages || [];
  }

  res.render('alerts', {
    messages: latestMessages
  });
});

// 6. Chatbot Webhook Endpoint
app.post('/chatbot', async (req: Request, res: Response) => {
  const { phone, text } = req.body || {};
  try {
    const reply = await handleChatbotMessage(phone || '', text || '');
    res.json({ reply });
  } catch (err) {
    console.error('Chatbot error:', err);
    res.json({ reply: "I didn't quite catch that. Try asking for 'hackathons', 'conferences', or 'subscribe [interests]'." });
  }
});

// JSON API endpoints
app.get('/api/opportunities', (req: Request, res: Response) => {
  res.json(db.getOpportunities());
});

app.get('/api/users', (req: Request, res: Response) => {
  res.json(db.getUsers());
});

app.get('/api/alerts', (req: Request, res: Response) => {
  res.json(db.getAlertBatches());
});

// Hackathon Service API
app.get('/api/hackathons', (req: Request, res: Response) => {
  res.json({
    hackathons: hackathonService.getInMemoryHackathons(),
    stats: hackathonService.getStats()
  });
});

app.post('/api/hackathons/fetch', async (req: Request, res: Response) => {
  const maxItems = req.body?.maxItems ? parseInt(req.body.maxItems, 10) : 10;
  const result = await hackathonService.syncAndStoreInMemory({ maxItems });
  res.json(result);
});

// Devfolio Service API
app.get('/api/devfolio', (req: Request, res: Response) => {
  res.json({
    hackathons: devfolioService.getInMemoryHackathons(),
    stats: devfolioService.getStats()
  });
});

app.post('/api/devfolio/fetch', async (req: Request, res: Response) => {
  const maxItems = req.body?.maxItems ? parseInt(req.body.maxItems, 10) : 15;
  const result = await devfolioService.syncAndStoreInMemory({ maxItems });
  res.json(result);
});

// Scheduled aggregation every 6 hours
const SIX_HOURS = 6 * 60 * 60 * 1000;
const schedulerInterval = setInterval(async () => {
  console.log('[Scheduler] Running scheduled aggregation pipeline...');
  try {
    await runScraperPipeline();
    await sendWhatsappAlerts();
    console.log('[Scheduler] Completed scheduled pipeline.');
  } catch (e) {
    console.error('[Scheduler] Error in scheduled run:', e);
  }
}, SIX_HOURS);
schedulerInterval.unref();

// Start server
app.listen(PORT, HOST, () => {
  console.log(`IOAS server running at http://${HOST}:${PORT}`);
  if (process.env.TELEGRAM_BOT_TOKEN) {
    startTelegramBot();
  }
});
