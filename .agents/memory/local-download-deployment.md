---
name: Local downloads and deployment
description: User's portability goal and Railway deployment destination for FinJoy.
---

Keep FinJoy usable as a complete project downloaded to the user's PC, with simple local setup and build steps. The user intends to publish it to Railway.

**Why:** The user explicitly asked that the whole project be designed for downloading to their PC and later self-publishing.

**How to apply:** Preserve cross-platform local scripts and clear operational documentation. Store APKs on a persistent Railway Volume using `APK_STORAGE_DIR`; do not add Replit, S3 or GCS storage integrations unless the user changes this direction.

The user also wants the generated APK to run outside the hosting service. Keep the installed mobile app self-contained; it currently stores data locally and is not synchronized with the admin API.

**Why:** The user asked for the APK to function independently and selected Railway for hosting the project services.

**How to apply:** Avoid dependencies on hosting-provider domains in the APK. Do not imply local APK data is synchronized with the production panel or API.

The financed phone must still enforce the cached payment deadline while offline. Once the account and active loan have synced, the app recalculates overdue status locally and applies the lock after the configured grace period without requiring an active network connection. Payments and account changes made on the server become visible after the phone reconnects.

**How to apply:** Preserve offline due-date enforcement when changing app synchronization, account caching, or Device Owner policies. Do not claim an offline phone can receive a new remote command or learn about a payment the server has not synchronized.
