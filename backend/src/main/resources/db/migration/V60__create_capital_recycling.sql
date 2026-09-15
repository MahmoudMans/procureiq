CREATE SEQUENCE procurement_capital_recycling_source_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_capital_recycling_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_capital_recycling_sources (
    id UUID PRIMARY KEY,

    source_number
        VARCHAR(60)
        NOT NULL,

    execution_case_id
        UUID
        NOT NULL,

    execution_number
        VARCHAR(60)
        NOT NULL,

    intervention_case_id
        UUID
        NOT NULL,

    intervention_number
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

    source_initiative_number
        VARCHAR(60)
        NOT NULL,

    source_initiative_title
        VARCHAR(300)
        NOT NULL,

    source_action
        VARCHAR(40)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    verified_implemented_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    recyclable_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    funding_remaining_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    preferred_target_value_case_id
        UUID,

    preferred_target_value_case_number
        VARCHAR(60),

    preferred_target_initiative_title
        VARCHAR(300),

    source_owner_user_id
        UUID
        NOT NULL,

    source_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    recycling_objective
        VARCHAR(5000)
        NOT NULL,

    status
        VARCHAR(30)
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

    CONSTRAINT uk_capital_recycling_source_number
        UNIQUE (
            source_number
        ),

    CONSTRAINT uk_capital_recycling_execution_case
        UNIQUE (
            execution_case_id
        ),

    CONSTRAINT fk_capital_recycling_execution_case
        FOREIGN KEY (
            execution_case_id
        )
        REFERENCES procurement_intervention_execution_cases (id),

    CONSTRAINT fk_capital_recycling_intervention_case
        FOREIGN KEY (
            intervention_case_id
        )
        REFERENCES procurement_investment_intervention_cases (id),

    CONSTRAINT fk_capital_recycling_funding_commitment
        FOREIGN KEY (
            funding_commitment_id
        )
        REFERENCES procurement_funding_commitments (id),

    CONSTRAINT fk_capital_recycling_source_value_case
        FOREIGN KEY (
            source_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_capital_recycling_preferred_target
        FOREIGN KEY (
            preferred_target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_capital_recycling_owner
        FOREIGN KEY (
            source_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_recycling_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_capital_recycling_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_recycling_action
        CHECK (
            source_action IN (
                'REDUCE_UNRELEASED',
                'REALLOCATE_UNRELEASED'
            )
        ),

    CONSTRAINT ck_capital_recycling_amounts
        CHECK (
            verified_implemented_capital_amount > 0
            AND
            recyclable_capital_amount > 0
            AND
            funding_remaining_snapshot > 0
            AND
            recyclable_capital_amount
                <= verified_implemented_capital_amount
            AND
            recyclable_capital_amount
                <= funding_remaining_snapshot
        ),

    CONSTRAINT ck_capital_recycling_status
        CHECK (
            status IN (
                'OPEN',
                'FULLY_ALLOCATED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_capital_recycling_preferred_target_shape
        CHECK (
            (
                source_action = 'REDUCE_UNRELEASED'
                AND
                preferred_target_value_case_id IS NULL
                AND
                preferred_target_value_case_number IS NULL
                AND
                preferred_target_initiative_title IS NULL
            )
            OR
            (
                source_action = 'REALLOCATE_UNRELEASED'
                AND
                preferred_target_value_case_id IS NOT NULL
                AND
                preferred_target_value_case_number IS NOT NULL
                AND
                preferred_target_initiative_title IS NOT NULL
            )
        )
);

CREATE TABLE procurement_capital_reinvestment_proposals (
    id UUID PRIMARY KEY,

    recycling_source_id
        UUID
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

    source_available_capital_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    requested_reinvestment_amount
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

    proposal_rationale
        VARCHAR(5000)
        NOT NULL,

    proposed_by_user_id
        UUID
        NOT NULL,

    proposed_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_reinvestment_proposal_source
        FOREIGN KEY (
            recycling_source_id
        )
        REFERENCES procurement_capital_recycling_sources (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_reinvestment_proposal_target
        FOREIGN KEY (
            target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_capital_reinvestment_proposal_user
        FOREIGN KEY (
            proposed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_reinvestment_proposal_amount
        CHECK (
            source_available_capital_snapshot > 0
            AND
            requested_reinvestment_amount > 0
            AND
            requested_reinvestment_amount
                <= source_available_capital_snapshot
        ),

    CONSTRAINT ck_capital_reinvestment_target_health
        CHECK (
            target_value_health_snapshot IN (
                'STRONG',
                'HEALTHY',
                'WATCH'
            )
        )
);

CREATE TABLE procurement_capital_reinvestment_decisions (
    id UUID PRIMARY KEY,

    recycling_source_id
        UUID
        NOT NULL,

    proposal_id
        UUID
        NOT NULL,

    decision
        VARCHAR(20)
        NOT NULL,

    decision_note
        VARCHAR(5000)
        NOT NULL,

    decided_by_user_id
        UUID
        NOT NULL,

    decided_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_capital_reinvestment_decision_proposal
        UNIQUE (
            proposal_id
        ),

    CONSTRAINT fk_capital_reinvestment_decision_source
        FOREIGN KEY (
            recycling_source_id
        )
        REFERENCES procurement_capital_recycling_sources (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_capital_reinvestment_decision_proposal
        FOREIGN KEY (
            proposal_id
        )
        REFERENCES procurement_capital_reinvestment_proposals (id),

    CONSTRAINT fk_capital_reinvestment_decision_user
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_reinvestment_decision
        CHECK (
            decision IN (
                'APPROVED',
                'REJECTED'
            )
        )
);

CREATE TABLE procurement_capital_recycling_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(60)
        NOT NULL,

    source_count
        INTEGER
        NOT NULL,

    open_source_count
        INTEGER
        NOT NULL,

    fully_allocated_source_count
        INTEGER
        NOT NULL,

    total_recyclable_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_approved_reinvestment_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_available_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    average_utilization_pct
        NUMERIC(7, 2)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_capital_recycling_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_capital_recycling_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_capital_recycling_snapshot_utilization
        CHECK (
            average_utilization_pct
                BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_capital_recycling_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    recycling_source_id
        UUID
        NOT NULL,

    source_number
        VARCHAR(60)
        NOT NULL,

    execution_number
        VARCHAR(60)
        NOT NULL,

    source_initiative_title
        VARCHAR(300)
        NOT NULL,

    source_action
        VARCHAR(40)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    source_status
        VARCHAR(30)
        NOT NULL,

    recyclable_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    approved_reinvestment_amount
        NUMERIC(20, 2)
        NOT NULL,

    pending_reinvestment_amount
        NUMERIC(20, 2)
        NOT NULL,

    available_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    utilization_pct
        NUMERIC(7, 2)
        NOT NULL,

    current_funding_remaining_amount
        NUMERIC(20, 2)
        NOT NULL,

    preferred_target_value_case_number
        VARCHAR(60),

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_capital_recycling_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_capital_recycling_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_capital_recycling_snapshot_item_utilization
        CHECK (
            utilization_pct
                BETWEEN 0 AND 100
        )
);

CREATE INDEX idx_capital_recycling_source_status
    ON procurement_capital_recycling_sources (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_capital_reinvestment_proposal_source
    ON procurement_capital_reinvestment_proposals (
        recycling_source_id,
        proposed_at DESC
    );

CREATE INDEX idx_capital_reinvestment_decision_source
    ON procurement_capital_reinvestment_decisions (
        recycling_source_id,
        decided_at DESC
    );

CREATE INDEX idx_capital_recycling_snapshot_capture
    ON procurement_capital_recycling_snapshots (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_capital_recycling_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement capital recycling evidence is immutable';
END;
$$;

CREATE TRIGGER trg_capital_reinvestment_proposal_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_reinvestment_proposals
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_recycling_evidence_mutation();

CREATE TRIGGER trg_capital_reinvestment_decision_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_reinvestment_decisions
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_recycling_evidence_mutation();

CREATE TRIGGER trg_capital_recycling_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_recycling_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_recycling_evidence_mutation();

CREATE TRIGGER trg_capital_recycling_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_capital_recycling_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_capital_recycling_evidence_mutation();

CREATE TRIGGER trg_audit_capital_recycling_sources
AFTER INSERT OR UPDATE
ON procurement_capital_recycling_sources
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_reinvestment_proposals
AFTER INSERT
ON procurement_capital_reinvestment_proposals
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_reinvestment_decisions
AFTER INSERT
ON procurement_capital_reinvestment_decisions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_capital_recycling_snapshots
AFTER INSERT
ON procurement_capital_recycling_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
