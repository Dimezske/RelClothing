ALTER TABLE `products` ADD `salePercent` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `saleActive` integer DEFAULT false NOT NULL;