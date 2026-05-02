# Helix

Personal peptide-protocol tracker. Dark, card-grid dashboard for an 8-week cycle (May 1 → June 26, 2026). Logs each scheduled injection, tracks vial mixing, body weight, and injection-site rotation.

Stack: Next.js 16 (App Router) · Tailwind CSS v4 · Prisma 6 · Postgres (Neon) · deployed on Vercel.

## Setup

1. **Database** — create a free Postgres on [Neon](https://neon.tech). Copy the connection string.
2. **Env vars** — copy `.env.example` to `.env.local` and fill in:
   ```
   DATABASE_URL=postgresql://...        # from Neon
   HELIX_PASSWORD=...                   # what you'll type to log in
   HELIX_COOKIE_SECRET=...              # 32+ random chars (e.g. openssl rand -hex 24)
   ```
3. **Schema + seed** — push the schema and seed the 8-week protocol:
   ```bash
   npm run db:push
   npm run db:seed
   ```
4. **Run** — `npm run dev` then open <http://localhost:3000>.

## Deploy

Push to GitHub, import the repo in Vercel, set the three env vars, and Vercel does the rest. After first deploy run `npm run db:push && npm run db:seed` against the Neon DB once.

## Source of truth

The protocol is defined in `docs/peptide-protocol-calendar.md`. The seed script in `prisma/seed.ts` derives all 56 days of scheduled doses + 5 vials from the rules in `lib/protocol.ts`. Edit those if the protocol changes, then re-run `npm run db:seed`.
