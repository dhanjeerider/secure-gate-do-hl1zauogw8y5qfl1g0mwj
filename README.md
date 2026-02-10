# Secure Gate

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dhanjeerider/Dlsr)

A full-stack application built on Cloudflare Workers with Durable Objects for persistent state management, React frontend, and a modern UI powered by shadcn/ui and Tailwind CSS. This template demonstrates a production-ready setup with API routes, client-side routing, error handling, and theming.

## Features

- **Cloudflare Durable Objects**: Global state storage with counter and demo item CRUD operations.
- **Full-Stack API**: Hono-based backend with CORS, logging, health checks, and error reporting.
- **Modern React Frontend**: Vite-powered, with React Router, Tanstack Query, Sonner toasts, and Framer Motion animations.
- **UI Components**: shadcn/ui library with Tailwind CSS, dark mode support, sidebar layout, and responsive design.
- **TypeScript Throughout**: End-to-end type safety, including Worker bindings.
- **Development Tools**: Hot reload, error boundaries, client error reporting to Worker.
- **Production-Ready**: Optimized builds, SEO-friendly, and seamless Cloudflare deployment.

## Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Lucide Icons, React Router, Tanstack Query, Zustand, Framer Motion, Sonner.
- **Backend**: Cloudflare Workers, Hono, Durable Objects.
- **Styling**: Tailwind CSS with custom animations and gradients.
- **Build & Deploy**: Bun, Wrangler, Cloudflare Pages/Workers Assets.
- **Utilities**: Immer, Zod, UUID, Recharts.

## Quick Start

1. **Clone and Install**:
   ```bash
   git clone <your-repo-url>
   cd secure-gate-do-hl1zauogw8y5qfl1g0mwj
   bun install
   ```

2. **Generate Worker Types** (one-time):
   ```bash
   bun run cf-typegen
   ```

3. **Run Locally**:
   ```bash
   bun dev
   ```
   Open `http://localhost:3000` (or your configured `PORT`).

## Local Development

- **Frontend & Worker**: `bun dev` starts Vite dev server with Worker proxy.
- **Hot Reload**: Automatic for frontend; Worker changes require restart or live reload.
- **Type Checking**: `bun tsc --noEmit`.
- **Linting**: `bun lint`.
- **Preview Build**: `bun build && bun preview`.

Edit `src/pages/HomePage.tsx` for your app UI, `worker/userRoutes.ts` for API routes. Durable Object logic in `worker/durableObject.ts`.

## Deployment

Deploy to Cloudflare Workers with assets in one command:

```bash
bun run deploy
```

Or manually:

1. Authenticate: `npx wrangler login`
2. Deploy: `npx wrangler deploy`
3. Custom Domain: Edit `wrangler.jsonc`.

Your app will be live at `https://secure-gate-do-hl1zauogw8y5qfl1g0mwj.<your-subdomain>.workers.dev`.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/dhanjeerider/Dlsr)

## Project Structure

```
├── src/              # React frontend
│   ├── components/   # UI components (shadcn/ui + custom)
│   ├── hooks/        # Custom hooks
│   ├── lib/          # Utilities & error reporting
│   └── pages/        # Routed pages
├── worker/           # Cloudflare Worker backend
│   ├── durableObject.ts  # Persistent state logic
│   └── userRoutes.ts     # Custom API routes
├── shared/           # Shared types & mock data
└── ...               # Config files (Vite, Tailwind, Wrangler)
```

## Environment Variables

No required env vars. Extend via `wrangler.jsonc` or Worker secrets.

## Contributing

1. Fork and clone.
2. `bun install`
3. Make changes.
4. Test locally: `bun dev`
5. Commit and PR.

## License

MIT. See [LICENSE](LICENSE) for details.