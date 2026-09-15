CREATE SEQUENCE procurement_investment_intervention_case_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_investment_intervention_snapshot_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_investment_intervention_cases (
    id UUID PRIMARY KEY,

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

    value_case_id
        UUID
        NOT NULL,

    value_case_number
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

    intervention_owner_user_id
        UUID
        NOT NULL,

    intervention_owner_name_snapshot
        VARCHAR(300)
        NOT NULL,

    source_performance_status
        VARCHAR(30)
        NOT NULL,

    source_performance_health
        VARCHAR(30)
        NOT NULL,

    source_released_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    source_remaining_commitment_amount
        NUMERIC(20, 2)
        NOT NULL,

    source_baseline_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    source_realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    source_roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    source_capital_efficiency_multiple
        NUMERIC(12, 4)
        NOT NULL,

    source_value_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    recommended_action
        VARCHAR(40)
        NOT NULL,

    recommended_affected_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    intervention_rationale
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

    CONSTRAINT uk_investment_intervention_number
        UNIQUE (
            intervention_number
        ),

    CONSTRAINT fk_investment_intervention_performance
        FOREIGN KEY (
            performance_case_id
        )
        REFERENCES procurement_investment_performance_cases (id),

    CONSTRAINT fk_investment_intervention_funding
        FOREIGN KEY (
            funding_commitment_id
        )
        REFERENCES procurement_funding_commitments (id),

    CONSTRAINT fk_investment_intervention_value_case
        FOREIGN KEY (
            value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_investment_intervention_owner
        FOREIGN KEY (
            intervention_owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_investment_intervention_closer
        FOREIGN KEY (
            closed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_investment_intervention_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investment_intervention_capital
        CHECK (
            source_released_capital_amount >= 0
            AND
            source_remaining_commitment_amount > 0
            AND
            recommended_affected_capital_amount >= 0
            AND
            recommended_affected_capital_amount
                <= source_remaining_commitment_amount
        ),

    CONSTRAINT ck_investment_intervention_action
        CHECK (
            recommended_action IN (
                'CONTINUE',
                'HOLD_FUTURE_RELEASES',
                'REDUCE_UNRELEASED',
                'REALLOCATE_UNRELEASED'
            )
        ),

    CONSTRAINT ck_investment_intervention_status
        CHECK (
            status IN (
                'OPEN',
                'IN_REVIEW',
                'APPROVED',
                'CLOSED'
            )
        )
);

CREATE UNIQUE INDEX uk_investment_intervention_active_performance
    ON procurement_investment_intervention_cases (
        performance_case_id
    )
    WHERE status <> 'CLOSED';

CREATE TABLE procurement_investment_intervention_proposals (
    id UUID PRIMARY KEY,

    intervention_case_id
        UUID
        NOT NULL,

    action_type
        VARCHAR(40)
        NOT NULL,

    source_remaining_capital_snapshot
        NUMERIC(20, 2)
        NOT NULL,

    affected_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    target_value_case_id
        UUID,

    target_value_case_number
        VARCHAR(60),

    target_initiative_title
        VARCHAR(300),

    proposal_rationale
        VARCHAR(5000)
        NOT NULL,

    proposed_by_user_id
        UUID
        NOT NULL,

    proposed_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_investment_intervention_proposal_case
        FOREIGN KEY (
            intervention_case_id
        )
        REFERENCES procurement_investment_intervention_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_investment_intervention_proposal_target
        FOREIGN KEY (
            target_value_case_id
        )
        REFERENCES procurement_strategic_value_cases (id),

    CONSTRAINT fk_investment_intervention_proposal_user
        FOREIGN KEY (
            proposed_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investment_intervention_proposal_action
        CHECK (
            action_type IN (
                'CONTINUE',
                'HOLD_FUTURE_RELEASES',
                'REDUCE_UNRELEASED',
                'REALLOCATE_UNRELEASED'
            )
        ),

    CONSTRAINT ck_investment_intervention_proposal_amount
        CHECK (
            source_remaining_capital_snapshot > 0
            AND
            affected_capital_amount >= 0
            AND
            affected_capital_amount
                <= source_remaining_capital_snapshot
        ),

    CONSTRAINT ck_investment_intervention_proposal_shape
        CHECK (
            (
                action_type = 'CONTINUE'
                AND affected_capital_amount = 0
                AND target_value_case_id IS NULL
                AND target_value_case_number IS NULL
                AND target_initiative_title IS NULL
            )
            OR
            (
                action_type IN (
                    'HOLD_FUTURE_RELEASES',
                    'REDUCE_UNRELEASED'
                )
                AND affected_capital_amount > 0
                AND target_value_case_id IS NULL
                AND target_value_case_number IS NULL
                AND target_initiative_title IS NULL
            )
            OR
            (
                action_type = 'REALLOCATE_UNRELEASED'
                AND affected_capital_amount > 0
                AND target_value_case_id IS NOT NULL
                AND target_value_case_number IS NOT NULL
                AND target_initiative_title IS NOT NULL
            )
        )
);

CREATE TABLE procurement_investment_intervention_decisions (
    id UUID PRIMARY KEY,

    intervention_case_id
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

    CONSTRAINT uk_investment_intervention_decision_proposal
        UNIQUE (
            proposal_id
        ),

    CONSTRAINT fk_investment_intervention_decision_case
        FOREIGN KEY (
            intervention_case_id
        )
        REFERENCES procurement_investment_intervention_cases (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_investment_intervention_decision_proposal
        FOREIGN KEY (
            proposal_id
        )
        REFERENCES procurement_investment_intervention_proposals (id),

    CONSTRAINT fk_investment_intervention_decision_user
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_investment_intervention_decision
        CHECK (
            decision IN (
                'APPROVED',
                'REJECTED'
            )
        )
);

CREATE TABLE procurement_investment_intervention_snapshots (
    id UUID PRIMARY KEY,

    snapshot_number
        VARCHAR(60)
        NOT NULL,

    case_count
        INTEGER
        NOT NULL,

    open_case_count
        INTEGER
        NOT NULL,

    in_review_case_count
        INTEGER
        NOT NULL,

    approved_case_count
        INTEGER
        NOT NULL,

    underperforming_case_count
        INTEGER
        NOT NULL,

    total_remaining_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_approved_affected_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    total_approved_reallocation_amount
        NUMERIC(20, 2)
        NOT NULL,

    captured_by_user_id
        UUID
        NOT NULL,

    captured_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_investment_intervention_snapshot_number
        UNIQUE (
            snapshot_number
        ),

    CONSTRAINT fk_investment_intervention_snapshot_user
        FOREIGN KEY (
            captured_by_user_id
        )
        REFERENCES app_users (id)
);

CREATE TABLE procurement_investment_intervention_snapshot_items (
    id UUID PRIMARY KEY,

    snapshot_id
        UUID
        NOT NULL,

    intervention_case_id
        UUID
        NOT NULL,

    intervention_number
        VARCHAR(60)
        NOT NULL,

    performance_case_number
        VARCHAR(60)
        NOT NULL,

    funding_commitment_number
        VARCHAR(60)
        NOT NULL,

    value_case_number
        VARCHAR(60)
        NOT NULL,

    initiative_title
        VARCHAR(300)
        NOT NULL,

    currency
        VARCHAR(3)
        NOT NULL,

    case_status
        VARCHAR(30)
        NOT NULL,

    current_performance_health
        VARCHAR(30)
        NOT NULL,

    current_released_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_remaining_commitment_amount
        NUMERIC(20, 2)
        NOT NULL,

    current_realized_roi_pct
        NUMERIC(12, 2)
        NOT NULL,

    current_roi_variance_pct
        NUMERIC(12, 2)
        NOT NULL,

    current_capital_efficiency_multiple
        NUMERIC(12, 4)
        NOT NULL,

    current_value_variance_amount
        NUMERIC(20, 2)
        NOT NULL,

    recommended_action
        VARCHAR(40)
        NOT NULL,

    approved_action
        VARCHAR(40),

    approved_affected_capital_amount
        NUMERIC(20, 2)
        NOT NULL,

    approved_target_value_case_number
        VARCHAR(60),

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_investment_intervention_snapshot_item_snapshot
        FOREIGN KEY (
            snapshot_id
        )
        REFERENCES procurement_investment_intervention_snapshots (id)
        ON DELETE CASCADE,

    CONSTRAINT ck_investment_intervention_snapshot_item_health
        CHECK (
            current_performance_health IN (
                'UNASSESSED',
                'OUTPERFORMING',
                'ON_TRACK',
                'WATCH',
                'UNDERPERFORMING'
            )
        )
);

CREATE INDEX idx_investment_intervention_case_status
    ON procurement_investment_intervention_cases (
        status,
        fiscal_year,
        currency
    );

CREATE INDEX idx_investment_intervention_proposal_case
    ON procurement_investment_intervention_proposals (
        intervention_case_id,
        proposed_at DESC
    );

CREATE INDEX idx_investment_intervention_decision_case
    ON procurement_investment_intervention_decisions (
        intervention_case_id,
        decided_at DESC
    );

CREATE INDEX idx_investment_intervention_snapshot_capture
    ON procurement_investment_intervention_snapshots (
        captured_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_investment_intervention_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement investment intervention evidence is immutable';
END;
$$;

CREATE TRIGGER trg_investment_intervention_proposal_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_intervention_proposals
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_intervention_evidence_mutation();

CREATE TRIGGER trg_investment_intervention_decision_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_intervention_decisions
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_intervention_evidence_mutation();

CREATE TRIGGER trg_investment_intervention_snapshot_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_intervention_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_intervention_evidence_mutation();

CREATE TRIGGER trg_investment_intervention_snapshot_item_immutable
BEFORE UPDATE OR DELETE
ON procurement_investment_intervention_snapshot_items
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_investment_intervention_evidence_mutation();

CREATE TRIGGER trg_audit_investment_intervention_cases
AFTER INSERT OR UPDATE
ON procurement_investment_intervention_cases
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_investment_intervention_proposals
AFTER INSERT
ON procurement_investment_intervention_proposals
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_investment_intervention_decisions
AFTER INSERT
ON procurement_investment_intervention_decisions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_investment_intervention_snapshots
AFTER INSERT
ON procurement_investment_intervention_snapshots
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
