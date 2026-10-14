---
name: Local downloads and deployment
description: User's portability goal and undecided production-hosting destination for FinJoy.
---

Keep FinJoy usable as a complete project downloaded to the user's PC, with simple local setup and build steps. The user intends to publish it to production themselves later, but has not selected a hosting destination.

**Why:** The user explicitly asked that the whole project be designed for downloading to their PC and later self-publishing.

**How to apply:** Preserve cross-platform local scripts and clear operational documentation. Do not migrate the database or change the default storage provider before a destination is selected. APK storage may use an optional S3-compatible provider for external hosting while keeping Replit App Storage as the Replit default; document remaining Replit-only dependencies and production blockers.

The user also wants the generated APK to run outside Replit. Keep the installed mobile app self-contained; it currently stores data locally and is not synchronized with the admin API.

**Why:** The user asked for the APK to function outside Replit while leaving the production destination undecided.

**How to apply:** Avoid runtime dependencies on Replit domains in the APK. Do not imply local APK data is synchronized with the production panel or API.
