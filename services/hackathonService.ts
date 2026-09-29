import { Opportunity } from '../types.js';
import { db } from '../store.js';

export interface ApifyDevpostItem {
  imageUrl?: string;
  title: string;
  url: string;
  hackathonId?: string;
  openState?: string;
  location?: string;
  prizeAmount?: string;
  registrationsCount?: number;
  organizationName?: string;
  themes?: string[];
  submissionDates?: string;
  timeLeft?: string;
  featured?: boolean;
  inviteOnly?: boolean;
  winnersAnnounced?: boolean;
  submissionGalleryUrl?: string;
  scrapedAt?: string;
}

export interface SyncStats {
  totalFetched: number;
  addedToMemory: number;
  updatedInMemory: number;
  lastSyncedAt: string | null;
  status: 'idle' | 'fetching' | 'success' | 'error';
  lastError: string | null;
}

class HackathonService {
  private defaultApiKey: string = 'apify_api_fSLbYWuod0lsj3R0SiO5BCaYSVjCvx15ohzR';
  private inMemoryHackathons: Opportunity[] = [];
  private stats: SyncStats = {
    totalFetched: 0,
    addedToMemory: 0,
    updatedInMemory: 0,
    lastSyncedAt: null,
    status: 'idle',
    lastError: null
  };

  /**
   * Resolve active Apify API Key from env or fallback to provided key
   */
  public getApiKey(): string {
    const envKey = process.env.APIFY_API_KEY?.trim();
    if (envKey && envKey.length > 5 && !envKey.includes('your_')) {
      return envKey;
    }
    return this.defaultApiKey;
  }

  /**
   * Fetch live Devpost hackathon data via Apify API actor
   */
  public async fetchFromApify(
    apiKey?: string,
    maxItems: number = 10
  ): Promise<Omit<Opportunity, 'id' | 'created_at'>[]> {
    const key = apiKey || this.getApiKey();
    this.stats.status = 'fetching';
    this.stats.lastError = null;

    const endpoint = `https://api.apify.com/v2/acts/parseforge~devpost-hackathons-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(key)}&timeout=30`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 32000);

    try {
      console.log(`[HackathonService] Calling Apify Devpost scraper with limit: ${maxItems}...`);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ maxItems }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Apify responded with HTTP ${response.status}: ${response.statusText}`);
      }

      const items = (await response.json()) as ApifyDevpostItem[];
      if (!Array.isArray(items)) {
        throw new Error('Invalid format returned from Apify (expected array of dataset items)');
      }

      const parsedOpportunities = this.normalizeApifyItems(items);
      this.stats.status = 'success';
      this.stats.totalFetched = parsedOpportunities.length;
      console.log(`[HackathonService] Successfully extracted ${parsedOpportunities.length} hackathons from Apify.`);
      return parsedOpportunities;
    } catch (err: any) {
      clearTimeout(timeout);
      this.stats.status = 'error';
      this.stats.lastError = err.message || 'Unknown network error';
      console.error('[HackathonService] Error fetching from Apify:', this.stats.lastError);
      throw err;
    }
  }

  /**
   * Normalizes raw Apify scraper records to standard Opportunity format
   */
  private normalizeApifyItems(items: ApifyDevpostItem[]): Omit<Opportunity, 'id' | 'created_at'>[] {
    const results: Omit<Opportunity, 'id' | 'created_at'>[] = [];
    const now = new Date();

    for (const item of items) {
      if (!item.title || !item.url) continue;

      // Parse registration / submission deadline from dates range string
      let deadline: string | null = null;
      if (item.submissionDates && typeof item.submissionDates === 'string') {
        const parts = item.submissionDates.split('-');
        const endPart = parts[parts.length - 1].trim();
        const parsed = new Date(endPart);
        if (!isNaN(parsed.getTime())) {
          deadline = parsed.toISOString();
        }
      }

      // Fallback relative parsing from timeLeft (e.g., "24 days left")
      if (!deadline && item.timeLeft && typeof item.timeLeft === 'string') {
        const daysMatch = item.timeLeft.match(/(\d+)\s*days?/i);
        if (daysMatch) {
          const days = parseInt(daysMatch[1], 10);
          const target = new Date(now);
          target.setDate(target.getDate() + days);
          deadline = target.toISOString();
        } else if (/month/i.test(item.timeLeft)) {
          const target = new Date(now);
          target.setDate(target.getDate() + 30);
          deadline = target.toISOString();
        }
      }

      const themes = Array.isArray(item.themes) && item.themes.length > 0
        ? item.themes.join(', ')
        : 'Coding, Technology';

      const isComp = /competition/i.test(item.title) || /competition/i.test(themes);
      const prizeInfo = item.prizeAmount ? `Prize Pool: ${item.prizeAmount}` : '';
      const regCountInfo = item.registrationsCount ? `${item.registrationsCount.toLocaleString()} Participants` : '';
      const descParts = [prizeInfo, regCountInfo, item.location ? `Location: ${item.location}` : ''].filter(Boolean);

      results.push({
        title: item.title.trim(),
        type: isComp ? 'Competition' : 'Hackathon',
        source_platform: 'Devpost',
        url: item.url.trim(),
        organizer: item.organizationName?.trim() || 'Devpost Community',
        category: themes,
        description: descParts.join(' • '),
        registration_deadline: deadline,
        submission_deadline: deadline,
        is_scopus_indexed: false,
        is_verified: true
      });
    }

    return results;
  }

  /**
   * Fetches data using Apify API and stores the opportunities in memory for display
   */
  public async syncAndStoreInMemory(options?: {
    apiKey?: string;
    maxItems?: number;
  }): Promise<{
    success: boolean;
    added: number;
    updated: number;
    total: number;
    items: Opportunity[];
    error?: string;
  }> {
    try {
      const fetchedItems = await this.fetchFromApify(options?.apiKey, options?.maxItems || 10);
      let added = 0;
      let updated = 0;

      for (const item of fetchedItems) {
        // Sync with primary in-memory database store
        const existingByUrl = db.findOpportunityByUrl(item.url);
        if (!existingByUrl) {
          const existingByTitle = db.findOpportunityByTitle(item.title);
          if (!existingByTitle) {
            const addedOpp = db.addOpportunity(item);
            this.upsertLocalInMemory(addedOpp);
            added++;
          } else {
            if (item.registration_deadline && existingByTitle.registration_deadline !== item.registration_deadline) {
              const updatedOpp = db.updateOpportunity(existingByTitle.id, {
                registration_deadline: item.registration_deadline,
                submission_deadline: item.submission_deadline,
                description: item.description || existingByTitle.description
              });
              if (updatedOpp) this.upsertLocalInMemory(updatedOpp);
              updated++;
            }
          }
        } else {
          // Update details in memory
          const updatedOpp = db.updateOpportunity(existingByUrl.id, {
            registration_deadline: item.registration_deadline || existingByUrl.registration_deadline,
            submission_deadline: item.submission_deadline || existingByUrl.submission_deadline,
            description: item.description || existingByUrl.description,
            organizer: item.organizer || existingByUrl.organizer,
            category: item.category || existingByUrl.category
          });
          if (updatedOpp) this.upsertLocalInMemory(updatedOpp);
          updated++;
        }
      }

      this.stats.addedToMemory += added;
      this.stats.updatedInMemory += updated;
      this.stats.lastSyncedAt = new Date().toISOString();

      return {
        success: true,
        added,
        updated,
        total: this.inMemoryHackathons.length,
        items: this.getInMemoryHackathons()
      };
    } catch (err: any) {
      return {
        success: false,
        added: 0,
        updated: 0,
        total: this.inMemoryHackathons.length,
        items: this.getInMemoryHackathons(),
        error: err.message
      };
    }
  }

  private upsertLocalInMemory(opp: Opportunity): void {
    const idx = this.inMemoryHackathons.findIndex(o => o.url === opp.url || o.id === opp.id);
    if (idx >= 0) {
      this.inMemoryHackathons[idx] = opp;
    } else {
      this.inMemoryHackathons.push(opp);
    }
  }

  /**
   * Get all currently stored in-memory hackathons
   */
  public getInMemoryHackathons(): Opportunity[] {
    // Return all Devpost & platform hackathons from memory store
    const allOpps = db.getOpportunities();
    return allOpps.filter(o => o.type === 'Hackathon' || o.source_platform === 'Devpost');
  }

  /**
   * Get current service status and telemetry
   */
  public getStats(): SyncStats & { apiKeyConfigured: boolean; currentKeyMasked: string } {
    const key = this.getApiKey();
    const masked = key.length > 8 ? `${key.substring(0, 8)}...${key.substring(key.length - 4)}` : 'configured';

    return {
      ...this.stats,
      apiKeyConfigured: Boolean(key),
      currentKeyMasked: masked
    };
  }
}

// Export singleton service instance
export const hackathonService = new HackathonService();
