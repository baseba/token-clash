CREATE TABLE `tower_runs` (
	`id` text PRIMARY KEY,
	`trainer_id` text NOT NULL,
	`difficulty` text NOT NULL,
	`length` integer,
	`seed` text NOT NULL,
	`status` text NOT NULL,
	`floor` integer NOT NULL,
	`party` text NOT NULL,
	`offers` text NOT NULL,
	`rewards` text NOT NULL,
	`room` text,
	`picks` integer DEFAULT 0 NOT NULL,
	`rerolls` integer DEFAULT 0 NOT NULL,
	`rolls` text DEFAULT '{}' NOT NULL,
	`log` text DEFAULT '[]' NOT NULL,
	`challenge_id` text,
	`last_result` text,
	`cleared` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
ALTER TABLE `challenges` ADD `staging` text;--> statement-breakpoint
CREATE INDEX `tower_runs_trainer` ON `tower_runs` (`trainer_id`);--> statement-breakpoint
CREATE INDEX `tower_runs_status` ON `tower_runs` (`status`);