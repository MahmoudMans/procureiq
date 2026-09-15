CREATE SEQUENCE procurement_funding_commitment_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_funding_tranche_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_funding_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_funding_commitments (
    id UUID PRIMARY KEY,

    commitment_number
        VARCHAR(60)
        NOT NULL,

    allocation_cycle_id
        UUID
        NOT NULL,

    allocation_cycle_number
        VARCHAR(60)
        NOT NULL,

    allocation_cycle_title
        VARCHAR(300)
        NOT NULL,

    allocation_item_id
        UUID
        NOT NULL,

    value_case_id
        UUID
        NOT NULL,

    case_number
        VARCHAR(60)
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    authorized_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    committed_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    funding_owner_user_id
        UUID
        NOT NULL,

    funding_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    objective
        VARCHAR(5000)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    activated_by_user_id
        UUID,

    activated_at
        TIMESTAMPTZ,

    activation_note
        VARCHAR(5000),

    closed_by_user_id
        UUID,

    closed_at
        TIMESTAMPTZ,

    close_note
        VARCHAR(5000),

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT uk_funding_commitment_number
        UNIQUE (
            commitment_number
        ),

    CONSTRAINT uk_funding_commitment_allocation_item
        UNIQUE (
            allocation_item_id
        ),

    CONSTRAINT fk_funding_commitment_cycle
        FOREIGN KEY (
            allocation_cycle_id
        )
        REFERENCES procurement_capital_allocation_cycles (id),

    CONSTRAINT fk_funding_commitment_item
        FOREIGN KEY (
            allocation_item_id
        )
        REFERENCES procurement_capital_allocation_items (id),

    CONSTRAINT fk_funding_commitment_value_case
        FOREIGN KEY (
            value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_funding_commitment_owner
        FOREIGN KEY (
            funding_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_funding_commitment_activator
        FOREIGN KEY (
            activated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_funding_commitment_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_funding_commitment_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_funding_commitment_amounts
        CHECK (
            authorized_capital_amount > 0
            AND committed_capital_amount > 0
            AND committed_capital_amount
                <= authorized_capital_amount
        ),

    CONSTRAINT ck_funding_commitment_status
        CHECK (
            status IN (
                'PLANNED',
                'ACTIVE',
                'FULLY_RELEASED',
                'CLOSED'
            )
        )
);

CREATE TABLE procurement_funding_tranches (
    id UUID PRIMARY KEY,

    commitment_id
        UUID
        NOT NULL,

    tranche_number
        VARCHAR(60)
        NOT NULL,

    sequence_no
        INTEGER
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    planned_release_amount
        NUMERIC(20, 2)
        NOT NULL,

    target_date
        DATE
        NOT NULL,

    status
        VARCHAR(40)
        NOT NULL,

    request_note
        VARCHAR(5000),

    requested_by_user_id
        UUID,

    requested_at
        TIMESTAMPTZ,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT uk_funding_tranche_number
        UNIQUE (
            tranche_number
        ),

    CONSTRAINT uk_funding_tranche_sequence
        UNIQUE (
            commitment_id,
            sequence_no
        ),

    CONSTRAINT fk_funding_tranche_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_funding_commitments (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_funding_tranche_requester
        FOREIGN KEY (
            requested_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_funding_tranche_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_funding_tranche_amount
        CHECK (
            planned_release_amount > 0
        ),

    CONSTRAINT ck_funding_tranche_sequence
        CHECK (
            sequence_no > 0
        ),

    CONSTRAINT ck_funding_tranche_status
        CHECK (
            status IN (
                'PLANNED',
                'READY_FOR_AUTHORIZATION',
                'AUTHORIZED',
                'RELEASED'
            )
        )
);

CREATE TABLE procurement_funding_gates (
    id UUID PRIMARY KEY,

    tranche_id
        UUID
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    requirement
        VARCHAR(4000)
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    evidence_note
        VARCHAR(5000),

    decision_note
        VARCHAR(5000),

    decided_by_user_id
        UUID,

    decided_at
        TIMESTAMPTZ,

    created_by_user_id
        UUID
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    updated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_funding_gate_tranche
        FOREIGN KEY (
            tranche_id
        )
        REFERENCES procurement_funding_tranches (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_funding_gate_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_funding_gate_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_funding_gate_status
        CHECK (
            status IN (
                'PENDING',
                'SATISFIED',
                'WAIVED'
            )
        )
);

CREATE TABLE procurement_funding_authorizations (
    id UUID PRIMARY KEY,

    tranche_id
        UUID
        NOT NULL,

    commitment_id
        UUID
        NOT NULL,

    decision
        VARCHAR(20)
        NOT NULL,

    authorized_amount
        NUMERIC(20, 2)
        NOT NULL,

    authorization_note
        VARCHAR(5000)
        NOT NULL,

    authorized_by_user_id
        UUID
        NOT NULL,

    authorized_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_funding_authorization_tranche
        FOREIGN KEY (
            tranche_id
        )
        REFERENCES procurement_funding_tranches (id),

    CONSTRAINT fk_funding_authorization_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_funding_commitments (id),

    CONSTRAINT fk_funding_authorization_user
        FOREIGN KEY (
            authorized_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_funding_authorization_decision
        CHECK (
            decision IN (
                'APPROVED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_funding_authorization_amount
        CHECK (
            authorized_amount > 0
        )
);

CREATE TABLE procurement_funding_releases (
    id UUID PRIMARY KEY,

    tranche_id
        UUID
        NOT NULL,

    commitment_id
        UUID
        NOT NULL,

    authorization_id
        UUID
        NOT NULL,

    released_amount
        NUMERIC(20, 2)
        NOT NULL,

    release_note
        VARCHAR(5000)
        NOT NULL,

    released_by_user_id
        UUID
        NOT NULL,

    released_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_funding_release_tranche
        UNIQUE (
            tranche_id
        ),

    CONSTRAINT fk_funding_release_tranche
        FOREIGN KEY (
            tranche_id
        )
        REFERENCES procurement_funding_tranches (id),

    CONSTRAINT fk_funding_release_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_funding_commitments (id),

    CONSTRAINT fk_funding_release_authorization
        FOREIGN KEY (
            authorization_id
        )
        REFERENCES procurement_funding_authorizations (id),

    CONSTRAINT fk_funding_release_user
        FOREIGN KEY (
            released_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_funding_release_amount
        CHECK (
            released_amount > 0
        )
);

CREATE TABLE procurement_funding_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(60)
        NOT NULL,

    commitment_id
        UUID
        NOT NULL,

    commitment_number
        VARCHAR(60)
        NOT NULL,

    allocation_cycle_number
        VARCHAR(60)
        NOT NULL,

    case_number
        VARCHAR(60)
        NOT NULL,

    initiative_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    commitment_status
        VARCHAR(30)
        NOT NULL,

    authorized_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    committed_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    planned_release_amount
        NUMERIC(20, 2)
        NOT NULL,

    released_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_commitment_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_authorization_amount
        NUMERIC(20, 2)
        NOT NULL,

    release_pct
        NUMERIC(7, 2)
        NOT NULL,

    tranche_count
        INTEGER
        NOT NULL,

    released_tranche_count
        INTEGER
        NOT NULL,

    pending_gate_count
        INTEGER
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_funding_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_funding_snapshot_commitment
        FOREIGN KEY (
            commitment_id
        )
        REFERENCES procurement_funding_commitments (id),

    CONSTRAINT fk_funding_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_funding_snapshot_release_pct
        CHECK (
            release_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_funding_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    tranche_id
        UUID
        NOT NULL,

    tranche_number
        VARCHAR(60)
        NOT NULL,

    sequence_no
        INTEGER
        NOT NULL,

    title
        VARCHAR(300)
        NOT NULL,

    planned_release_amount
        NUMERIC(20, 2)
        NOT NULL,

    released_amount
        NUMERIC(20, 2)
        NOT NULL,

    status
        VARCHAR(40)
        NOT NULL,

    gate_count
        INTEGER
        NOT NULL,

    resolved_gate_count
        INTEGER
        NOT NULL,

    authorization_count
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_funding_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_funding_snapshots (id)
        ON DELETE CASCADE
);

CREATE INDEX idx_funding_commitment_status
    ON procurement_funding_commitments (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_funding_tranche_commitment
    ON procurement_funding_tranches (
        commitment_id,
        sequence_no,
        status
    );

CREATE INDEX idx_funding_gate_tranche
    ON procurement_funding_gates (
        tranche_id,
        status
    );

CREATE INDEX idx_funding_authorization_tranche
    ON procurement_funding_authorizations (
        tranche_id,
        authorized_at DESC
    );

CREATE INDEX idx_funding_snapshot_commitment
    ON procurement_funding_snapshots (
        commitment_id,
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_funding_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement funding authorization and release evidence is immutable';
END;
$$;

CREATE TRIGGER trg_funding_authorization_immutable
BEFORE UPDATE OR DELETE
ON procurement_funding_authorizations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_funding_evidence_mutation();

CREATE TRIGGER trg_funding_release_immutable
BEFORE UPDATE OR DELETE
ON procurement_funding_releases
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_funding_evidence_mutation();

CREATE TRIGGER trg_funding_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_funding_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_funding_evidence_mutation();

CREATE TRIGGER trg_funding_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_funding_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_funding_evidence_mutation();

CREATE TRIGGER trg_audit_funding_commitments
AFTER INSERT OR UPDATE
ON procurement_funding_commitments
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_funding_tranches
AFTER INSERT OR UPDATE
ON procurement_funding_tranches
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_funding_gates
AFTER INSERT OR UPDATE
ON procurement_funding_gates
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_funding_authorizations
AFTER INSERT
ON procurement_funding_authorizations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_funding_releases
AFTER INSERT
ON procurement_funding_releases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_funding_snapshots
AFTER INSERT
ON procurement_funding_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
