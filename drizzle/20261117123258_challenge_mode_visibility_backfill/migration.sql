-- Rooms older than modes were team battles, and rooms older than visibility were private (link only).
-- Expand step: fill them in and always write both from now on. The columns stay nullable so the previous
-- image (which a failed deploy rolls back to) can still insert; NOT NULL comes in a later release.
UPDATE `challenges` SET `mode` = 'team' WHERE `mode` IS NULL;--> statement-breakpoint
UPDATE `challenges` SET `visibility` = 'private' WHERE `visibility` IS NULL;
