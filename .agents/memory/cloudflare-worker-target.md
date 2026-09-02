---
name: Cloudflare Worker production target
description: The production script identity required for Livematchmv custom-domain API deployments.
---

Deploy the Cloudflare Worker as the `live-match` script. Do not deploy API fixes only to another similarly named Worker and assume the custom domain receives them.

**Why:** The custom-domain route `*.livematchmv.online/api*` is bound to `live-match`; deploying to a different script produced successful Worker-preview tests while the public site continued serving stale behavior.

**How to apply:** Keep the Wrangler project name aligned with `live-match`, then verify both the `workers.dev` URL and `https://www.livematchmv.online/api/...` after deployment.