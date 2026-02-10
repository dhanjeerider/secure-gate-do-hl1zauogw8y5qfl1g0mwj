import { Hono } from "hono";
import { Env } from './core-utils';
import {
  AuthRequest, AuthResponse, SearchResponse,
  ResolveRequest, ResolveResponse, InitResponse,
  EncryptedRequest, ApiResponse, PostDetail
} from '@shared/types';
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  app.get('/api/init', async (c) => {
    const fingerprint = c.req.header('User-Agent') || 'unknown';
    const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
    const result = await stub.initSession(fingerprint);
    return c.json({
      success: true,
      token: result.token,
      expiresAt: result.expiresAt
    } satisfies InitResponse);
  });
  app.get('/api/find', async (c) => {
    const query = c.req.query('query');
    if (!query) return c.json({ success: false, error: "Query missing" }, 400);
    const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
    const results = await stub.fetchFromWordPress(query);
    return c.json({ success: true, results } satisfies SearchResponse);
  });
  app.get('/api/post', async (c) => {
    const id = c.req.query('id');
    const token = c.req.header('Authorization');
    if (!id || !token) return c.json({ success: false, error: "Missing parameters" }, 400);
    try {
      const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
      const data = await stub.getPostDetails(token, id);
      if (!data) return c.json({ success: false, error: "Post not found" }, 404);
      return c.json({ success: true, data } satisfies ApiResponse<PostDetail>);
    } catch (e: any) {
      return c.json({ success: false, error: e.message === "Unauthorized" ? "Session expired" : "Fetch error" }, 401);
    }
  });
  app.post('/api/auth', async (c) => {
    try {
      const body = await c.req.json() as AuthRequest;
      const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
      const result = await stub.validateKey(body.key);
      if (!result) return c.json({ success: false, error: "Invalid Master Key" }, 401);
      return c.json({ success: true, token: result.token, expiresAt: result.expiresAt } satisfies AuthResponse);
    } catch (e) {
      return c.json({ success: false, error: "Auth Failure" }, 500);
    }
  });
  app.post('/api/search', async (c) => {
    const token = c.req.header('Authorization');
    if (!token) return c.json({ success: false, error: "Session missing" }, 401);
    try {
      const { payload } = await c.req.json() as EncryptedRequest;
      const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
      const results = await stub.searchContent(token, payload);
      return c.json({ success: true, results } satisfies SearchResponse);
    } catch (e: any) {
      return c.json({ success: false, error: e.message === "Unauthorized" ? "Session expired" : "Search failed" }, 401);
    }
  });
  // POST endpoint for AJAX-based resolution (Dialog UI)
  app.post('/api/resolve', async (c) => {
    const token = c.req.header('Authorization');
    if (!token) return c.json({ success: false, error: "Session missing" }, 401);
    try {
      const body = await c.req.json() as ResolveRequest;
      const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
      const url = await stub.resolveContent(token, body.id);
      if (!url) return c.json({ success: false, error: "Link expired or already used" }, 404);
      return c.json({ success: true, url } satisfies ResolveResponse);
    } catch (e: any) {
      return c.json({ success: false, error: "Resolution failure" }, 500);
    }
  });
  // NEW: GET endpoint for Direct Server-Side Redirects
  app.get('/api/resolve/:id', async (c) => {
    const id = c.req.param('id');
    const token = c.req.query('token') || c.req.header('Authorization');
    if (!token) return c.text("Unauthorized: Session missing", 401);
    try {
      const stub = c.env.GlobalDurableObject.get(c.env.GlobalDurableObject.idFromName("global"));
      const url = await stub.resolveContent(token, id);
      if (!url) return c.text("Error: Link expired, invalid, or already used.", 404);
      // Perform 302 redirect directly to the proxy gateway
      return c.redirect(url, 302);
    } catch (e: any) {
      return c.text("Resolution Error: " + (e.message || "Unknown error"), 500);
    }
  });
}