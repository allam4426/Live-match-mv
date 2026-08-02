#!/bin/bash
set -e

# Install / sync all workspace dependencies
pnpm install

# Push DB schema changes (idempotent — ADD COLUMN IF NOT EXISTS safe)
pnpm --filter @workspace/db run push-force
