CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(32) NOT NULL,
	`name` varchar(64) NOT NULL,
	`description` text,
	`monthlyPrice` int NOT NULL,
	`consultasLimit` int NOT NULL,
	`features` json NOT NULL,
	`popular` boolean DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`stripePriceId` varchar(128),
	`stripeProductId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `plans_slug_unique` UNIQUE(`slug`)
);
