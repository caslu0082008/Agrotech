-- ══════════════════════════════════════════════════════
-- AgroTech — Schema do banco de dados MySQL
-- Execute este arquivo para criar o banco e as tabelas.
--
--   mysql -u root -p < sql/schema.sql
--
-- ══════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS agrotech
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE agrotech;

-- ── Usuários ──
CREATE TABLE IF NOT EXISTS users (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome                VARCHAR(150)      NOT NULL,
  email               VARCHAR(190)      NOT NULL,
  password_hash       VARCHAR(255)      NOT NULL,
  failed_login_count  INT UNSIGNED      NOT NULL DEFAULT 0,
  locked_until        DATETIME          NULL,
  created_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP
                                          ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_users_email UNIQUE (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Tokens de recuperação de senha ──
-- Armazenamos apenas o HASH (sha256) do token, nunca o token em texto puro.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       BIGINT UNSIGNED   NOT NULL,
  token_hash    CHAR(64)          NOT NULL,
  expires_at    DATETIME          NOT NULL,
  used_at       DATETIME          NULL,
  created_at    DATETIME          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_prt_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_prt_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_prt_user_id ON password_reset_tokens (user_id);
CREATE INDEX idx_prt_expires_at ON password_reset_tokens (expires_at);
