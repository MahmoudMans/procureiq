CREATE TABLE approval_policies (
    id UUID PRIMARY KEY,

    policy_code VARCHAR(60) NOT NULL,

    policy_name VARCHAR(160) NOT NULL,

    description VARCHAR(500),

    minimum_amount
        NUMERIC(19, 2)
        NOT NULL,

    maximum_amount
        NUMERIC(19, 2),

    required_role
        VARCHAR(40)
        NOT NULL,

    priority INTEGER NOT NULL,

    active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT uk_approval_policies_code
        UNIQUE (policy_code),

    CONSTRAINT ck_approval_policy_minimum
        CHECK (
            minimum_amount >= 0
        ),

    CONSTRAINT ck_approval_policy_range
        CHECK (
            maximum_amount IS NULL
            OR maximum_amount >= minimum_amount
        ),

    CONSTRAINT ck_approval_policy_role
        CHECK (
            required_role IN (
                'ADMIN',
                'PROCUREMENT_MANAGER',
                'APPROVER'
            )
        )
);

CREATE TABLE approval_tasks (
    id UUID PRIMARY KEY,

    purchase_request_id UUID NOT NULL,

    policy_id UUID NOT NULL,

    required_role
        VARCHAR(40)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    decided_by_user_id UUID,

    decision_comment
        VARCHAR(2000),

    requested_at
        TIMESTAMPTZ
        NOT NULL,

    decided_at
        TIMESTAMPTZ,

    version
        BIGINT
        NOT NULL
        DEFAULT 0,

    CONSTRAINT fk_approval_task_request
        FOREIGN KEY (
            purchase_request_id
        )
        REFERENCES purchase_requests (id),

    CONSTRAINT fk_approval_task_policy
        FOREIGN KEY (
            policy_id
        )
        REFERENCES approval_policies (id),

    CONSTRAINT fk_approval_task_decider
        FOREIGN KEY (
            decided_by_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_approval_task_role
        CHECK (
            required_role IN (
                'ADMIN',
                'PROCUREMENT_MANAGER',
                'APPROVER'
            )
        ),

    CONSTRAINT ck_approval_task_status
        CHECK (
            status IN (
                'PENDING',
                'APPROVED',
                'REJECTED',
                'CANCELLED'
            )
        )
);

CREATE UNIQUE INDEX
    uk_approval_task_pending_request
ON approval_tasks (
    purchase_request_id
)
WHERE status = 'PENDING';

CREATE INDEX
    idx_approval_tasks_role_status
ON approval_tasks (
    required_role,
    status
);

CREATE INDEX
    idx_approval_tasks_requested_at
ON approval_tasks (
    requested_at DESC
);

CREATE INDEX
    idx_approval_tasks_purchase_request
ON approval_tasks (
    purchase_request_id
);

INSERT INTO approval_policies (
    id,
    policy_code,
    policy_name,
    description,
    minimum_amount,
    maximum_amount,
    required_role,
    priority,
    active,
    created_at
)
VALUES
(
    '30000000-0000-0000-0000-000000000001',
    'STANDARD-FINANCE',
    'Standard Finance Approval',
    'Standard purchasing requests below EUR 10,000 equivalent.',
    0.00,
    9999.99,
    'APPROVER',
    10,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    '30000000-0000-0000-0000-000000000002',
    'STRATEGIC-REVIEW',
    'Strategic Procurement Review',
    'Material purchasing commitments from EUR 10,000 to EUR 49,999.99 equivalent.',
    10000.00,
    49999.99,
    'PROCUREMENT_MANAGER',
    20,
    TRUE,
    CURRENT_TIMESTAMP
),
(
    '30000000-0000-0000-0000-000000000003',
    'EXECUTIVE-REVIEW',
    'Executive Procurement Approval',
    'High-value purchasing commitments of EUR 50,000 or more.',
    50000.00,
    NULL,
    'ADMIN',
    30,
    TRUE,
    CURRENT_TIMESTAMP
);
