-- Серверна схема (PostgreSQL). Реалізація REST API на Node.js — наступні етапи.

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    first_name  VARCHAR(100) NOT NULL,              -- ім'я
    last_name   VARCHAR(100) NOT NULL,              -- прізвище
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,              -- лише хеш (bcrypt), ніколи не пароль у відкритому вигляді
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE offences (
    id           SERIAL PRIMARY KEY,
    description  TEXT NOT NULL,                     -- опис
    url          TEXT,                              -- посилання на фото в Cloudinary (secure_url)
    date         DATE NOT NULL,                     -- дата правопорушення
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude     DOUBLE PRECISION,                  -- геолокація: широта
    longitude    DOUBLE PRECISION,                  -- геолокація: довгота
    client_uuid  UUID NOT NULL UNIQUE,              -- UUID із клієнта: захист від дублів при повторній синхронізації
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),-- для вибірки змін: GET /offences?updatedSince=...
    deleted_at   TIMESTAMPTZ                        -- м'яке видалення, щоб клієнти дізнавалися про видалення
);

CREATE INDEX idx_offences_user ON offences(user_id);
CREATE INDEX idx_offences_updated ON offences(updated_at);
