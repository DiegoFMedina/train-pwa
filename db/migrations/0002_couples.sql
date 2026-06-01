-- Migración 0002 — Pareja (couples)
-- Habilita compartir finanzas (y luego rutinas/dieta) entre 2 personas.
-- Las entidades compartibles tendrán couple_id NULLABLE en fases siguientes:
--   NULL     → entidad personal (privada del user_id)
--   NOT NULL → entidad de la pareja (visible para ambos members)

BEGIN;

-- Una pareja vincula 2 personas. El owner es quien la creó y puede borrarla.
CREATE TABLE couples (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(80) NOT NULL DEFAULT 'Nuestra cuenta',
    owner_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at  TIMESTAMPTZ,
    version     INTEGER NOT NULL DEFAULT 1
);

-- Membresía. El owner SIEMPRE tiene una fila con role='owner'.
-- Por ahora limitamos a 2 members por couple (constraint a nivel app + check).
CREATE TABLE couple_members (
    couple_id   UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(10) NOT NULL DEFAULT 'member'
                CHECK (role IN ('owner','member')),
    joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    invited_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (couple_id, user_id)
);

-- Un user solo puede estar en UNA pareja activa a la vez. Esto evita
-- ambigüedad del scope ("¿con cuál pareja estoy?").
CREATE UNIQUE INDEX idx_couple_members_user_unique
    ON couple_members (user_id);

-- Códigos cortos de invitación. Generados por un member, consumidos por
-- otro user que aún no pertenece a la pareja.
CREATE TABLE couple_invitations (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    couple_id    UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    code         VARCHAR(16) NOT NULL UNIQUE,
    invited_by   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at   TIMESTAMPTZ NOT NULL,
    accepted_at  TIMESTAMPTZ,
    accepted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_couple_invitations_code
    ON couple_invitations (code)
    WHERE accepted_at IS NULL AND revoked_at IS NULL;
CREATE INDEX idx_couple_invitations_couple
    ON couple_invitations (couple_id);

-- Trigger touch_row para que updated_at + version se mantengan solos.
CREATE TRIGGER trg_touch_couples
    BEFORE UPDATE ON couples
    FOR EACH ROW EXECUTE FUNCTION touch_row();

COMMIT;
