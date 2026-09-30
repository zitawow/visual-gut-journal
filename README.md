# Visual Gut Journal

> A privacy-first visual gut journal that turns an awkward health record into a collectible story — while keeping the original available for the moments when it matters.

![Gutverse character collection](assets/gut-creatures/08-cosmic-visor.jpg)

## Why this exists

Stool can reveal useful changes in digestive health, but most people will not maintain a traditional tracker or keep sensitive photos in their camera roll. Visual Gut Journal uses art, collection milestones, and personal patterns to make consistent tracking feel approachable rather than clinical.

This is an early-stage MVP for product validation. Its output is an **AI visual estimate, not a medical diagnosis**.

## Core experience

1. Accept versioned privacy and AI-analysis consent.
2. Capture a photo inside the app without adding it to the camera roll.
3. Upload it to private storage through an idempotent capture pipeline.
4. Analyze Bristol Type 1–7 with a server-side Roboflow integration.
5. Confirm the estimate or save a separate user correction.
6. Reveal a Gutverse artwork, Gallery entry, and milestone progress.
7. Re-authenticate before opening the date-grouped original-photo Doctor Review.

The public demo is intentionally separated from authenticated health data and uses sample records only.

## What is implemented

- Expo Router app for iOS, Android, and Web
- Supabase email authentication and persistent native sessions
- Postgres schema with Row Level Security and owner-scoped records
- Private Storage for original captures and generated artwork
- Durable AI job lifecycle with bounded retries and manual fallback
- Roboflow Bristol classification behind a Supabase Edge Function
- User corrections without overwriting the original AI inference
- Duplicate-tap protection, upload lifecycle tracking, and orphan cleanup
- Server-enforced upload and inference quotas
- Gallery, milestones, multiple entries per day, and Doctor Review
- Biometric/device-passcode protection on native Doctor Review
- Privacy-safe operational events without image bodies or health notes

## Architecture

```text
Expo / React Native client
        |
        | authenticated requests
        v
Supabase Auth + Postgres (RLS) + Private Storage
        |
        | trusted Edge Functions
        v
Roboflow Bristol model
        |
        v
Versioned AI inference -> optional user correction -> effective analysis view
```

The client receives only the Supabase Project URL and Publishable key. Provider credentials and privileged database access remain server-side. Public demo data and authenticated production-like records are not mixed.

## Tech stack

- **App:** React Native, Expo SDK 57, Expo Router, TypeScript
- **State/data:** TanStack Query, Zustand, Supabase JS
- **Backend:** Supabase Auth, Postgres, Row Level Security, Edge Functions
- **Storage:** Supabase Private Storage with short-lived signed URLs
- **AI:** Roboflow Bristol Stool Model through a server-only adapter
- **Validation:** Zod plus database constraints and RLS
- **Build:** EAS Build; the project is linked and preparing for its first TestFlight smoke test

## Run locally

Requirements: a supported Node.js version for Expo SDK 57 and a Development/Test Supabase project.

```sh
npm ci
cp .env.example .env.local
npm run web
```

Add only these publishable values to `.env.local`:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Never place a Supabase `service_role` key or `ROBOFLOW_API_KEY` in an `EXPO_PUBLIC_` variable. Roboflow is configured as a Supabase Edge Function secret.

Useful commands:

```sh
npm run typecheck
npm test
npm run export:web
```

## Database and backend

Ordered migrations live in [`supabase/migrations`](supabase/migrations). Edge Functions live in [`supabase/functions`](supabase/functions). The database is the source of truth for capture state, effective analysis, corrections, quota usage, and private-media metadata.

Do not apply these migrations to an unrelated Supabase project. Use a dedicated Development/Test project first and verify two-user RLS and cross-user Storage denial before inviting real users.

## Privacy and beta status

The current development baseline keeps successful originals in Private Storage. Automatic deletion-after-analysis and seven-day retention are deliberately deferred; the app must not promise that behavior until a trusted deletion worker and verification tests are active.

Before external real-photo beta, the project still requires:

- A published, legally reviewed Privacy Policy and processor disclosures
- Written confirmation that the selected AI plan is suitable for the intended beta use
- TestFlight and physical-iPhone smoke testing
- Real recovery/account-deletion verification
- Isolated RLS/Storage and hostile-network acceptance tests

See [`docs/backlog.md`](docs/backlog.md) for verified, pending, deferred, and blocked work.

## Product direction

The MVP is not trying to be a better one-off stool scanner. The longer-term product hypothesis is:

**Art is the entry point. Personal baseline and digestive patterns are the retention.**

Future work includes controlled AI artwork generation, personal pattern detection, Gut Wrapped sharing, a doctor-friendly summary, and a gradual inference-provider migration path if usage or privacy requirements outgrow the initial Roboflow setup.

## License

See [`LICENSE`](LICENSE).
