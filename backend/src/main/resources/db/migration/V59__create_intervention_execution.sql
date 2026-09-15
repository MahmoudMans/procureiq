CREATE SEQUENCE procurement_intervention_execution_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_intervention_execution_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_intervention_execution_cases (
    id UUID PRIMARY KEY,

    execution_number
        VARCHAR(60)
        NOT NULL,

    intervention_case_id
        UUID
        NOT NULL,

    intervention_number
        VARCHAR(60)
        NOT NULL,

    performance_case_id
        UUID
        NOT NULL,

    performance_case_number
        VARCHAR(60)
        NOT NULL,

    funding_commitment_id
        UUID
        NOT NULL,

    funding_commitment_number
        VARCHAR(60)
        NOT NULL,

    source_value_case_id
        UUID
        NOT NULL,

    source_value_case_number
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

    approved_action
        VARCHAR(40)
        NOT NULL,

    approved_affected_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    approved_target_value_case_id
        UUID,

    approved_target_value_case_number
        VARCHAR(60),

    approved_target_initiative_title
        VARCHAR(300),

    source_released_capital_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    source_remaining_commitment_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    execution_owner_user_id
        UUID
        NOT NULL,

    execution_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    execution_objective
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

    CONSTRAINT uk_intervention_execution_number
        UNIQUE (
            execution_number
        ),

    CONSTRAINT fk_intervention_execution_intervention
        FOREIGN KEY (
            intervention_case_id
        )
        REFERENCES procurement_investment_intervention_cases (id),

    CONSTRAINT fk_intervention_execution_performance
        FOREIGN KEY (
            performance_case_id
        )
        REFERENCES procurement_investment_performance_cases (id),

    CONSTRAINT fk_intervention_execution_funding
        FOREIGN KEY (
            funding_commitment_id
        )
        REFERENCES procurement_funding_commitments (id),

    CONSTRAINT fk_intervention_execution_source_value
        FOREIGN KEY (
            source_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_intervention_execution_target_value
        FOREIGN KEY (
            approved_target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_intervention_execution_owner
        FOREIGN KEY (
            execution_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_intervention_execution_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_intervention_execution_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_intervention_execution_action
        CHECK (
            approved_action IN (
                'CONTINUE',
                'HOLD_FUTURE_RELEASES',
                'REDUCE_UNRELEASED',
                'REALLOCATE_UNRELEASED'
            )
        ),

    CONSTRAINT ck_intervention_execution_source_capital
        CHECK (
            source_released_capital_snapshot >= 0
            AND
            source_remaining_commitment_snapshot >= 0
            AND
            approved_affected_capital_amount >= 0
            AND
            approved_affected_capital_amount
                <= source_remaining_commitment_snapshot
        ),

    CONSTRAINT ck_intervention_execution_action_shape
        CHECK (
            (
                approved_action = 'CONTINUE'
                AND approved_affected_capital_amount = 0
                AND approved_target_value_case_id IS NULL
                AND approved_target_value_case_number IS NULL
                AND approved_target_initiative_title IS NULL
            )
            OR
            (
                approved_action IN (
                    'HOLD_FUTURE_RELEASES',
                    'REDUCE_UNRELEASED'
                )
                AND approved_affected_capital_amount > 0
                AND approved_target_value_case_id IS NULL
                AND approved_target_value_case_number IS NULL
                AND approved_target_initiative_title IS NULL
            )
            OR
            (
                approved_action = 'REALLOCATE_UNRELEASED'
                AND approved_affected_capital_amount > 0
                AND approved_target_value_case_id IS NOT NULL
                AND approved_target_value_case_number IS NOT NULL
                AND approved_target_initiative_title IS NOT NULL
            )
        ),

    CONSTRAINT ck_intervention_execution_status
        CHECK (
            status IN (
                'PLANNED',
                'ACTIVE',
                'READY_FOR_VERIFICATION',
                'VERIFIED',
                'REMEDIATION_REQUIRED',
                'CLOSED'
            )
        )
);

CREATE UNIQUE INDEX uk_intervention_execution_active_intervention
    ON procurement_intervention_execution_cases (
        intervention_case_id
    )
    WHERE status <> 'CLOSED';

CREATE TABLE procurement_intervention_execution_acknowledgements (
    id UUID PRIMARY KEY,

    execution_case_id
        UUID
        NOT NULL,

    acknowledgement_note
        VARCHAR(5000)
        NOT NULL,

    acknowledged_by_user_id
        UUID
        NOT NULL,

    acknowledged_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_intervention_execution_ack_case
        UNIQUE (
            execution_case_id
        ),

    CONSTRAINT fk_intervention_execution_ack_case
        FOREIGN KEY (
            execution_case_id
        )
        REFERENCES procurement_intervention_execution_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_intervention_execution_ack_user
        FOREIGN KEY (
            acknowledged_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE TABLE procurement_intervention_execution_evidence (
    id UUID PRIMARY KEY,

    execution_case_id
        UUID
        NOT NULL,

    implemented_on
        DATE
        NOT NULL,

    implemented_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    evidence_note
        VARCHAR(5000)
        NOT NULL,

    reference_text
        VARCHAR(1000)
        NOT NULL,

    recorded_by_user_id
        UUID
        NOT NULL,

    recorded_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_intervention_execution_evidence_case
        FOREIGN KEY (
            execution_case_id
        )
        REFERENCES procurement_intervention_execution_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_intervention_execution_evidence_user
        FOREIGN KEY (
            recorded_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_intervention_execution_evidence_amount
        CHECK (
            implemented_capital_amount >= 0
        )
);

CREATE TABLE procurement_intervention_execution_verifications (
    id UUID PRIMARY KEY,

    execution_case_id
        UUID
        NOT NULL,

    decision
        VARCHAR(30)
        NOT NULL,

    approved_action
        VARCHAR(40)
        NOT NULL,

    approved_affected_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    implemented_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_implementation_amount
        NUMERIC(20, 2)
        NOT NULL,

    implementation_pct
        NUMERIC(7, 2)
        NOT NULL,

    implementation_variance_amount
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

    CONSTRAINT fk_intervention_execution_verification_case
        FOREIGN KEY (
            execution_case_id
        )
        REFERENCES procurement_intervention_execution_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_intervention_execution_verification_user
        FOREIGN KEY (
            verified_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_intervention_execution_verification_decision
        CHECK (
            decision IN (
                'VERIFIED',
                'REMEDIATION_REQUIRED'
            )
        ),

    CONSTRAINT ck_intervention_execution_verification_pct
        CHECK (
            implementation_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_intervention_execution_snapshots (
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

    total_approved_affected_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_implemented_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_remaining_implementation_amount
        NUMERIC(20, 2)
        NOT NULL,

    average_implementation_pct
        NUMERIC(7, 2)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_intervention_execution_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_intervention_execution_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_intervention_execution_snapshot_pct
        CHECK (
            average_implementation_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_intervention_execution_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    execution_case_id
        UUID
        NOT NULL,

    execution_number
        VARCHAR(60)
        NOT NULL,

    intervention_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    case_status
        VARCHAR(40)
        NOT NULL,

    approved_action
        VARCHAR(40)
        NOT NULL,

    approved_affected_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    implemented_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    remaining_implementation_amount
        NUMERIC(20, 2)
        NOT NULL,

    implementation_pct
        NUMERIC(7, 2)
        NOT NULL,

    implementation_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    execution_health
        VARCHAR(30)
        NOT NULL,

    current_released_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_remaining_commitment_amount
        NUMERIC(20, 2)
        NOT NULL,

    approved_target_value_case_number
        VARCHAR(60),

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_intervention_execution_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_intervention_execution_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_intervention_execution_snapshot_item_health
        CHECK (
            execution_health IN (
                'NOT_STARTED',
                'IN_PROGRESS',
                'COMPLETE',
                'VARIANCE',
                'REMEDIATION_REQUIRED'
            )
        )
);

CREATE INDEX idx_intervention_execution_case_status
    ON procurement_intervention_execution_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_intervention_execution_evidence_case
    ON procurement_intervention_execution_evidence (
        execution_case_id,
        implemented_on,
        recorded_at
    );

CREATE INDEX idx_intervention_execution_verification_case
    ON procurement_intervention_execution_verifications (
        execution_case_id,
        verified_at DESC
    );

CREATE INDEX idx_intervention_execution_snapshot_capture
    ON procurement_intervention_execution_snapshots (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_intervention_execution_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement intervention execution evidence is immutable';
END;
$$;

CREATE TRIGGER trg_intervention_execution_ack_immutable
BEFORE UPDATE OR DELETE
ON procurement_intervention_execution_acknowledgements
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_intervention_execution_evidence_mutation();

CREATE TRIGGER trg_intervention_execution_evidence_immutable
BEFORE UPDATE OR DELETE
ON procurement_intervention_execution_evidence
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_intervention_execution_evidence_mutation();

CREATE TRIGGER trg_intervention_execution_verification_immutable
BEFORE UPDATE OR DELETE
ON procurement_intervention_execution_verifications
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_intervention_execution_evidence_mutation();

CREATE TRIGGER trg_intervention_execution_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_intervention_execution_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_intervention_execution_evidence_mutation();

CREATE TRIGGER trg_intervention_execution_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_intervention_execution_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_intervention_execution_evidence_mutation();

CREATE TRIGGER trg_audit_intervention_execution_cases
AFTER INSERT OR UPDATE
ON procurement_intervention_execution_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_intervention_execution_ack
AFTER INSERT
ON procurement_intervention_execution_acknowledgements
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_intervention_execution_evidence
AFTER INSERT
ON procurement_intervention_execution_evidence
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_intervention_execution_verification
AFTER INSERT
ON procurement_intervention_execution_verifications
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_intervention_execution_snapshots
AFTER INSERT
ON procurement_intervention_execution_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
