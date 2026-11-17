CREATE TABLE `roster_entries` (
	`trainer_id` text NOT NULL,
	`position` integer NOT NULL,
	`entry_id` text NOT NULL,
	`species_id` integer NOT NULL,
	`base_species_id` integer NOT NULL,
	`rarity` text NOT NULL,
	`shiny` integer NOT NULL,
	`level` integer NOT NULL,
	`ivs` text NOT NULL,
	`ability` text,
	`ability_slot` integer,
	`gender` text,
	`nature` text,
	`learned` text,
	`moveset` text,
	`ability_choice` text,
	`nickname` text,
	`stage` integer,
	`chain_len` integer,
	`active` integer,
	CONSTRAINT `roster_entries_pk` PRIMARY KEY(`trainer_id`, `position`),
	CONSTRAINT `fk_roster_entries_trainer_id_trainers_id_fk` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `trainers` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`team` text DEFAULT '[]' NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`losses` integer DEFAULT 0 NOT NULL,
	`total_tokens` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`last_seen` integer
);
--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` text PRIMARY KEY,
	`status` text NOT NULL,
	`mode` text,
	`level_cap` integer,
	`visibility` text,
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
CREATE TABLE `tournament_matches` (
	`tournament_id` text NOT NULL,
	`round` integer NOT NULL,
	`position` integer NOT NULL,
	`seat_a` integer,
	`seat_b` integer,
	`winner` integer,
	`coin_flip` integer,
	`challenge_id` text,
	CONSTRAINT `tournament_matches_pk` PRIMARY KEY(`tournament_id`, `round`, `position`),
	CONSTRAINT `fk_tournament_matches_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `tournament_seats` (
	`tournament_id` text NOT NULL,
	`position` integer NOT NULL,
	`seat_id` text NOT NULL,
	`name` text NOT NULL,
	`ai` text,
	`ai_base` text,
	`ready` integer NOT NULL,
	CONSTRAINT `tournament_seats_pk` PRIMARY KEY(`tournament_id`, `position`),
	CONSTRAINT `fk_tournament_seats_tournament_id_tournaments_id_fk` FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY,
	`host_id` text NOT NULL,
	`mode` text NOT NULL,
	`level_cap` integer,
	`size` integer NOT NULL,
	`visibility` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`draw_at` integer,
	`ai_level` integer,
	`next_at` integer,
	`current` text,
	`champion` integer,
	`finished_at` integer
);
--> statement-breakpoint
CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `roster_entries_entry_id` ON `roster_entries` (`entry_id`);--> statement-breakpoint
CREATE INDEX `challenges_host` ON `challenges` (`host_id`);--> statement-breakpoint
CREATE INDEX `challenges_guest` ON `challenges` (`guest_id`);--> statement-breakpoint
CREATE INDEX `challenges_status` ON `challenges` (`status`);--> statement-breakpoint
CREATE INDEX `challenges_tournament` ON `challenges` (`tournament_id`);