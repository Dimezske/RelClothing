CREATE TABLE `giftCardTransactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`giftCardId` integer NOT NULL,
	`orderId` integer,
	`amountCents` integer NOT NULL,
	`note` text(200),
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `giftCards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text(32) NOT NULL,
	`initialValueCents` integer NOT NULL,
	`balanceCents` integer NOT NULL,
	`purchaserUserId` integer,
	`purchaserEmail` text(320),
	`recipientName` text(160),
	`recipientEmail` text(320),
	`message` text,
	`status` text DEFAULT 'pending_payment' NOT NULL,
	`paypalOrderId` text(64),
	`paypalCaptureId` text(64),
	`purchaseOrderId` integer,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `giftCards_code_unique` ON `giftCards` (`code`);--> statement-breakpoint
CREATE TABLE `productVariants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`productId` integer NOT NULL,
	`name` text(80) NOT NULL,
	`colorHexes` text NOT NULL,
	`imageUrl` text,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `cartItems` ADD `variantId` integer;--> statement-breakpoint
ALTER TABLE `cartItems` ADD `variantName` text(80);--> statement-breakpoint
ALTER TABLE `orderItems` ADD `variantName` text(80);--> statement-breakpoint
ALTER TABLE `orders` ADD `giftCardCode` text(32);--> statement-breakpoint
ALTER TABLE `orders` ADD `giftCardCents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `oneSizeFitsAll` integer DEFAULT false NOT NULL;