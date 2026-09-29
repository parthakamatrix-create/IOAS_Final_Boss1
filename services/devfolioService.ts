import { Opportunity } from '../types.js';
import { db } from '../store.js';

export interface DevfolioHackathonRaw {
  uuid: string;
  name: string;
  slug: string;
  cover_img?: string;
  starts_at?: string;
  ends_at?: string;
  city?: string;
  state?: string;
  country?: string;
  location?: string;
  is_online?: boolean;
  hackathon_setting?: {
    subdomain?: string;
    logo?: string;
    primary_color?: string;
    site?: string;
    reg_starts_at?: string;
    reg_ends_at?: string;
  };
  themes?: Array<{
    name: string;
    uuid?: string;
    verified?: boolean;
  }>;
}

export interface DevfolioSyncStats {
  totalFetched: number;
  addedToMemory: number;
  updatedInMemory: number;
  lastSyncedAt: string | null;
  status: 'idle' | 'fetching' | 'success' | 'error';
  lastError: string | null;
}

class DevfolioService {
  private inMemoryHackathons: Opportunity[] = [];
  private stats: DevfolioSyncStats = {
    totalFetched: 0,
    addedToMemory: 0,
    updatedInMemory: 0,
    lastSyncedAt: null,
    status: 'idle',
    lastError: null
  };

  /**
   * Fetches live hackathons from Devfolio
   */
  public async fetchLiveHackathons(maxItems: number = 15): Promise<Omit<Opportunity, 'id' | 'created_at'>[]> {
    this.stats.status = 'fetching';
    this.stats.lastError = null;

    const url = 'https://api.devfolio.co/api/hackathons?filter=all&type=application_open&page=1';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      console.log(`[DevfolioService] Fetching live Devfolio hackathons (limit: ${maxItems})...`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Devfolio API responded with status ${response.status}: ${response.statusText}`);
      }

      const json = await response.json() as any;
      const rawList: DevfolioHackathonRaw[] = Array.isArray(json?.result) ? json.result : [];

      const opportunities = this.normalizeDevfolioItems(rawList.slice(0, maxItems));
      this.stats.status = 'success';
      this.stats.totalFetched = opportunities.length;
      console.log(`[DevfolioService] Successfully normalized ${opportunities.length} Devfolio hackathons.`);
      return opportunities;
    } catch (err: any) {
      clearTimeout(timeout);
      this.stats.status = 'error';
      this.stats.lastError = err.message || 'Unknown network error';
      console.error('[DevfolioService] Fetch error:', this.stats.lastError);
      throw err;
    }
  }

  /**
   * Normalizes raw Devfolio records into the application's Opportunity schema
   */
  private normalizeDevfolioItems(items: DevfolioHackathonRaw[]): Omit<Opportunity, 'id' | 'created_at'>[] {
    const results: Omit<Opportunity, 'id' | 'created_at'>[] = [];
    const now = new Date();

    for (const item of items) {
      if (!item.name || !item.slug) continue;

      const directUrl = item.slug ? `https://${item.slug}.devfolio.co/` : (item.hackathon_setting?.site || 'https://devfolio.co/');
      
      // Determine deadlines
      let regDeadline: string | null = null;
      if (item.hackathon_setting?.reg_ends_at) {
        const parsed = new Date(item.hackathon_setting.reg_ends_at);
        if (!isNaN(parsed.getTime())) {
          regDeadline = parsed.toISOString();
        }
      }
      if (!regDeadline && item.ends_at) {
        const parsed = new Date(item.ends_at);
        if (!isNaN(parsed.getTime())) {
          regDeadline = parsed.toISOString();
        }
      }

      let subDeadline: string | null = null;
      if (item.ends_at) {
        const parsed = new Date(item.ends_at);
        if (!isNaN(parsed.getTime())) {
          subDeadline = parsed.toISOString();
        }
      }

      const themes = item.themes && item.themes.length > 0
        ? item.themes.map(t => t.name).filter(Boolean).join(', ')
        : 'Open Innovation, Technology';

      const organizer = item.location || (item.city ? `${item.city}, ${item.country || 'Global'}` : 'Devfolio Community');

      const descElements = [
        item.is_online ? 'Mode: Online' : 'Mode: In-person',
        item.location ? `Location: ${item.location}` : '',
        item.starts_at ? `Starts: ${item.starts_at.split('T')[0]}` : ''
      ].filter(Boolean);

      results.push({
        title: item.name.trim(),
        type: 'Hackathon',
        source_platform: 'Devfolio',
        url: directUrl,
        organizer: organizer.trim(),
        category: themes,
        description: descElements.join(' • '),
        registration_deadline: regDeadline,
        submission_deadline: subDeadline || regDeadline,
        is_scopus_indexed: false,
        is_verified: true
      });
    }

    return results;
  }

  /**
   * Fetches Devfolio hackathons and saves them into the application's in-memory store for display
   */
  public async syncAndStoreInMemory(options?: {
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
      const liveItems = await this.fetchLiveHackathons(options?.maxItems || 12);
      let added = 0;
      let updated = 0;

      for (const item of liveItems) {
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
        total: this.getInMemoryHackathons().length,
        items: this.getInMemoryHackathons()
      };
    } catch (err: any) {
      return {
        success: false,
        added: 0,
        updated: 0,
        total: this.getInMemoryHackathons().length,
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
   * Retrieves all Devfolio hackathons stored in memory
   */
  public getInMemoryHackathons(): Opportunity[] {
    return db.getOpportunities().filter(o => o.source_platform === 'Devfolio');
  }

  /**
   * Get stats & telemetry
   */
  public getStats(): DevfolioSyncStats {
    return { ...this.stats };
  }
}

export const devfolioService = new DevfolioService();
