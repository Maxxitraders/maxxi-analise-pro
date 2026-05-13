ALTER TABLE margem_consultations
ADD COLUMN matricula VARCHAR(100) AFTER cpf,
ADD COLUMN cnpj VARCHAR(14) AFTER matricula;
