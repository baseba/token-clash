CREATE TABLE `trainer_sessions` (
	`token_hash` text PRIMARY KEY,
	`trainer_id` text NOT NULL,
	`opened_at` integer NOT NULL,
	CONSTRAINT `fk_trainer_sessions_trainer_id_trainers_id_fk` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `trainers` ADD `password_hash` text;--> statement-breakpoint
CREATE INDEX `trainer_sessions_trainer_id` ON `trainer_sessions` (`trainer_id`);