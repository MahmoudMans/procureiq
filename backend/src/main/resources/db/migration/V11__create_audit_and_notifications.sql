CREATE TABLE audit_events (
    id BIGSERIAL PRIMARY KEY,

    entity_type
        VARCHAR(80)
        NOT NULL,

    entity_id
        UUID
        NOT NULL,

    action
        VARCHAR(30)
        NOT NULL,

    status
        VARCHAR(80),

    actor_user_id
        UUID,

    occurred_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    payload
        JSONB
        NOT NULL,

    CONSTRAINT fk_audit_events_actor
        FOREIGN KEY (
            actor_user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT ck_audit_events_action
        CHECK (
            action IN (
                'CREATED',
                'UPDATED',
                'DELETED'
            )
        )
);

CREATE INDEX idx_audit_events_occurred
    ON audit_events (
        occurred_at DESC
    );

CREATE INDEX idx_audit_events_entity
    ON audit_events (
        entity_type,
        entity_id,
        occurred_at DESC
    );

CREATE INDEX idx_audit_events_actor
    ON audit_events (
        actor_user_id,
        occurred_at DESC
    );

CREATE OR REPLACE FUNCTION procureiq_capture_audit_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    row_data JSONB;
    entity_name VARCHAR(80);
    event_action VARCHAR(30);
    actor_text TEXT;
    actor_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        row_data := TO_JSONB(OLD);
        event_action := 'DELETED';
    ELSIF TG_OP = 'INSERT' THEN
        row_data := TO_JSONB(NEW);
        event_action := 'CREATED';
    ELSE
        row_data := TO_JSONB(NEW);
        event_action := 'UPDATED';
    END IF;

    entity_name :=
        CASE TG_TABLE_NAME
            WHEN 'purchase_requests'
                THEN 'PURCHASE_REQUEST'
            WHEN 'approval_tasks'
                THEN 'APPROVAL'
            WHEN 'rfqs'
                THEN 'RFQ'
            WHEN 'quotations'
                THEN 'QUOTATION'
            WHEN 'award_decisions'
                THEN 'AWARD_DECISION'
            WHEN 'purchase_orders'
                THEN 'PURCHASE_ORDER'
            WHEN 'goods_receipts'
                THEN 'GOODS_RECEIPT'
            ELSE UPPER(TG_TABLE_NAME)
        END;

    actor_text :=
        COALESCE(
            NULLIF(
                row_data ->> 'decided_by_user_id',
                ''
            ),
            NULLIF(
                row_data ->> 'issued_by_user_id',
                ''
            ),
            NULLIF(
                row_data ->> 'recorded_by_user_id',
                ''
            ),
            NULLIF(
                row_data ->> 'created_by_user_id',
                ''
            ),
            NULLIF(
                row_data ->> 'requester_user_id',
                ''
            ),
            NULLIF(
                row_data ->> 'requester_id',
                ''
            )
        );

    IF actor_text IS NOT NULL THEN
        BEGIN
            actor_id := actor_text::UUID;
        EXCEPTION
            WHEN invalid_text_representation THEN
                actor_id := NULL;
        END;
    END IF;

    INSERT INTO audit_events (
        entity_type,
        entity_id,
        action,
        status,
        actor_user_id,
        payload
    )
    VALUES (
        entity_name,
        (row_data ->> 'id')::UUID,
        event_action,
        row_data ->> 'status',
        actor_id,
        row_data
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_purchase_requests
AFTER INSERT OR UPDATE OR DELETE
ON purchase_requests
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_approval_tasks
AFTER INSERT OR UPDATE OR DELETE
ON approval_tasks
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_rfqs
AFTER INSERT OR UPDATE OR DELETE
ON rfqs
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_quotations
AFTER INSERT OR UPDATE OR DELETE
ON quotations
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_award_decisions
AFTER INSERT OR UPDATE OR DELETE
ON award_decisions
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_purchase_orders
AFTER INSERT OR UPDATE OR DELETE
ON purchase_orders
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE TRIGGER trg_audit_goods_receipts
AFTER INSERT OR UPDATE OR DELETE
ON goods_receipts
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();

CREATE OR REPLACE FUNCTION procureiq_prevent_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'audit_events is immutable';
END;
$$;

CREATE TRIGGER trg_audit_events_immutable
BEFORE UPDATE OR DELETE
ON audit_events
FOR EACH ROW
EXECUTE FUNCTION procureiq_prevent_audit_mutation();

CREATE TABLE user_notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id
        UUID
        NOT NULL,

    notification_key
        VARCHAR(255)
        NOT NULL,

    notification_type
        VARCHAR(80)
        NOT NULL,

    severity
        VARCHAR(20)
        NOT NULL,

    title
        VARCHAR(200)
        NOT NULL,

    message
        VARCHAR(1000)
        NOT NULL,

    entity_type
        VARCHAR(80),

    entity_id
        UUID,

    href
        VARCHAR(500),

    read_at
        TIMESTAMPTZ,

    created_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user_notifications_user
        FOREIGN KEY (
            user_id
        )
        REFERENCES app_users (id),

    CONSTRAINT uk_user_notifications_key
        UNIQUE (
            user_id,
            notification_key
        ),

    CONSTRAINT ck_user_notifications_severity
        CHECK (
            severity IN (
                'INFO',
                'WARNING',
                'HIGH'
            )
        )
);

CREATE INDEX idx_user_notifications_user_created
    ON user_notifications (
        user_id,
        created_at DESC
    );

CREATE INDEX idx_user_notifications_unread
    ON user_notifications (
        user_id,
        read_at,
        created_at DESC
    );
