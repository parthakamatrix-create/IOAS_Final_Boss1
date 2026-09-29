import { Opportunity, User, AlertHistory, AlertBatch } from './types.js';

let oppIdCounter = 1;
let userIdCounter = 1;
let historyIdCounter = 1;

const now = new Date();

function addDays(d: Date, days: number): string {
  const target = new Date(d);
  target.setDate(target.getDate() + days);
  return target.toISOString();
}

// Initial opportunities
const opportunities: Opportunity[] = [
  {
    id: oppIdCounter++,
    title: 'Google AI Hackathon 2026',
    type: 'Hackathon',
    source_platform: 'Devpost',
    url: 'https://googleai2026.devpost.com/',
    organizer: 'Google',
    category: 'Artificial Intelligence, GenAI',
    registration_deadline: addDays(now, 30),
    submission_deadline: addDays(now, 32),
    is_scopus_indexed: false,
    is_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: oppIdCounter++,
    title: 'ETHIndia 2026',
    type: 'Hackathon',
    source_platform: 'Devfolio',
    url: 'https://ethindia2026.devfolio.co/',
    organizer: 'Devfolio Community',
    category: 'Web3, Blockchain, Ethereum',
    registration_deadline: addDays(now, 45),
    submission_deadline: addDays(now, 46),
    is_scopus_indexed: false,
    is_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: oppIdCounter++,
    title: 'Polygon BUIDL IT Summer',
    type: 'Hackathon',
    source_platform: 'Devfolio',
    url: 'https://polygon-buidlit.devfolio.co/',
    organizer: 'Polygon Labs',
    category: 'Web3, Smart Contracts',
    registration_deadline: addDays(now, 15),
    submission_deadline: addDays(now, 16),
    is_scopus_indexed: false,
    is_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: oppIdCounter++,
    title: 'AWS Serverless Innovation Challenge',
    type: 'Competition',
    source_platform: 'Devpost',
    url: 'https://aws-serverless.devpost.com/',
    organizer: 'Amazon Web Services',
    category: 'Cloud, Serverless, DevOps',
    registration_deadline: addDays(now, 60),
    submission_deadline: addDays(now, 62),
    is_scopus_indexed: false,
    is_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: oppIdCounter++,
    title: 'HackCelestial 3.0',
    type: 'Hackathon',
    source_platform: 'Unstop',
    url: 'https://unstop.com/hackathons/hackcelestial-30-pillai-university-navi-mumbai-1737808',
    organizer: 'Pillai University',
    category: 'Open Innovation, AI, IoT',
    registration_deadline: addDays(now, 7),
    submission_deadline: addDays(now, 8),
    is_scopus_indexed: false,
    is_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: oppIdCounter++,
    title: 'WCE Hackathon 2026',
    type: 'Hackathon',
    source_platform: 'Unstop',
    url: 'https://unstop.com/hackathons/wce-hackathon-2026-walchand-college-of-engineering-1630840',
    organizer: 'Walchand College of Engineering',
    category: 'Software Engineering, FinTech',
    registration_deadline: addDays(now, 21),
    submission_deadline: addDays(now, 22),
    is_scopus_indexed: false,
    is_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: oppIdCounter++,
    title: 'IEEE International Conference on Artificial Intelligence 2026',
    type: 'Conference',
    source_platform: 'IEEE',
    url: 'https://ieee.org/ai-2026',
    organizer: 'IEEE Computer Society',
    category: 'Artificial Intelligence, Deep Learning',
    registration_deadline: addDays(now, 20),
    submission_deadline: addDays(now, 10),
    notification_date: addDays(now, 35),
    camera_ready_deadline: addDays(now, 50),
    is_scopus_indexed: true,
    is_verified: true,
    created_at: new Date().toISOString()
  },
  {
    id: oppIdCounter++,
    title: 'ACM Conference on Intelligent Information Systems',
    type: 'Conference',
    source_platform: 'ACM',
    url: 'https://acm.org/ciis-2026',
    organizer: 'ACM SIGAI',
    category: 'Information Systems, Machine Learning',
    registration_deadline: addDays(now, 40),
    submission_deadline: addDays(now, 25),
    notification_date: addDays(now, 60),
    camera_ready_deadline: addDays(now, 75),
    is_scopus_indexed: true,
    is_verified: true,
    created_at: new Date().toISOString()
  }
];

// Initial users
const users: User[] = [
  {
    id: userIdCounter++,
    name: 'Parth Mohurle',
    phone_number: '7219125818',
    interests: 'AI, Web3, Hackathon',
    branch: 'CSBS',
    preferred_types: 'Hackathon,Competition,Conference',
    whatsapp_enabled: true,
    created_at: new Date().toISOString()
  }
];

const alertHistories: AlertHistory[] = [];

const alertBatches: AlertBatch[] = [
  {
    timestamp: new Date().toISOString(),
    messages: [
      "To Parth Mohurle (7219125818):\n🆕 New Opportunity Alert\n\n🚨 *Opportunity Alert*\n\n*Google AI Hackathon 2026*\n\n🎯 Category: Artificial Intelligence, GenAI\n🏆 Type: Hackathon\n🏢 Organizer: Google\n\n📅 Registration Deadline:\n" + new Date(addDays(now, 30)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + "\n\n📝 Submission Deadline:\n" + new Date(addDays(now, 32)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + "\n\n🔗 Link: https://googleai2026.devpost.com/",
      "To Parth Mohurle (7219125818):\n🆕 New Opportunity Alert\n\n🚨 *Opportunity Alert*\n\n*IEEE International Conference on Artificial Intelligence 2026*\n\n🎯 Category: Artificial Intelligence, Deep Learning\n🏆 Type: Conference\n🏢 Organizer: IEEE Computer Society\n\n📅 Registration Deadline:\n" + new Date(addDays(now, 20)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + "\n\n📝 Submission Deadline:\n" + new Date(addDays(now, 10)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + "\n\n📩 Notification Date:\n" + new Date(addDays(now, 35)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + "\n\n📄 Camera-Ready:\n" + new Date(addDays(now, 50)).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + "\n\n✅ Verified Scopus-Indexed\n\n🔗 Link: https://ieee.org/ai-2026"
    ]
  }
];

export const db = {
  getOpportunities: (): Opportunity[] => {
    return [...opportunities];
  },

  getFutureOpportunities: (): Opportunity[] => {
    const cur = new Date();
    return opportunities
      .filter(o => !o.registration_deadline || new Date(o.registration_deadline) >= cur)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  findOpportunityByUrl: (url: string): Opportunity | undefined => {
    return opportunities.find(o => o.url === url);
  },

  findOpportunityByTitle: (title: string): Opportunity | undefined => {
    const clean = title.toLowerCase().trim();
    return opportunities.find(o => o.title.toLowerCase().includes(clean) || clean.includes(o.title.toLowerCase()));
  },

  addOpportunity: (opp: Omit<Opportunity, 'id' | 'created_at'>): Opportunity => {
    const newOpp: Opportunity = {
      ...opp,
      id: oppIdCounter++,
      created_at: new Date().toISOString()
    };
    opportunities.push(newOpp);
    return newOpp;
  },

  updateOpportunity: (id: number, updates: Partial<Opportunity>): Opportunity | null => {
    const idx = opportunities.findIndex(o => o.id === id);
    if (idx === -1) return null;
    opportunities[idx] = { ...opportunities[idx], ...updates };
    return opportunities[idx];
  },

  clearOpportunities: (): void => {
    opportunities.length = 0;
  },

  getUsers: (): User[] => {
    return [...users];
  },

  findUserByPhone: (phone: string): User | undefined => {
    const clean = phone.replace(/[^0-9]/g, '');
    return users.find(u => u.phone_number.replace(/[^0-9]/g, '') === clean || u.phone_number === phone);
  },

  addUser: (user: Omit<User, 'id' | 'created_at'>): User => {
    const newUser: User = {
      ...user,
      id: userIdCounter++,
      created_at: new Date().toISOString()
    };
    users.push(newUser);
    return newUser;
  },

  updateUser: (id: number, updates: Partial<User>): User | null => {
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...updates };
    return users[idx];
  },

  getAlertHistory: (userId: number, oppId: number, alertType: string): AlertHistory | undefined => {
    return alertHistories.find(h => h.user_id === userId && h.opportunity_id === oppId && h.alert_type === alertType);
  },

  addAlertHistory: (userId: number, oppId: number, alertType: string): AlertHistory => {
    const newHistory: AlertHistory = {
      id: historyIdCounter++,
      user_id: userId,
      opportunity_id: oppId,
      alert_type: alertType,
      sent_at: new Date().toISOString()
    };
    alertHistories.push(newHistory);
    return newHistory;
  },

  getAlertBatches: (): AlertBatch[] => {
    return [...alertBatches];
  },

  addAlertBatch: (messages: string[]): AlertBatch => {
    const batch: AlertBatch = {
      timestamp: new Date().toISOString(),
      messages
    };
    alertBatches.push(batch);
    return batch;
  }
};
