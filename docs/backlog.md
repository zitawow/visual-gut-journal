# Visual Gut Journal — Product & Engineering Backlog

Last reviewed: 2026-09-19

This backlog is ordered by risk and dependency, not by visual appeal. The current goal is a safe, dependable closed beta with real users. New screens and growth features should not displace Beta Gate work.

## Priority definitions

- **P0 — Beta Gate:** Must be complete before real users upload sensitive photos.
- **P1 — Beta Quality:** Should be complete during the closed beta before increasing user volume.
- **P2 — Scale Readiness:** Required before roughly 1,000 MAU or when the stated trigger is reached.
- **P3 — Maintainability / Later:** Valuable, but does not currently block product validation.

## Architecture decision: inference provider

- Keep **Roboflow Public** for development and the first closed beta while usage remains within the free allowance and the data-handling terms are acceptable.
- Do **not** subscribe to Roboflow Core automatically when usage increases.
- Begin a **Google Cloud Run inference prototype** at approximately 8,000–10,000 analyses per month, or earlier if privacy requirements make hosted Roboflow inference unsuitable.
- Compare Roboflow and Cloud Run for accuracy, latency, failure rate, privacy controls, and real cost before switching traffic.
- Retain Expo / React Native, Supabase Auth, Postgres, RLS, Private Storage, Edge Functions, and all existing journal relationships. Only the inference-provider layer should change.
- A Cloud Run migration depends on obtaining legally usable model weights or training a replacement model. Moving the current model does not improve its accuracy.
- Prefer a gradual provider rollout (test traffic, then 10%, 50%, 100%) with a rollback switch.

## Ordered backlog

### P0 — Beta Gate

#### P0.1 Durable AI job lifecycle

**Status (2026-09-01): Implemented and deployed to the Development Project.** The database now owns queued/running/manual-required state, a scheduled watchdog converts abandoned work to manual fallback, the Edge Function resumes queued jobs with bounded retries, and the App restores pending work after refresh/re-login. TypeScript, Roboflow mapping/timeout tests, migration dry run, remote migration, and database lint passed. The close/reopen acceptance scenario still needs the formal automated and physical-device runs tracked in P0.8 and P0.11.

**Goal:** Every analysis must end as succeeded, failed, or manual-selection-required; it must never remain in permanent loading.

- Process queued analysis independently of the Processing screen.
- Survive app closure, backgrounding, refresh, re-login, and temporary network loss.
- Add bounded timeout and retry rules with attempt tracking.
- Validate provider responses and Type 1–7 mapping before persistence.
- After final failure, preserve the journal entry and offer manual Bristol selection.
- Keep upload, inference, and Gallery-refresh errors as separate states.
- Do not tell the user that upload failed when only the final Gallery refresh failed.

**Acceptance:** Closing the app during analysis and reopening it eventually shows a result or a clear manual fallback, never indefinite loading.

#### P0.2 Idempotent capture and duplicate prevention

**Status (2026-09-01): Implemented and deployed to the Development Project.** Capture requests now carry one owner-scoped operation key, repeated create/upload/finalize requests reuse the same entry, finalized originals cannot be overwritten by a replay, initial analysis jobs have a backend deduplication key, and two intentional same-day captures remain distinct. The database migration, capture Edge Function v4, schema lint, TypeScript check, and operation-key unit test passed. The rapid-double-tap end-to-end case remains part of P0.8/P0.11 formal QA.

**Goal:** Repeated taps, retries, and reconnection must not create duplicate entries or duplicate AI jobs.

- Generate one operation/idempotency key per capture attempt.
- Disable duplicate submission in the UI, but do not rely on the UI alone.
- Enforce duplicate protection in the trusted backend/database.
- Make finalize and analysis requests safely repeatable.
- Support multiple legitimate entries on the same day without treating them as duplicates.

**Acceptance:** Rapidly tapping twice or retrying the same operation produces one entry; two intentional captures produce two entries.

#### P0.3 Upload failure safety and orphan cleanup

**Status (2026-09-02): Implemented and deployed to the Development Project.** Captures now have explicit awaiting/ready/failed states and a one-hour expiry. The trusted capture backend removes only expired, never-finalized Storage objects and tombstones their incomplete database entries. Cleanup runs on the owner’s next sign-in or capture and cannot select successful originals. Safe restart continues to use the P0.2 operation key. Migration, function deployment, and remote Database lint passed; interrupted-network physical QA remains in P0.11.

**Goal:** Partial uploads must not leave unmanaged health records or private files.

- Define explicit upload states and expiry timestamps.
- Clean up abandoned Storage objects and incomplete database records from a trusted backend task.
- Make network reconnection offer a safe retry/restart.
- Confirm database finalization only after the expected private object exists.
- Do not require byte-level resumable upload for the first beta; safe restart without duplication is sufficient.

**Acceptance:** Interrupting upload at every stage leaves either one valid entry or a cleanup-eligible incomplete operation, never an unowned file.

#### P0.4 Verified original-photo deletion and retention

**Status (2026-09-01): Deferred by product decision — do not implement yet.** Keep successful original photos in Private Storage and retain the existing schema-level `keep` / `delete_after_analysis` / `delete_after_7_days` support for future use, but do not activate automatic deletion workers, seven-day schedules, or post-analysis deletion. Manual deletion/account-deletion requirements remain separate future work. P0.3 may still remove abandoned incomplete uploads because those are failed workflow artifacts, not successfully saved user originals.

**Goal:** “Permanently delete” must delete the private Storage object through trusted backend code and leave auditable, non-sensitive deletion status.

- Implement `keep`, `delete_after_analysis`, and `delete_after_7_days` execution.
- Run deletion through a trusted backend/worker; the client must not directly delete objects.
- Make deletion retryable and idempotent.
- Reconcile database metadata and Storage state.
- Add a scheduled cleanup path and failed-deletion monitoring.
- Confirm that deleted originals can no longer receive a signed URL.

**Acceptance:** A deletion request is verified against Storage, repeated deletion is harmless, and failures remain visible for retry.

#### P0.5 Server-enforced usage and abuse limits

**Status (2026-09-02): Implemented and deployed to the Development Project.** The backend atomically enforces owner-scoped daily limits of 10 new captures and 30 provider attempts. Replays use the same ledger key and do not consume twice. It validates actual JPEG/PNG/WebP bytes, a 10 MB byte limit, a 12,000 px edge limit, and a 25-megapixel limit before analysis; rejected images are removed and do not retain quota. The App presents a clear quota message. Migration, function deployment, image-byte tests, and Database lint passed.

**Goal:** A user or script cannot create unlimited uploads or AI charges.

- Limit capture creation, image upload, inference attempts, and manual retries per user and time window.
- Add image size/type/dimension limits before provider calls.
- Reject usage based on backend/database truth, not a client counter.
- Record enough non-sensitive usage metadata to calculate per-user AI cost.
- Provide a clear user-facing limit/fallback state.

**Acceptance:** Direct API calls cannot bypass limits, and rejected attempts do not create chargeable duplicate jobs.

#### P0.6 Privacy-safe error monitoring and audit trail

**Status (2026-09-02): Implemented and deployed to the Development Project.** A backend-only operational event table records bounded workflow IDs/status codes without photos, URLs, tokens, notes, passwords, or provider payloads. Terminal analysis failures are captured by a database trigger, capture/cleanup/account-deletion failures use structured redacted events, and events expire after 30 days. Migration, RLS grants, trigger creation, and remote Database lint passed.

**Goal:** Detect stuck or failed workflows without leaking sensitive content.

- Add structured errors for capture, upload, inference, correction, signed URL, and deletion.
- Explicitly redact image bodies/URLs, passwords, access tokens, API keys, health notes, and provider payloads.
- Monitor stuck jobs, repeated failures, orphan cleanup, and deletion failures.
- Define a short retention policy and access rules for logs.

**Acceptance:** Operators can diagnose a failed operation using IDs and status while logs contain no original image or sensitive request body.

#### P0.7 Doctor Review re-authentication

**Status (2026-09-02): Implemented; native-build verification pending.** Doctor Review authenticates with Face ID/Touch ID or device passcode on native devices, falls back to Supabase password re-authentication when biometrics are unavailable/Web, creates signed URLs only after success, uses two-minute URLs, and re-locks on background, navigation, or timeout. Static security tests pass. Face ID cannot be accepted as verified until the EAS/TestFlight physical-device run in P0.11.

**Goal:** Opening all original photos requires a fresh sensitive-action confirmation.

- On native devices, prefer Face ID / Touch ID / device passcode.
- Provide a secure re-authentication fallback where biometrics are unavailable.
- Lock again after leaving the screen, backgrounding the app, or a short timeout.
- Avoid generating all signed URLs before re-authentication succeeds.

**Acceptance:** A person holding an already-unlocked app session cannot open Doctor Review originals without the second check.

#### P0.8 Core failure-path and security tests

**Status (2026-09-19): Automated suite expanded; isolated-environment and physical-device execution pending.** Nineteen Node tests pass for source/security contracts, image-byte validation, idempotency, Roboflow mapping/timeout, consent alignment, and API-key isolation. TypeScript checking and a fresh Web production export also pass. SQL test assets cover two-user RLS/Storage isolation, quota, upload lifecycle, backend-only monitoring, and stale-job fallback. Remote Database lint was previously recorded as passing, but was not re-queried in this local verification. SQL execution is still **skipped** because the isolated database runner is unavailable; physical/error-path E2E remains P0.11. Per P0.4, successful-original deletion execution is excluded until that feature is resumed.

Automate the highest-risk flows before adding more product surface:

- Upload succeeds but AI fails.
- AI succeeds but Gallery reload fails.
- Same action is submitted rapidly twice.
- App closes during queued/processing analysis.
- Network disconnects and reconnects during upload and analysis.
- User A attempts to read or change User B data and private media.
- `anon` attempts to access authenticated health data.
- Client attempts to write backend-only AI fields.
- Account deletion and abandoned-upload cleanup are executed and verified. Successful-original retention/deletion remains deferred under P0.4.
- Multiple legitimate entries are created on the same day.

**Acceptance:** These tests run repeatably against an isolated test environment and report failed or skipped checks explicitly.

#### P0.9 Account recovery, logout, and account deletion

**Status (2026-09-02): Implemented and backend deployed; real-link/account verification pending.** Sign-in now offers enumeration-safe password recovery, `/reset-password` handles a recovery session and validates a new password, logout ends the local Supabase session, and Account has a password-plus-`DELETE` confirmation. The deployed `delete-account v1` verifies the password server-side, removes owner-prefixed Private Storage files, then deletes the Auth user so related rows cascade. Static security tests pass. Supabase redirect allow-list setup and a disposable real-account run remain required.

**Goal:** A real user can recover access, end a session, and permanently close the account without operator intervention.

- Add forgot-password and secure reset-link handling.
- Make logout visibly complete and clear the local private session/cache state.
- Implement backend-owned account deletion with re-authentication, confirmation, and status tracking.
- Delete or legally retain related database rows and private Storage objects according to the published policy.
- Test expired, reused, and malformed recovery links.

**Acceptance:** Password recovery, logout, and account deletion work on the real app; deletion leaves no accessible private media or active session.

#### P0.10 Production privacy and processor disclosure

**Status (2026-09-02): In-app behavior disclosure updated; release remains blocked on external/legal confirmation.** Consent version `2026-09-02` now states that successful originals are retained and automatic post-analysis/seven-day deletion is not active. The App does not claim an unverified Roboflow retention or training policy. A stable public policy still needs the operating entity, privacy contact, jurisdiction, and written confirmation/contract covering Roboflow inference images. Current Roboflow Public terms also describe Public Plan use as internal/non-commercial, so this plan must not be assumed suitable for an external real-user beta without confirmation.

**Goal:** Users can understand and exercise the real data practices before uploading a sensitive photo.

- Publish a stable Privacy Policy URL with operating entity and contact method.
- Disclose sensitive-photo purpose, AI processing, subprocessors, processing regions, retention choices, and deletion workflow.
- Confirm Roboflow inference-image retention, training use, deletion, security, and applicable data-processing terms before real-photo beta.
- Keep consent document versions aligned with the published policy.
- Prepare the App Store privacy answers from the implemented behavior, not planned behavior.

**Acceptance:** The in-app policy and public URL match actual storage, AI, retention, and account-deletion behavior, with no unconfirmed processor claim presented as fact.

#### P0.11 TestFlight build and real-app smoke test

**Status (2026-09-30): Local build readiness verified, EAS Project linked, and Development/Preview build environments configured; TestFlight build not yet produced.** `@zitaw/visual-gut-journal` is linked as EAS Project `e7c3060f-360c-4ed7-b253-2c083a28f928`. Both EAS `development` and `preview` contain the client-safe Supabase Project URL and Publishable key; server-only credentials remain outside the App environment. `eas.json`, iOS Bundle ID/build number, Face ID permission, export-compliance setting, and a formal Web/iPhone smoke checklist exist. The earlier Metro delay was traced to iCloud-evicted `node_modules` and asset files in the local workspace. Reinstalling the locked dependencies and hydrating required assets restored a successful TypeScript check, 19/19 Node tests, and a fresh Web production export (about 30 seconds of Metro bundling). This verifies the current local source can bundle, but it is not a TestFlight or real-device acceptance result. Apple signing/TestFlight credentials, a physical iPhone, dedicated test accounts, and the documented smoke run remain required.

**Goal:** Prove the authenticated production-like flow outside the browser preview.

- Configure the iOS Bundle ID, Apple Developer signing, EAS development/preview build, and TestFlight internal distribution.
- Use a dedicated formal test account, never public-demo sample ownership.
- On Web and a physical iPhone, complete consent, capture, upload, inline loading, AI result, correction, Gallery, original reveal, logout/login, and deletion.
- Verify camera permissions, session restoration, direct routes, background/foreground behavior, and no demo-data contamination.
- Record the tested app build, backend environment, account, date, and outcome.

**Acceptance:** One documented end-to-end smoke run passes on Web and a physical iPhone against the Development/Test backend before inviting external beta users.

### P1 — Beta Quality

#### P1.1 Clear capture, loading, error, retry, and success states

- Explain camera permission denial, capture failure, invalid file, upload failure, AI failure, and refresh failure separately.
- Add recovery actions that preserve already completed work.
- Add a useful Not Found state for invalid Result links.
- Prevent success UI before durable backend confirmation.

#### P1.2 Image quality and low-confidence handling

- Detect or warn about blur, darkness, rotation, unusable framing, and a subject that is too small.
- Define confidence bands and a reviewed threshold.
- Low confidence should request a retake or manual Type 1–7 selection rather than imply certainty.
- Continue to label output as an AI visual estimate, not a diagnosis.

#### P1.3 Physical-device and hostile-network QA

- Test supported iPhone sizes on real devices and simulator.
- Test slow, intermittent, offline, and reconnecting networks.
- Test backgrounding, force close, restart, logout/login, expired session, and second-device access.
- Verify camera, private file handling, biometric lock, and deletion lifecycle on native builds.

#### P1.4 Small model-evaluation set

- Build a consented, de-identified evaluation set separate from training data.
- Measure overall accuracy, per-Type accuracy, confusion pairs, correction rate, low-confidence rate, latency, and failure rate.
- Record model/provider/version for every result.
- Do not pay for or migrate the current model until real evaluation shows sufficient product value.

#### P1.5 Cross-device refresh consistency

- Make a newly completed entry appear reliably on another signed-in device.
- Add foreground/reconnect refresh and stale-state indicators.
- Reconcile local state with server truth instead of silently preserving stale success states.

#### P1.6 AI artwork generation experiment

**Goal:** Validate whether uniquely generated Gut Creatures improve collection, return, and sharing behavior beyond the existing curated set.

- Select a low-cost image provider only after defining style consistency, privacy, latency, and per-artwork budget.
- Generate from structured, non-sensitive traits; do not send the original stool photo unless separately reviewed and consented.
- Preserve the current eight curated Gut Creatures as deterministic fallback assets.
- Validate output dimensions, safety, branding, duplicate similarity, and generation metadata.
- Run this as a controlled beta experiment before making it the default experience.

**Why not P0:** The current curated artwork set is sufficient to validate the closed-beta journal flow. AI artwork is central to the longer-term product hypothesis, but it must not delay privacy and reliability gates.

#### P1.7 Durable artwork job pipeline

**Goal:** Once AI artwork is enabled, every generation ends in a stored artwork or a curated fallback, never permanent loading.

- Create versioned artwork jobs with provider/model/style metadata, attempts, cost, status, and error code.
- Add bounded retry and idempotency.
- Store completed artwork in the correct private/public product boundary with database metadata.
- Fall back to a deterministic curated creature when generation fails or exceeds the latency budget.
- Keep Bristol analysis success independent from artwork-generation failure.

**Dependency:** Start after P1.6 identifies a provider and an acceptable generation contract.

#### P1.8 Account settings quality

- Add verified email-change flow and clear account/security settings.
- Improve logout confirmation and signed-out navigation.
- Explain pending email verification and recovery states without revealing whether an unrelated address has an account.

### P2 — Scale Readiness

#### P2.1 Gallery pagination and virtualized rendering

- Stop loading the full lifetime history at once.
- Load journal entries in stable date/id pages.
- Lazy-load artwork and signed media URLs.
- Preserve correct ordering for multiple entries on the same day.

**Trigger:** Before approximately 1,000 MAU or when long-history users show measurable delay.

#### P2.2 Doctor Review date ranges and batched originals

- Filter by appointment/date range.
- Load signed original URLs in small batches only after re-authentication.
- Show date/time clearly and support more than one entry per day.

#### P2.3 Local read cache and offline Gallery

- Preserve a safe read-only snapshot of already synchronized metadata/artwork.
- Clearly mark offline/stale data.
- Queue only operations that can be retried idempotently.
- Do not cache revealed sensitive originals without an explicit encrypted design.

#### P2.4 Cloud Run inference proof of concept

- Confirm model-weight rights or train/export a replacement model.
- Package deterministic preprocessing and ONNX/PyTorch inference.
- Protect the endpoint so only trusted backend calls are accepted.
- Do not store images or include image content in logs.
- Benchmark latency, cold start, accuracy, cost, and concurrency.
- Add provider selection, gradual rollout, and rollback.

**Trigger:** Start at 8,000–10,000 analyses/month, before the Roboflow free ceiling, or immediately if Roboflow data terms are unacceptable.

#### P2.5 Cost dashboards and alerts

- Report analyses per user, retries, provider cost, Storage growth, and deletion savings.
- Alert on unusual per-user usage, retry storms, stuck queues, and monthly budget thresholds.
- Separate free and future paid-user unit economics.

#### P2.6 Time and milestone regression suite

- Test cross-month, timezone, daylight-saving, year boundary, and leap-year behavior.
- Test Weekly Digest and Monthly Gallery eligibility with multiple same-day entries.
- Test future annual/seasonal milestones before enabling them.

#### P2.7 Subscription, quota, and Apple In-App Purchase

- Define Free quota, Plus entitlement, trial, renewal, cancellation, restore purchase, and grace-period behavior.
- Treat Apple/server-verified entitlement as source of truth; never trust a client `isPaid` flag.
- Make purchase/webhook processing idempotent and test duplicate/out-of-order events.
- Connect product paywalls only after retention and value-trigger evidence exists.

#### P2.8 Gut Wrapped and sharing growth loop

- Generate privacy-safe share cards that exclude originals and sensitive notes.
- Add stable deep links with safe signed-out behavior.
- Measure creation, share, open, and return events without collecting unnecessary health content.
- Validate that Wrapped periods and statistics use the effective-analysis source of truth.

#### P2.9 App Store production submission

- Prepare production EAS Build, App Store metadata, screenshots, support URL, privacy URL, age rating, review notes, and account-deletion instructions.
- Complete privacy declarations and provide a reviewer test account where required.
- Verify production environment separation, release monitoring, rollback, and incident contact.

**Dependency:** TestFlight smoke testing is P0; public App Store submission follows closed-beta evidence and completed release gates.

### P3 — Maintainability / Later

#### P3.1 Incremental page/service separation

- After P0 tests exist, extract database, AI-state, original-photo, correction, and milestone logic from oversized screens.
- Avoid a broad rewrite; move one tested responsibility at a time.

#### P3.2 Documentation refresh

- Update README, architecture notes, environment setup, privacy boundaries, background-job behavior, and provider-switch procedure.
- Clearly distinguish public demo behavior from authenticated production behavior.

#### P3.3 Dependency and dead-code cleanup

- Remove unused packages and stale prototype paths only after regression tests protect the active flows.
- Resolve inconsistent naming without changing product behavior.

#### P3.4 True resumable upload, if evidence supports it

- Add byte-level/chunked resume only if real-user upload sizes and failure telemetry justify the additional complexity.
- Until then, use safe restart plus idempotency and orphan cleanup.

#### P3.5 Doctor Summary / PDF export

- Define the minimum clinician-facing content with professional review before building a full report workflow.
- Include date/time, user-confirmed/effective classification, relevant context, and non-diagnostic wording.
- Keep export access re-authenticated and avoid long-lived public PDF URLs.

**Why deferred:** Date grouping and batched original review provide the immediate appointment value; a full PDF workflow is not required for the first MVP validation.

## Release sequence

1. Durable AI lifecycle and manual fallback.
2. Idempotent capture, upload-state integrity, and orphan cleanup.
3. Verified original deletion and retention worker.
4. Usage limits, privacy-safe monitoring, and Doctor Review re-authentication.
5. Account recovery/deletion, production privacy disclosure, and core failure/security tests.
6. TestFlight build plus Web/physical-iPhone smoke test.
7. User-facing failure states, image-quality guidance, and real-device/weak-network QA.
8. Small Roboflow accuracy evaluation and cross-device refresh.
9. Closed beta with controlled user count and monitored costs.
10. AI artwork experiment and durable artwork pipeline without blocking the curated fallback.
11. Pagination, batched Doctor Review, offline read cache, and scale testing.
12. Cloud Run provider trial when the trigger is reached.
13. Subscription, sharing, and public App Store preparation after retention evidence.
14. Incremental refactor, documentation, and dependency cleanup.

## Closed-beta release gate

Real sensitive-photo beta should not begin until all P0 items pass in the development/test project. Any skipped privacy, ownership, deletion, duplicate-prevention, or AI-lifecycle test blocks release.
