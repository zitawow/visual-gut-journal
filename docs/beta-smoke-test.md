# Visual Gut Journal — Beta Smoke Test Record

This checklist is a release gate. Use dedicated test accounts and the Development/Test Supabase project only. Never put passwords, image URLs, access tokens, API keys, or health-photo contents in this record.

## Build under test

- App version / build number:
- Git commit:
- Expo / EAS build URL:
- Backend project ref: `sfbtltobkybaqrkphdgx` (Development/Test)
- Edge Function versions:
- Test date and tester:
- Device / iOS version:
- Web browser / version:

## Web flow

- [ ] Sign up and email verification complete.
- [ ] Sign in reaches the private Journal, not the developer account-status page.
- [ ] Consent is required before capture.
- [ ] Capture/upload shows an inline progress state.
- [ ] Repeated submit does not create a duplicate entry.
- [ ] Successful AI result shows Bristol Type 1–7, confidence, and non-diagnostic wording.
- [ ] User confirmation persists after refresh and re-login.
- [ ] User correction preserves the original AI prediction and persists after refresh.
- [ ] Gallery shows the new private entry and no Public Demo entries.
- [ ] Invalid result route shows a useful Not Found state.
- [ ] Logout removes the private session and browser Back cannot reopen private data.
- [ ] Password reset works; expired/reused/malformed links fail safely.

## Physical iPhone flow

- [ ] Camera permission denial and later approval both recover clearly.
- [ ] Capture, upload, AI loading, result, correction, and Gallery complete.
- [ ] Background during upload/analysis; reopen reaches result or manual fallback, never permanent loading.
- [ ] Weak/disconnected network offers safe retry without duplicate entry.
- [ ] Doctor Review requires Face ID / Touch ID / device passcode before signed URLs are created.
- [ ] Doctor Review re-locks after backgrounding, leaving, and timeout.
- [ ] Session restores after relaunch; logout removes the private session.
- [ ] Second signed-in device sees the durable result after refresh/foreground.
- [ ] Account deletion requires password and leaves no working session or accessible private media.

## Security / isolation

- [ ] User A can read and update only User A data.
- [ ] User B can read and update only User B data.
- [ ] User A cannot read, update, or delete User B data or private files, and vice versa.
- [ ] `anon` cannot read authenticated health tables or private files.
- [ ] Client cannot write AI analyses, generation jobs, usage events, or operational events.
- [ ] Quota rejection is clear and direct API retries cannot bypass it.

## Outcome

- Passed:
- Failed:
- Skipped (each skipped item must include a reason):
- Release decision: **BLOCKED / READY FOR CLOSED BETA**
- Follow-up owner and date:
