ALTER TABLE `users` ADD `saldo` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`tipo` enum('recarga','consulta','estorno') NOT NULL,
	`valor` decimal(10,2) NOT NULL,
	`descricao` text NOT NULL,
	`bureauTipo` varchar(32),
	`asaasPaymentId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);--> statement-breakpoint
CREATE INDEX `idx_userId` ON `transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_createdAt` ON `transactions` (`createdAt`);
