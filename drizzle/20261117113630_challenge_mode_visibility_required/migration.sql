-- Rooms older than modes were team battles, and rooms older than visibility were private (link only).
UPDATE `challenges` SET `mode` = 'team' WHERE `mode` IS NULL;--> statement-breakpoint
UPDATE `challenges` SET `visibility` = 'private' WHERE `visibility` IS NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_challenges` (
	`id` text PRIMARY KEY,
	`status` text NOT NULL,
	`mode` text NOT NULL,
	`level_cap` integer,
	`visibility` text NOT NULL,
	`ai` text,
	`ai_only` integer,
	`host_id` text NOT NULL,
	`host_name` text NOT NULL,
	`host_team` text NOT NULL,
	`guest_id` text,
	`guest_name` text,
	`guest_team` text,
	`tournament_id` text,
	`round` integer,
	`match_index` integer,
	`winner_id` text,
	`turns` integer,
	`final` text,
	`created_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_challenges`(`id`, `status`, `mode`, `level_cap`, `visibility`, `ai`, `ai_only`, `host_id`, `host_name`, `host_team`, `guest_id`, `guest_name`, `guest_team`, `tournament_id`, `round`, `match_index`, `winner_id`, `turns`, `final`, `created_at`, `finished_at`) SELECT `id`, `status`, `mode`, `level_cap`, `visibility`, `ai`, `ai_only`, `host_id`, `host_name`, `host_team`, `guest_id`, `guest_name`, `guest_team`, `tournament_id`, `round`, `match_index`, `winner_id`, `turns`, `final`, `created_at`, `finished_at` FROM `challenges`;--> statement-breakpoint
DROP TABLE `challenges`;--> statement-breakpoint
ALTER TABLE `__new_challenges` RENAME TO `challenges`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `challenges_host` ON `challenges` (`host_id`);--> statement-breakpoint
CREATE INDEX `challenges_guest` ON `challenges` (`guest_id`);--> statement-breakpoint
CREATE INDEX `challenges_status` ON `challenges` (`status`);--> statement-breakpoint
CREATE INDEX `challenges_tournament` ON `challenges` (`tournament_id`);