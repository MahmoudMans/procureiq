CREATE TABLE departments (
    id UUID PRIMARY KEY,

    code VARCHAR(40) NOT NULL,

    name VARCHAR(120) NOT NULL,

    description VARCHAR(500),

    created_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_departments_code
        UNIQUE (code),

    CONSTRAINT uk_departments_name
        UNIQUE (name)
);

CREATE TABLE app_users (
    id UUID PRIMARY KEY,

    full_name VARCHAR(160) NOT NULL,

    email VARCHAR(200) NOT NULL,

    password_hash VARCHAR(255) NOT NULL,

    role VARCHAR(40) NOT NULL,

    department_id UUID NOT NULL,

    job_title VARCHAR(120) NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT uk_app_users_email
        UNIQUE (email),

    CONSTRAINT fk_app_users_department
        FOREIGN KEY (department_id)
        REFERENCES departments (id),

    CONSTRAINT ck_app_users_role
        CHECK (
            role IN (
                'ADMIN',
                'PROCUREMENT_MANAGER',
                'BUYER',
                'REQUESTER',
                'APPROVER'
            )
        )
);

CREATE INDEX idx_app_users_department
    ON app_users (department_id);

CREATE INDEX idx_app_users_role
    ON app_users (role);

CREATE INDEX idx_app_users_active
    ON app_users (active);

CREATE INDEX idx_app_users_email_lower
    ON app_users (LOWER(email));

INSERT INTO departments (
    id,
    code,
    name,
    description,
    created_at
)
VALUES
(
    '20000000-0000-0000-0000-000000000001',
    'PROC-EX',
    'Procurement Excellence',
    'Procurement governance, platform administration and operating model.',
    CURRENT_TIMESTAMP
),
(
    '20000000-0000-0000-0000-000000000002',
    'SOURCING',
    'Strategic Sourcing',
    'Supplier selection, sourcing events, negotiation and purchasing.',
    CURRENT_TIMESTAMP
),
(
    '20000000-0000-0000-0000-000000000003',
    'OPS',
    'Operations',
    'Operational teams creating purchasing demand and requirements.',
    CURRENT_TIMESTAMP
),
(
    '20000000-0000-0000-0000-000000000004',
    'FIN',
    'Finance',
    'Budget oversight, financial governance and procurement approvals.',
    CURRENT_TIMESTAMP
),
(
    '20000000-0000-0000-0000-000000000005',
    'IT',
    'Information Technology',
    'Technology procurement stakeholders and technical requirements.',
    CURRENT_TIMESTAMP
);
