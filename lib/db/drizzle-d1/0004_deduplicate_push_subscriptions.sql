DELETE FROM `push_subscriptions`
WHERE `id` NOT IN (
  SELECT MIN(`id`) FROM `push_subscriptions` GROUP BY `endpoint`
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `push_subscriptions_endpoint_unique`
ON `push_subscriptions` (`endpoint`);