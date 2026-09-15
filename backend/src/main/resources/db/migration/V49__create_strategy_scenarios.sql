CREATE SEQUENCE procurement_strategy_scenario_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE SEQUENCE procurement_strategy_scenario_evaluation_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE procurement_strategy_scenarios (
    id UUID PRIMARY KEY,

    scenario_number
        VARCHAR(60)
        NOT NULL,

    name
        VARCHAR(300)
        NOT NULL,

    description
        VARCHAR(4000),

    currency
        VARCHAR(3)
        NOT NULL,

    fiscal_year
        INTEGER
        NOT NULL,

    status
        VARCHAR(20)
        NOT NULL,

    baseline_objective_execution_score
        NUMERIC(7, 2)
        NOT NULL,

    baseline_strategic_alignment_score
        NUMERIC(7, 2)
        NOT NULL,

    baseline_capacity_score
        NUMERIC(7, 2)
        NOT NULL,

    baseline_capability_score
        NUMERIC(7, 2)
        NOT NULL,

    baseline_succession_score
        NUMERIC(7, 2)
        NOT NULL,

    baseline_overall_score
        NUMERIC(7, 2)
        NOT NULL,

    baseline_health
        VARCHAR(20)
        NOT NULL,

    baseline_captured_at
        TIMESTAMPTZ
        NOT NULL,

    approval_note
        VARCHAR(4000),

    approved_by_user_id
        UUID,

    approved_at
        TIMESTAMPTZ,

    archive_note
        VARCHAR(4000),

    archived_by_user_id
        UUID,

    archived_at
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

    CONSTRAINT uk_strategy_scenario_number
        UNIQUE (
            scenario_number
        ),

    CONSTRAINT fk_strategy_scenario_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_scenario_approver
        FOREIGN KEY (
            approved_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_scenario_archiver
        FOREIGN KEY (
            archived_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_scenario_status
        CHECK (
            status IN (
                'DRAFT',
                'EVALUATED',
                'APPROVED',
                'ARCHIVED'
            )
        ),

    CONSTRAINT ck_strategy_scenario_health
        CHECK (
            baseline_health IN (
                'EXCELLENT',
                'STRONG',
                'WATCH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_strategy_scenario_year
        CHECK (
            fiscal_year BETWEEN 2000 AND 2200
        ),

    CONSTRAINT ck_strategy_scenario_baseline_scores
        CHECK (
            baseline_objective_execution_score BETWEEN 0 AND 100
            AND baseline_strategic_alignment_score BETWEEN 0 AND 100
            AND baseline_capacity_score BETWEEN 0 AND 100
            AND baseline_capability_score BETWEEN 0 AND 100
            AND baseline_succession_score BETWEEN 0 AND 100
            AND baseline_overall_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_scenario_assumptions (
    id UUID PRIMARY KEY,

    scenario_id
        UUID
        NOT NULL,

    dimension_key
        VARCHAR(50)
        NOT NULL,

    adjustment_points
        NUMERIC(9, 2)
        NOT NULL,

    rationale
        VARCHAR(3000)
        NOT NULL,

    created_by_user_id
        UUID
        NOT NULL,

    updated_by_user_id
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

    CONSTRAINT fk_strategy_scenario_assumption_scenario
        FOREIGN KEY (
            scenario_id
        )
        REFERENCES procurement_strategy_scenarios (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_strategy_scenario_assumption_creator
        FOREIGN KEY (
            created_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_strategy_scenario_assumption_updater
        FOREIGN KEY (
            updated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_strategy_scenario_assumption
        UNIQUE (
            scenario_id,
            dimension_key
        ),

    CONSTRAINT ck_strategy_scenario_dimension
        CHECK (
            dimension_key IN (
                'OBJECTIVE_EXECUTION',
                'STRATEGIC_ALIGNMENT',
                'CAPACITY_READINESS',
                'CAPABILITY_READINESS',
                'SUCCESSION_RESILIENCE'
            )
        ),

    CONSTRAINT ck_strategy_scenario_adjustment
        CHECK (
            adjustment_points
                BETWEEN -100 AND 100
        )
);

CREATE TABLE procurement_strategy_scenario_evaluations (
    id UUID PRIMARY KEY,

    evaluation_number
        VARCHAR(60)
        NOT NULL,

    scenario_id
        UUID
        NOT NULL,

    baseline_overall_score
        NUMERIC(7, 2)
        NOT NULL,

    simulated_overall_score
        NUMERIC(7, 2)
        NOT NULL,

    simulated_health
        VARCHAR(20)
        NOT NULL,

    score_delta
        NUMERIC(9, 2)
        NOT NULL,

    movement
        VARCHAR(20)
        NOT NULL,

    assumption_count
        INTEGER
        NOT NULL,

    improved_dimension_count
        INTEGER
        NOT NULL,

    deteriorated_dimension_count
        INTEGER
        NOT NULL,

    generated_summary
        VARCHAR(6000)
        NOT NULL,

    evaluated_by_user_id
        UUID
        NOT NULL,

    evaluated_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_strategy_scenario_evaluation_number
        UNIQUE (
            evaluation_number
        ),

    CONSTRAINT fk_strategy_scenario_evaluation_scenario
        FOREIGN KEY (
            scenario_id
        )
        REFERENCES procurement_strategy_scenarios (id),

    CONSTRAINT fk_strategy_scenario_evaluator
        FOREIGN KEY (
            evaluated_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_strategy_scenario_evaluation_health
        CHECK (
            simulated_health IN (
                'EXCELLENT',
                'STRONG',
                'WATCH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_strategy_scenario_evaluation_movement
        CHECK (
            movement IN (
                'BASELINE',
                'IMPROVING',
                'STABLE',
                'DETERIORATING'
            )
        ),

    CONSTRAINT ck_strategy_scenario_evaluation_scores
        CHECK (
            baseline_overall_score BETWEEN 0 AND 100
            AND simulated_overall_score BETWEEN 0 AND 100
        )
);

CREATE TABLE procurement_strategy_scenario_evaluation_dimensions (
    id UUID PRIMARY KEY,

    evaluation_id
        UUID
        NOT NULL,

    dimension_key
        VARCHAR(50)
        NOT NULL,

    dimension_label
        VARCHAR(160)
        NOT NULL,

    weight_pct
        NUMERIC(7, 2)
        NOT NULL,

    baseline_score
        NUMERIC(7, 2)
        NOT NULL,

    adjustment_points
        NUMERIC(9, 2)
        NOT NULL,

    simulated_score
        NUMERIC(7, 2)
        NOT NULL,

    weighted_contribution
        NUMERIC(9, 2)
        NOT NULL,

    health
        VARCHAR(20)
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_strategy_scenario_evaluation_dimension
        FOREIGN KEY (
            evaluation_id
        )
        REFERENCES procurement_strategy_scenario_evaluations (id)
        ON DELETE CASCADE,

    CONSTRAINT uk_strategy_scenario_evaluation_dimension
        UNIQUE (
            evaluation_id,
            dimension_key
        ),

    CONSTRAINT ck_strategy_scenario_evaluation_dimension_key
        CHECK (
            dimension_key IN (
                'OBJECTIVE_EXECUTION',
                'STRATEGIC_ALIGNMENT',
                'CAPACITY_READINESS',
                'CAPABILITY_READINESS',
                'SUCCESSION_RESILIENCE'
            )
        ),

    CONSTRAINT ck_strategy_scenario_evaluation_dimension_health
        CHECK (
            health IN (
                'EXCELLENT',
                'STRONG',
                'WATCH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_strategy_scenario_evaluation_dimension_scores
        CHECK (
            weight_pct > 0
            AND weight_pct <= 100
            AND baseline_score BETWEEN 0 AND 100
            AND adjustment_points BETWEEN -100 AND 100
            AND simulated_score BETWEEN 0 AND 100
        )
);

CREATE INDEX idx_strategy_scenario_scope
    ON procurement_strategy_scenarios (
        currency,
        fiscal_year,
        status,
        created_at DESC
    );

CREATE INDEX idx_strategy_scenario_assumption_scenario
    ON procurement_strategy_scenario_assumptions (
        scenario_id,
        dimension_key
    );

CREATE INDEX idx_strategy_scenario_evaluation_scenario
    ON procurement_strategy_scenario_evaluations (
        scenario_id,
        evaluated_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_prevent_scenario_evaluation_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Procurement strategy scenario evaluations are immutable';
END;
$$;

CREATE TRIGGER trg_strategy_scenario_evaluation_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_scenario_evaluations
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_scenario_evaluation_mutation();

CREATE TRIGGER trg_strategy_scenario_evaluation_dimension_immutable
BEFORE UPDATE OR DELETE
ON procurement_strategy_scenario_evaluation_dimensions
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_scenario_evaluation_mutation();

CREATE OR REPLACE FUNCTION procureiq_guard_scenario_assumption_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    target_scenario_id UUID;
    target_status VARCHAR(20);
BEGIN
    target_scenario_id =
        COALESCE(
            NEW.scenario_id,
            OLD.scenario_id
        );

    SELECT
        status

    INTO
        target_status

    FROM procurement_strategy_scenarios

    WHERE id =
        target_scenario_id;

    IF target_status IN (
        'APPROVED',
        'ARCHIVED'
    ) THEN
        RAISE EXCEPTION
            'Approved or archived procurement strategy scenarios are immutable';
    END IF;

    RETURN COALESCE(
        NEW,
        OLD
    );
END;
$$;

CREATE TRIGGER trg_strategy_scenario_assumption_guard
BEFORE INSERT OR UPDATE OR DELETE
ON procurement_strategy_scenario_assumptions
FOR EACH ROW
EXECUTE FUNCTION procureiq_guard_scenario_assumption_mutation();

CREATE TRIGGER trg_audit_strategy_scenarios
AFTER INSERT OR UPDATE
ON procurement_strategy_scenarios
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_scenario_assumptions
AFTER INSERT OR UPDATE OR DELETE
ON procurement_strategy_scenario_assumptions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_strategy_scenario_evaluations
AFTER INSERT
ON procurement_strategy_scenario_evaluations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
