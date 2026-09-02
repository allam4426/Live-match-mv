---
name: Cloudflare Worker production target
description: The production script identity required for Livematchmv custom-domain API deployments.
---

Deploy the Cloudflare Worker as the `live-match` script. Do not deploy API fixes only to another similarly named Worker and assume the custom domain receives them.

**Why:** The custom-domain route `*.livematchmv.online/api*` is bound to `live-match`; deploying to a different script produced successful Worker-preview tests while the public site continued serving stale behavior.

**How to apply:** Keep the Wrangler project name aligned with `live-match`, then verify both the `workers.dev` URL and `https://www.livematchmv.online/api/...` after deployment.

Apply additive D1 migrations before deploying Worker code that selects or inserts the new columns.

**Why:** SQLite can treat a quoted missing column as a string literal during reads, so responses may contain the column name itself while writes fail with a missing-column error.

**How to apply:** Check the remote `livematchmv` D1 schema, apply only the required additive migration, then verify both a read and a reversible create/delete smoke test on the custom domain.