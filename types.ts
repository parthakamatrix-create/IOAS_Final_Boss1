export interface Opportunity {
  id: number;
  title: string;
  type: 'Hackathon' | 'Competition' | 'Conference';
  source_platform: string;
  url: string;
  organizer?: string;
  description?: string;
  category?: string;
  eligibility?: string;
  registration_deadline?: string | null; // ISO string
  submission_deadline?: string | null;
  notification_date?: string | null;
  camera_ready_deadline?: string | null;
  is_scopus_indexed: boolean;
  is_verified: boolean;
  created_at: string;
}

export interface User {
  id: number;
  name: string;
  phone_number: string;
  interests?: string;
  branch?: string;
  preferred_types?: string; // Comma separated, e.g. "Hackathon,Competition,Conference"
  whatsapp_enabled: boolean;
  created_at: string;
}

export interface AlertHistory {
  id: number;
  user_id: number;
  opportunity_id: number;
  alert_type: string;
  sent_at: string;
}

export interface AlertBatch {
  timestamp: string;
  messages: string[];
}
