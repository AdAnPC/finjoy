---
name: App Storage provisioning
description: Replit App Storage setup behavior observed in this workspace.
---

Retry the idempotent App Storage setup when provisioning returns a non-budget internal error; a later retry can create the bucket and set the required environment variables successfully.

**Why:** The first provisioning attempt failed internally, while a subsequent identical attempt succeeded without code or budget changes.

**How to apply:** Do not classify generic provisioning failures as cloud-budget exhaustion. Retry once, then surface the exact failure and consider manual App Storage setup.