CREATE TABLE `radio_stations` (
	`owner_id` text PRIMARY KEY,
	`name` text NOT NULL,
	`opened_at` integer NOT NULL,
	`queue` text NOT NULL,
	`now_playing_track` text,
	`now_playing_started_at` integer,
	`now_playing_ends_at` integer
);
