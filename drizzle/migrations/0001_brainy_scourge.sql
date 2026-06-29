CREATE TABLE `cartItems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` text(128) NOT NULL,
	`userId` integer,
	`productId` integer NOT NULL,
	`size` text(16) NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`orderId` integer NOT NULL,
	`productId` integer NOT NULL,
	`productName` text(160) NOT NULL,
	`size` text(16) NOT NULL,
	`quantity` integer NOT NULL,
	`priceCents` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sessionId` text(128) NOT NULL,
	`userId` integer,
	`customerName` text(160) NOT NULL,
	`customerEmail` text(320) NOT NULL,
	`shippingAddress` text NOT NULL,
	`totalCents` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text(160) NOT NULL,
	`name` text(160) NOT NULL,
	`description` text NOT NULL,
	`priceCents` integer NOT NULL,
	`category` text(80) NOT NULL,
	`imageUrl` text NOT NULL,
	`sizes` text NOT NULL,
	`inStock` integer DEFAULT true NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);