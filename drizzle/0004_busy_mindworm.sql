ALTER TABLE `users` ADD `stripeCustomerId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `planId` varchar(32) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` varchar(32) DEFAULT 'none';--> statement-breakpoint
ALTER TABLE `users` ADD `consultasUsedThisMonth` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `consultasResetAt` timestamp;