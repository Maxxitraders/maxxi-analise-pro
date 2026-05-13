CREATE TABLE `margem_consultations` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `cpf` varchar(14) NOT NULL,
  `nomeCompleto` varchar(255),
  `dataNascimento` varchar(16),
  `margemDisponivel` decimal(10, 2),
  `margemUtilizada` decimal(10, 2),
  `margemTotal` decimal(10, 2),
  `margemCartaoDisponivel` decimal(10, 2),
  `margemCartaoUtilizada` decimal(10, 2),
  `orgao` varchar(255),
  `competencia` varchar(16),
  `status` varchar(32) NOT NULL,
  `rawResponse` text,
  `createdAt` timestamp NOT NULL DEFAULT NOW()
);
