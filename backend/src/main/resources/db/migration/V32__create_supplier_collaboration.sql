CREATE SEQUENCE supplier_collaboration_workspace_number_seq
    START WITH 1
    INCREMENT BY 1;

CREATE TABLE supplier_collaboration_workspaces (
    id UUID PRIMARY KEY,

    workspace_number
        VARCHAR(50)
        NOT NULL,

    supplier_id
        UUID
        NOT NULL,

    workspace_type
        VARCHAR(40)
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    priority
        VARCHAR(20)
        NOT NULL,

    title
        VARCHAR(240)
        NOT NULL,

    purchase_order_id
        UUID,

    rfq_id
        UUID,

    external_reference
        VARCHAR(300),

    owner_user_id
        UUID
        NOT NULL,

    supplier_response_sla_hours
        INTEGER
        NOT NULL,

    response_due_at
        TIMESTAMPTZ,

    last_message_at
        TIMESTAMPTZ,

    resolution_note
        VARCHAR(2500),

    resolved_at
        TIMESTAMPTZ,

    notes
        VARCHAR(3000),

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

    CONSTRAINT uk_supplier_collaboration_workspace_number
        UNIQUE (
            workspace_number
        ),

    CONSTRAINT fk_collaboration_workspace_supplier
        FOREIGN KEY (
            supplier_id
        )
        REFERENCES suppliers (id),

    CONSTRAINT fk_collaboration_workspace_po
        FOREIGN KEY (
            purchase_order_id
        )
        REFERENCES purchase_orders (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_collaboration_workspace_rfq
        FOREIGN KEY (
            rfq_id
        )
        REFERENCES rfqs (id)
        ON DELETE SET NULL,

    CONSTRAINT fk_collaboration_workspace_owner
        FOREIGN KEY (
            owner_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_collaboration_workspace_type
        CHECK (
            workspace_type IN (
                'SOURCING_CLARIFICATION',
                'PURCHASE_ORDER',
                'DELIVERY',
                'DOCUMENT_REQUEST',
                'QUALITY_ISSUE',
                'GENERAL'
            )
        ),

    CONSTRAINT ck_collaboration_workspace_status
        CHECK (
            status IN (
                'OPEN',
                'WAITING_SUPPLIER',
                'WAITING_INTERNAL',
                'RESOLVED',
                'CLOSED'
            )
        ),

    CONSTRAINT ck_collaboration_workspace_priority
        CHECK (
            priority IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        ),

    CONSTRAINT ck_collaboration_workspace_sla
        CHECK (
            supplier_response_sla_hours
                BETWEEN 1 AND 720
        )
);

CREATE TABLE supplier_collaboration_messages (
    id UUID PRIMARY KEY,

    workspace_id
        UUID
        NOT NULL,

    message_type
        VARCHAR(40)
        NOT NULL,

    visibility
        VARCHAR(30)
        NOT NULL,

    direction
        VARCHAR(30)
        NOT NULL,

    body
        VARCHAR(5000)
        NOT NULL,

    reference_text
        VARCHAR(1000),

    author_user_id
        UUID,

    supplier_contact_name
        VARCHAR(220),

    responds_to_message_id
        UUID,

    created_at
        TIMESTAMPTZ
        NOT NULL,

    CONSTRAINT fk_collaboration_message_workspace
        FOREIGN KEY (
            workspace_id
        )
        REFERENCES supplier_collaboration_workspaces (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_collaboration_message_author
        FOREIGN KEY (
            author_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT fk_collaboration_message_response
        FOREIGN KEY (
            responds_to_message_id
        )
        REFERENCES supplier_collaboration_messages (id)
        ON DELETE SET NULL,

    CONSTRAINT ck_collaboration_message_type
        CHECK (
            message_type IN (
                'COMMENT',
                'CLARIFICATION',
                'STATUS_UPDATE',
                'DOCUMENT_REQUEST',
                'DELIVERY_UPDATE',
                'ISSUE'
            )
        ),

    CONSTRAINT ck_collaboration_message_visibility
        CHECK (
            visibility IN (
                'INTERNAL_ONLY',
                'SUPPLIER_SHARED'
            )
        ),

    CONSTRAINT ck_collaboration_message_direction
        CHECK (
            direction IN (
                'INTERNAL',
                'TO_SUPPLIER',
                'FROM_SUPPLIER'
            )
        ),

    CONSTRAINT ck_collaboration_message_identity
        CHECK (
            (
                direction IN (
                    'INTERNAL',
                    'TO_SUPPLIER'
                )
                AND author_user_id
                    IS NOT NULL
            )
            OR
            (
                direction =
                    'FROM_SUPPLIER'
                AND supplier_contact_name
                    IS NOT NULL
            )
        ),

    CONSTRAINT ck_collaboration_message_visibility_direction
        CHECK (
            (
                visibility =
                    'INTERNAL_ONLY'
                AND direction =
                    'INTERNAL'
            )
            OR
            (
                visibility =
                    'SUPPLIER_SHARED'
                AND direction IN (
                    'TO_SUPPLIER',
                    'FROM_SUPPLIER'
                )
            )
        )
);

CREATE TABLE supplier_collaboration_actions (
    id UUID PRIMARY KEY,

    workspace_id
        UUID
        NOT NULL,

    action_type
        VARCHAR(50)
        NOT NULL,

    audience
        VARCHAR(20)
        NOT NULL,

    title
        VARCHAR(240)
        NOT NULL,

    description
        VARCHAR(2500),

    assignee_user_id
        UUID,

    external_assignee_label
        VARCHAR(220),

    due_at
        TIMESTAMPTZ
        NOT NULL,

    status
        VARCHAR(30)
        NOT NULL,

    completion_note
        VARCHAR(2500),

    completed_at
        TIMESTAMPTZ,

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

    CONSTRAINT fk_collaboration_action_workspace
        FOREIGN KEY (
            workspace_id
        )
        REFERENCES supplier_collaboration_workspaces (id)
        ON DELETE CASCADE,

    CONSTRAINT fk_collaboration_action_assignee
        FOREIGN KEY (
            assignee_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_collaboration_action_type
        CHECK (
            action_type IN (
                'ACKNOWLEDGE_PO',
                'CONFIRM_DELIVERY',
                'PROVIDE_DOCUMENT',
                'ANSWER_CLARIFICATION',
                'RESOLVE_ISSUE',
                'OTHER'
            )
        ),

    CONSTRAINT ck_collaboration_action_audience
        CHECK (
            audience IN (
                'SUPPLIER',
                'INTERNAL'
            )
        ),

    CONSTRAINT ck_collaboration_action_status
        CHECK (
            status IN (
                'OPEN',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED'
            )
        ),

    CONSTRAINT ck_collaboration_action_assignment
        CHECK (
            (
                audience =
                    'INTERNAL'
                AND assignee_user_id
                    IS NOT NULL
            )
            OR
            (
                audience =
                    'SUPPLIER'
                AND external_assignee_label
                    IS NOT NULL
            )
        )
);

CREATE INDEX idx_collaboration_workspace_supplier
    ON supplier_collaboration_workspaces (
        supplier_id,
        status,
        updated_at DESC
    );

CREATE INDEX idx_collaboration_workspace_status
    ON supplier_collaboration_workspaces (
        status,
        priority,
        response_due_at
    );

CREATE INDEX idx_collaboration_workspace_po
    ON supplier_collaboration_workspaces (
        purchase_order_id
    );

CREATE INDEX idx_collaboration_workspace_rfq
    ON supplier_collaboration_workspaces (
        rfq_id
    );

CREATE INDEX idx_collaboration_message_workspace
    ON supplier_collaboration_messages (
        workspace_id,
        created_at
    );

CREATE INDEX idx_collaboration_message_response
    ON supplier_collaboration_messages (
        responds_to_message_id
    );

CREATE INDEX idx_collaboration_action_workspace
    ON supplier_collaboration_actions (
        workspace_id,
        status,
        due_at
    );

CREATE TRIGGER trg_audit_supplier_collaboration_workspaces
AFTER INSERT OR UPDATE OR DELETE
ON supplier_collaboration_workspaces
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_supplier_collaboration_actions
AFTER INSERT OR UPDATE OR DELETE
ON supplier_collaboration_actions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
