-- Migração incremental: npm run db:migrate verifica colunas antes de executar.
ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN status ENUM('active','suspended') NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN session_version INT UNSIGNED NOT NULL DEFAULT 0;
