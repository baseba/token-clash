ALTER TABLE `trainers` ADD `shop_baseline` integer;--> statement-breakpoint
ALTER TABLE `trainers` ADD `shop_spent` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `trainers` ADD `owned` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `trainers` ADD `equipped` text;