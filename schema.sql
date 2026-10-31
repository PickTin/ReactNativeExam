CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    first_name  VARCHAR(100) NOT NULL,
    last_name   VARCHAR(100) NOT NULL,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE offences (
    id           SERIAL PRIMARY KEY,
    description  TEXT NOT NULL,
    url          TEXT,
    date         DATE NOT NULL,
    time         TIME,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    latitude     DOUBLE PRECISION,
    longitude    DOUBLE PRECISION,
    client_uuid  UUID NOT NULL UNIQUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ
);

CREATE INDEX idx_offences_user ON offences(user_id);
CREATE INDEX idx_offences_updated ON offences(updated_at);
