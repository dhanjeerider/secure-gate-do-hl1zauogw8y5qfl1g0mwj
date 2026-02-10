import { DurableObject } from "cloudflare:workers";
import { MovieItem, DownloadLink, PostDetail } from "@shared/types";
import { decryptData } from "@shared/crypto";
interface Session {
  token: string;
  expiresAt: number;
  fingerprint?: string;
}
interface ResolvedLink {
  realUrl: string;
  expiresAt: number;
}
interface WordPressPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  slug?: string;
}
export class GlobalDurableObject extends DurableObject {
  private static readonly MASTER_KEYS = [
    'DEMO-GATE-2024',
    'SECURE-ACCESS-99',
    'GUEST-KEY',
    'ADMIN-MASTER-Z1'
  ];
  private WP_API_BASE = "https://seashell-whale-304753.hostingersite.com/wp-json/wp/v2";
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
      '&#039;': "'", '&apos;': "'", '&nbsp;': ' '
    };
    return text
      .replace(/&amp;|&lt;|&gt;|&quot;|&#039;|&apos;|&nbsp;/g, (match: string) => entities[match])
      .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n, 10)))
      .replace(/&#x([0-9a-f]+);/gi, (_: string, n: string) => String.fromCharCode(parseInt(n, 16)));
  }
  private cleanTitle(title: string): string {
    return title
      .replace(/Download\s+/gi, '')
      .replace(/\s+Download/gi, '')
      .replace(/Full Movie/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
  private async extractLinksFromContent(content: string): Promise<DownloadLink[]> {
    // Permissive regex for trusted domains handling various URL structures and protocols
    const trustedDomainRegex = /href=["'](https?:\/\/(?:[a-z0-9-]+\.)?(?:fast-dl\.lol|fastdl\.lol|vcloud\.zip|vclzip\.online)\/[^"']+)["']/gi;
    const allMatches = [...content.matchAll(trustedDomainRegex)];
    const uniqueUrls = Array.from(new Set(allMatches.map(m => m[1])));
    const links: DownloadLink[] = [];
    const expiry = Date.now() + 3600 * 1000; // 1 hour expiry for generated mappings
    for (const realUrl of uniqueUrls) {
      const opaqueId = crypto.randomUUID();
      await this.ctx.storage.put(`link_${opaqueId}`, {
        realUrl,
        expiresAt: expiry
      } as ResolvedLink);
      let label = "Mirror";
      if (realUrl.includes("fast-dl") || realUrl.includes("fastdl")) label = "Fast DL";
      else if (realUrl.includes("vcloud.zip") || realUrl.includes("vclzip")) label = "VCloud";
      links.push({ id: opaqueId, label });
    }
    return links;
  }
  async fetchFromWordPress(query: string): Promise<MovieItem[]> {
    try {
      const response = await fetch(`${this.WP_API_BASE}/posts?search=${encodeURIComponent(query)}&per_page=15`);
      if (!response.ok) return [];
      const posts = await response.json() as WordPressPost[];
      return posts.map(post => ({
        id: post.id.toString(),
        title: this.cleanTitle(this.decodeHtmlEntities(post.title?.rendered || "Untitled Asset"))
      }));
    } catch (error) {
      console.error("WordPress Search Error:", error);
      return [];
    }
  }
  async getPostDetails(token: string, postId: string): Promise<PostDetail | null> {
    const isValid = await this.validateSession(token);
    if (!isValid) throw new Error("Session expired");
    try {
      const response = await fetch(`${this.WP_API_BASE}/posts/${postId}`);
      if (!response.ok) return null;
      const post = await response.json() as WordPressPost;
      const title = this.cleanTitle(this.decodeHtmlEntities(post.title?.rendered || "Untitled Asset"));
      const links = await this.extractLinksFromContent(post.content?.rendered || "");
      return { title, postId, links };
    } catch (error) {
      console.error("WordPress Post Fetch Error:", error);
      return null;
    }
  }
  async initSession(fingerprint: string): Promise<{ token: string; expiresAt: number }> {
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 mins for public session
    let sessions = (await this.ctx.storage.get<Session[]>("sessions")) || [];
    const now = Date.now();
    // Clean and append
    const activeSessions = sessions.filter(s => s.expiresAt > now);
    const updatedSessions = [...activeSessions, { token, expiresAt, fingerprint }].slice(-100);
    await this.ctx.storage.put("sessions", updatedSessions);
    return { token, expiresAt };
  }
  async validateKey(key: string): Promise<{ token: string; expiresAt: number } | null> {
    const trimmedKey = key?.trim();
    if (!trimmedKey || !GlobalDurableObject.MASTER_KEYS.includes(trimmedKey)) return null;
    const token = crypto.randomUUID();
    const expiresAt = Date.now() + 3600 * 1000; // 1 hour for authenticated session
    let sessions = (await this.ctx.storage.get<Session[]>("sessions")) || [];
    const now = Date.now();
    const activeSessions = sessions.filter(s => s.expiresAt > now);
    const updatedSessions = [...activeSessions, { token, expiresAt }].slice(-100);
    await this.ctx.storage.put("sessions", updatedSessions);
    return { token, expiresAt };
  }
  async validateSession(token: string): Promise<boolean> {
    const sessions = await this.ctx.storage.get<Session[]>("sessions");
    if (!sessions) return false;
    const now = Date.now();
    const session = sessions.find(s => s.token === token);
    const isValid = !!(session && session.expiresAt > now);
    // Occasional cleanup: only write if we actually have expired sessions
    if (sessions.some(s => s.expiresAt <= now)) {
      const active = sessions.filter(s => s.expiresAt > now);
      await this.ctx.storage.put("sessions", active);
    }
    return isValid;
  }
  async searchContent(token: string, encryptedQuery: string): Promise<MovieItem[]> {
    const isValid = await this.validateSession(token);
    if (!isValid) throw new Error("Session expired");
    let query = "";
    try {
      query = await decryptData(encryptedQuery, token);
    } catch (e) {
      throw new Error("Invalid payload signature");
    }
    return await this.fetchFromWordPress(query);
  }
  async resolveContent(token: string, id: string): Promise<string | null> {
    const isValid = await this.validateSession(token);
    if (!isValid) throw new Error("Session expired");
    const storageKey = `link_${id}`;
    const mapping = await this.ctx.storage.get<ResolvedLink>(storageKey);
    if (!mapping) return null;
    // Immediate cleanup for one-time resolution security
    await this.ctx.storage.delete(storageKey);
    if (mapping.expiresAt < Date.now()) return null;
    const realUrl = mapping.realUrl;
    const encodedUrl = encodeURIComponent(realUrl);
    // Specialized Proxy Routing Logic
    if (realUrl.includes("fastdl") || realUrl.includes("fast-dl.lol")) {
      return `https://vclzipfast.dhanjeerider.workers.dev/?url=${encodedUrl}`;
    }
    if (realUrl.includes("vcloud.zip") || realUrl.includes("vclzip.online")) {
      return `https://byclass.dhanjeerider.workers.dev/api?url=${encodedUrl}&pagestep=2&1link=gamerxyt&2class=btn-lg`;
    }
    // Default Fallback Proxy
    return `https://click.dhanjeerider.workers.dev/?url=${encodedUrl}`;
  }
}