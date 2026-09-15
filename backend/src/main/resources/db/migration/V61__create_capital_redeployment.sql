CREATE SEQUENCE procurement_capital_redeployment_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_capital_redeployment_gate_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_capital_redeployment_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_capital_redeployment_cases (
    id UUID PRIMARY KEY,

    redeployment_number
        VARCHAR(60)
        NOT NULL,

    recycling_source_id
        UUID
        NOT NULL,

    recycling_source_number
        VARCHAR(60)
        NOT NULL,

    reinvestment_proposal_id
        UUID
        NOT NULL,

    source_funding_commitment_id
        UUID
        NOT NULL,

    source_funding_commitment_number
        VARCHAR(60)
        NOT NULL,

    source_value_case_id
        UUID
        NOT NULL,

    source_value_case_number
        VARCHAR(60)
        NOT NULL,

    target_value_case_id
        UUID
        NOT NULL,

    target_value_case_number
        VARCHAR(60)
        NOT NULL,

    target_initiative_number
        VARCHAR(60)
        NOT NULL,

    target_initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    approved_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    source_recyclable_capital_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    source_funding_remaining_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    target_roi_pct_snapshot
        NUMERIC(12, 2)
        NOT NULL,

    target_persistence_pct_snapshot
        NUMERIC(7, 2)
        NOT NULL,

    target_net_value_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    target_value_health_snapshot
        VARCHAR(20)
        NOT NULL,

    redeployment_owner_user_id
        UUID
        NOT NULL,

    redeployment_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    redeployment_objective
        VARCHAR(5000)
        NOT NULL,

    status
        VARCHAR(40)
        NOT NULL,

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

    CONSTRAINT uk_capital_redeployment_number
        UNIQUE (
            redeployment_number
        ),

    CONSTRAINT uk_capital_redeployment_proposal
        UNIQUE (
            reinvestment_proposal_id
        ),

    CONSTRAINT fk_capital_redeployment_recycling_source
        FOREIGN KEY (
            recycling_source_id
        )
        REFERENCES procurement_capital_recycling_sources (id),

    CONSTRAINT fk_capital_redeployment_reinvestment_proposal
        FOREIGN KEY (
            reinvestment_proposal_id
        )
        REFERENCES procurement_capital_reinvestment_proposals (id),

    CONSTRAINT fk_capital_redeployment_source_funding
        FOREIGN KEY (
            source_funding_commitment_id
        )
        REFERENCES procurement_funding_commitments (id),

    CONSTRAINT fk_capital_redeployment_source_value
        FOREIGN KEY (
            source_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_capital_redeployment_target_value
        FOREIGN KEY (
            target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_capital_redeployment_owner
        FOREIGN KEY (
            redeployment_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_redeployment_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_redeployment_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_redeployment_amount
        CHECK (
            approved_redeployment_amount > 0
            AND source_recyclable_capital_snapshot > 0
            AND source_funding_remaining_snapshot > 0
            AND approved_redeployment_amount
                <= source_recyclable_capital_snapshot
            AND approved_redeployment_amount
                <= source_funding_remaining_snapshot
        ),

    CONSTRAINT ck_capital_redeployment_target_health
        CHECK (
            target_value_health_snapshot IN (
                'STRONG',
                'HEALTHY',
                'WATCH'
            )
        ),

    CONSTRAINT ck_capital_redeployment_status
        CHECK (
            status IN (
                'PLANNED',
                'READY_FOR_AUTHORIZATION',
                'AUTHORIZED',
                'ACTIVE',
                'READY_FOR_VERIFICATION',
                'VERIFIED',
                'REMEDIATION_REQUIRED',
                'CLOSED'
            )
        )
);

CREATE TABLE procurement_capital_redeployment_gates (
    id UUID PRIMARY KEY,

    redeployment_case_id
        UUID
        NOT NULL,

    gate_number
        VARCHAR(60)
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

    CONSTRAINT uk_capital_redeployment_gate_number
        UNIQUE (
            gate_number
        ),

    CONSTRAINT fk_capital_redeployment_gate_case
        FOREIGN KEY (
            redeployment_case_id
        )
        REFERENCES procurement_capital_redeployment_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_redeployment_gate_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_redeployment_gate_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_redeployment_gate_status
        CHECK (
            status IN (
                'PENDING',
                'SATISFIED',
                'WAIVED'
            )
        )
);

CREATE TABLE procurement_capital_redeployment_authorizations (
    id UUID PRIMARY KEY,

    redeployment_case_id
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

    CONSTRAINT fk_capital_redeployment_authorization_case
        FOREIGN KEY (
            redeployment_case_id
        )
        REFERENCES procurement_capital_redeployment_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_redeployment_authorization_user
        FOREIGN KEY (
            authorized_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_redeployment_authorization_decision
        CHECK (
            decision IN (
                'APPROVED',
                'REJECTED'
            )
        ),

    CONSTRAINT ck_capital_redeployment_authorization_amount
        CHECK (
            authorized_amount > 0
        )
);

CREATE TABLE procurement_capital_redeployment_releases (
    id UUID PRIMARY KEY,

    redeployment_case_id
        UUID
        NOT NULL,

    authorization_id
        UUID
        NOT NULL,

    released_on
        DATE
        NOT NULL,

    released_amount
        NUMERIC(20, 2)
        NOT NULL,

    evidence_note
        VARCHAR(5000)
        NOT NULL,

    reference_text
        VARCHAR(1000)
        NOT NULL,

    released_by_user_id
        UUID
        NOT NULL,

    released_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_redeployment_release_case
        FOREIGN KEY (
            redeployment_case_id
        )
        REFERENCES procurement_capital_redeployment_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_redeployment_release_authorization
        FOREIGN KEY (
            authorization_id
        )
        REFERENCES procurement_capital_redeployment_authorizations (id),

    CONSTRAINT fk_capital_redeployment_release_user
        FOREIGN KEY (
            released_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_redeployment_release_amount
        CHECK (
            released_amount > 0
        )
);

CREATE TABLE procurement_capital_redeployment_verifications (
    id UUID PRIMARY KEY,

    redeployment_case_id
        UUID
        NOT NULL,

    decision
        VARCHAR(30)
        NOT NULL,

    approved_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    released_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    redeployment_pct
        NUMERIC(7, 2)
        NOT NULL,

    redeployment_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    verification_note
        VARCHAR(5000)
        NOT NULL,

    verified_by_user_id
        UUID
        NOT NULL,

    verified_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_redeployment_verification_case
        FOREIGN KEY (
            redeployment_case_id
        )
        REFERENCES procurement_capital_redeployment_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_redeployment_verification_user
        FOREIGN KEY (
            verified_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_redeployment_verification_decision
        CHECK (
            decision IN (
                'VERIFIED',
                'REMEDIATION_REQUIRED'
            )
        ),

    CONSTRAINT ck_capital_redeployment_verification_pct
        CHECK (
            redeployment_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_capital_redeployment_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(60)
        NOT NULL,

    case_count
        INTEGER
        NOT NULL,

    planned_case_count
        INTEGER
        NOT NULL,

    authorization_pending_case_count
        INTEGER
        NOT NULL,

    active_case_count
        INTEGER
        NOT NULL,

    ready_case_count
        INTEGER
        NOT NULL,

    verified_case_count
        INTEGER
        NOT NULL,

    remediation_case_count
        INTEGER
        NOT NULL,

    total_approved_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_released_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_remaining_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    average_redeployment_pct
        NUMERIC(7, 2)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_capital_redeployment_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_capital_redeployment_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_redeployment_snapshot_pct
        CHECK (
            average_redeployment_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_capital_redeployment_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    redeployment_case_id
        UUID
        NOT NULL,

    redeployment_number
        VARCHAR(60)
        NOT NULL,

    recycling_source_number
        VARCHAR(60)
        NOT NULL,

    target_value_case_number
        VARCHAR(60)
        NOT NULL,

    target_initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    case_status
        VARCHAR(40)
        NOT NULL,

    approved_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    released_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_redeployment_amount
        NUMERIC(20, 2)
        NOT NULL,

    redeployment_pct
        NUMERIC(7, 2)
        NOT NULL,

    redeployment_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    redeployment_health
        VARCHAR(30)
        NOT NULL,

    current_source_funding_remaining_amount
        NUMERIC(20, 2)
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

    release_count
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_redeployment_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_capital_redeployment_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_capital_redeployment_snapshot_item_health
        CHECK (
            redeployment_health IN (
                'NOT_STARTED',
                'IN_PROGRESS',
                'COMPLETE',
                'VARIANCE',
                'REMEDIATION_REQUIRED'
            )
        )
);

CREATE INDEX idx_capital_redeployment_case_status
    ON procurement_capital_redeployment_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_capital_redeployment_gate_case
    ON procurement_capital_redeployment_gates (
        redeployment_case_id,
        status
    );

CREATE INDEX idx_capital_redeployment_authorization_case
    ON procurement_capital_redeployment_authorizations (
        redeployment_case_id,
        authorized_at DESC
    );

CREATE INDEX idx_capital_redeployment_release_case
    ON procurement_capital_redeployment_releases (
        redeployment_case_id,
        released_on,
        released_at
    );

CREATE INDEX idx_capital_redeployment_verification_case
    ON procurement_capital_redeployment_verifications (
        redeployment_case_id,
        verified_at DESC
    );

CREATE INDEX idx_capital_redeployment_snapshot_capture
    ON procurement_capital_redeployment_snapshots (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_capital_redeployment_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement capital redeployment evidence is immutable';
END;
$$;

CREATE TRIGGER trg_capital_redeployment_authorization_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_redeployment_authorizations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_redeployment_evidence_mutation();

CREATE TRIGGER trg_capital_redeployment_release_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_redeployment_releases
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_redeployment_evidence_mutation();

CREATE TRIGGER trg_capital_redeployment_verification_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_redeployment_verifications
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_redeployment_evidence_mutation();

CREATE TRIGGER trg_capital_redeployment_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_redeployment_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_redeployment_evidence_mutation();

CREATE TRIGGER trg_capital_redeployment_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_redeployment_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_redeployment_evidence_mutation();

CREATE TRIGGER trg_audit_capital_redeployment_cases
AFTER INSERT OR UPDATE
ON procurement_capital_redeployment_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_redeployment_gates
AFTER INSERT OR UPDATE
ON procurement_capital_redeployment_gates
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_redeployment_authorizations
AFTER INSERT
ON procurement_capital_redeployment_authorizations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_redeployment_releases
AFTER INSERT
ON procurement_capital_redeployment_releases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_redeployment_verifications
AFTER INSERT
ON procurement_capital_redeployment_verifications
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_redeployment_snapshots
AFTER INSERT
ON procurement_capital_redeployment_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
