CREATE TABLE `pageViews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text(256) NOT NULL,
	`sessionId` text(128) NOT NULL,
	`userId` integer,
	`referrer` text(512),
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `paypalOrderId` text(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `paypalCaptureId` text(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `paymentStatus` text DEFAULT 'unpaid' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `refundedCents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `refundReason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);