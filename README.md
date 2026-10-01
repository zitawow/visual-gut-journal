# Visual Gut Journal

> A privacy-first visual gut journal that turns an awkward health record into a collectible story — while keeping the original available for the moments when it matters.

**Prototype / actively testing.** This project is being built to validate a consumer-health habit loop. It is not a medical device, and its output is an AI visual estimate rather than a diagnosis.

[Open the public sample demo](https://visual-gut-journal-preview.zitaw.chatgpt.site/) · [View the build backlog](docs/backlog.md)

![Gutverse character collection](assets/gut-creatures/08-cosmic-visor.jpg)

## Product walkthrough

```text
Capture → Private upload → AI Bristol estimate → Confirm or correct
        → Gutverse artwork → Gallery and milestone progress
```

The public demo contains sample records only. It is designed so reviewers can explore the collection, result detail, milestone, and Doctor Review concepts without seeing or creating real health data.

![GutVerse 30-second product walkthrough](docs/media/gutverse-product-walkthrough.gif)

| Consent and privacy | AI result and confirmation |
| --- | --- |
| ![Versioned consent screen](docs/media/01-consent.png) | ![AI estimate, confidence, and context](docs/media/02-ai-result.png) |
| **Private Gallery** | **Milestones** |
| ![Date-grouped sample Gallery](docs/media/03-gallery.png) | ![Collect, reveal, reflect milestone experience](docs/media/04-milestones.png) |

The screenshots above use sample data. Final native-device screenshots will be refreshed after the first TestFlight smoke test.

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

## Project status

### Completed

- Public sample-data demo with a collectible Gutverse visual direction
- Email authentication, persistent sessions, and owner-scoped data access
- Private capture metadata and Storage architecture protected by Row Level Security
- Server-side Roboflow adapter with Bristol Type 1–7 confidence output
- Separate user confirmation/correction without overwriting the AI prediction
- Gallery, multiple entries per day, milestones, and private Doctor Review concepts
- Duplicate-action protection, quota enforcement, and durable analysis job states

### In testing

- End-to-end real-device capture, loading, result, correction, and recovery flow
- Physical iPhone, Face ID/device-passcode, and TestFlight behaviour
- Weak-network, app-restart, retry, cross-device, and two-user isolation scenarios
- Roboflow accuracy, low-confidence handling, latency, and per-user cost
- Account recovery, account deletion, and production privacy disclosures

### Planned

- Controlled AI artwork generation to replace the current curated creature set
- Personal baseline and digestive-pattern insights
- Doctor-friendly date-range summaries and report export
- Gut Wrapped sharing loop, subscription, and App Store release

Automatic original-photo deletion is intentionally deferred. The current build must not claim that originals are deleted until a trusted retention worker and deletion verification are active.

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

Copyright © 2026 Zita Wong. All rights reserved. This repository is publicly visible for evaluation and demonstration, but no permission is granted to reuse, modify, or redistribute the original GutVerse code. Third-party components remain governed by their own licenses. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).
