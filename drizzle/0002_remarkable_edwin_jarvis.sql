ALTER TABLE `credit_analyses` ADD `nomeFantasia` varchar(255);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `atividadePrincipal` text;--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `endereco` text;--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `bairro` varchar(128);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `cidade` varchar(128);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `uf` varchar(2);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `cep` varchar(12);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `telefone` varchar(32);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `email` varchar(320);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `porte` varchar(64);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `socios` text;--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `scoreMensagem` text;--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `protestosJson` text;--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `pendenciasJson` text;--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `chequesSemFundo` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `chequesSustados` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `cadastralDataSource` varchar(32);--> statement-breakpoint
ALTER TABLE `credit_analyses` ADD `creditDataSource` varchar(32);