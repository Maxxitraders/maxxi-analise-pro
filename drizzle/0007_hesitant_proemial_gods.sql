CREATE TABLE `margem_consultations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cpf` varchar(14) NOT NULL,
	`matricula` varchar(100),
	`cnpj` varchar(14),
	`nomeCompleto` varchar(255),
	`dataNascimento` varchar(16),
	`margemDisponivel` decimal(10,2),
	`margemUtilizada` decimal(10,2),
	`margemTotal` decimal(10,2),
	`margemCartaoDisponivel` decimal(10,2),
	`margemCartaoUtilizada` decimal(10,2),
	`orgao` varchar(255),
	`competencia` varchar(16),
	`status` varchar(32) NOT NULL,
	`rawResponse` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `margem_consultations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `serasa_consultations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`cpf` varchar(11) NOT NULL,
	`score` int,
	`scoreCategoria` varchar(50),
	`nome` varchar(255),
	`dataNascimento` varchar(16),
	`totalPendencias` decimal(10,2),
	`qtdPendencias` int DEFAULT 0,
	`totalProtestos` decimal(10,2),
	`qtdProtestos` int DEFAULT 0,
	`totalChequesSemFundo` decimal(10,2),
	`qtdChequesSemFundo` int DEFAULT 0,
	`totalChequesSustados` decimal(10,2),
	`qtdChequesSustados` int DEFAULT 0,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`rawResponse` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `serasa_consultations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
);
--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `bureau` varchar(32) DEFAULT 'boavista';--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `cpfCnpj` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `resetToken` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `resetTokenExpiry` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `saldo` decimal(10,2) DEFAULT '0.00' NOT NULL;