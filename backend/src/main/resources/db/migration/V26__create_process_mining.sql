CREATE TABLE procurement_process_stage_targets (
    id BIGSERIAL PRIMARY KEY,

    entity_type
        VARCHAR(40)
        NOT NULL,

    status
        VARCHAR(80)
        NOT NULL,

    target_hours
        INTEGER
        NOT NULL,

    created_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    updated_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_process_stage_target
        UNIQUE (
            entity_type,
            status
        ),

    CONSTRAINT ck_process_stage_target_entity
        CHECK (
            entity_type IN (
                'PURCHASE_REQUEST',
                'APPROVAL',
                'RFQ',
                'AWARD',
                'PURCHASE_ORDER',
                'GOODS_RECEIPT',
                'INVOICE'
            )
        ),

    CONSTRAINT ck_process_stage_target_hours
        CHECK (
            target_hours
                BETWEEN 1 AND 8760
        )
);

CREATE TABLE procurement_process_events (
    id BIGSERIAL PRIMARY KEY,

    entity_type
        VARCHAR(40)
        NOT NULL,

    entity_id
        UUID
        NOT NULL,

    entity_reference
        VARCHAR(160),

    status
        VARCHAR(80)
        NOT NULL,

    previous_status
        VARCHAR(80),

    event_type
        VARCHAR(30)
        NOT NULL,

    event_source
        VARCHAR(20)
        NOT NULL,

    purchase_request_id
        UUID,

    rfq_id
        UUID,

    purchase_order_id
        UUID,

    supplier_id
        UUID,

    department_id
        UUID,

    category
        VARCHAR(160),

    source_table
        VARCHAR(100)
        NOT NULL,

    event_at
        TIMESTAMPTZ
        NOT NULL,

    recorded_at
        TIMESTAMPTZ
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_process_event_entity
        CHECK (
            entity_type IN (
                'PURCHASE_REQUEST',
                'APPROVAL',
                'RFQ',
                'AWARD',
                'PURCHASE_ORDER',
                'GOODS_RECEIPT',
                'INVOICE'
            )
        ),

    CONSTRAINT ck_process_event_type
        CHECK (
            event_type IN (
                'SNAPSHOT',
                'CREATED',
                'STATUS_CHANGED'
            )
        ),

    CONSTRAINT ck_process_event_source
        CHECK (
            event_source IN (
                'BACKFILL',
                'LIVE'
            )
        )
);

CREATE INDEX idx_process_event_entity
    ON procurement_process_events (
        entity_type,
        entity_id,
        event_at,
        id
    );

CREATE INDEX idx_process_event_status
    ON procurement_process_events (
        entity_type,
        status,
        event_at
    );

CREATE INDEX idx_process_event_request
    ON procurement_process_events (
        purchase_request_id
    );

CREATE INDEX idx_process_event_rfq
    ON procurement_process_events (
        rfq_id
    );

CREATE INDEX idx_process_event_po
    ON procurement_process_events (
        purchase_order_id
    );

CREATE INDEX idx_process_event_department
    ON procurement_process_events (
        department_id
    );

CREATE INDEX idx_process_event_category
    ON procurement_process_events (
        category
    );

INSERT INTO procurement_process_stage_targets (
    entity_type,
    status,
    target_hours
)
VALUES
    (
        'PURCHASE_REQUEST',
        '*',
        48
    ),
    (
        'APPROVAL',
        '*',
        24
    ),
    (
        'RFQ',
        '*',
        120
    ),
    (
        'AWARD',
        '*',
        48
    ),
    (
        'PURCHASE_ORDER',
        '*',
        168
    ),
    (
        'GOODS_RECEIPT',
        '*',
        72
    ),
    (
        'INVOICE',
        '*',
        48
    ),
    (
        'INVOICE',
        'EXCEPTION',
        24
    ),
    (
        'INVOICE',
        'PAYMENT_HOLD',
        24
    );

CREATE OR REPLACE FUNCTION procureiq_process_try_uuid(
    raw_value TEXT
)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF raw_value IS NULL
       OR BTRIM(raw_value) = '' THEN
        RETURN NULL;
    END IF;

    RETURN raw_value::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION procureiq_capture_process_event()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    new_payload JSONB;
    old_payload JSONB;

    event_entity_type TEXT;
    entity_uuid UUID;

    current_status TEXT;
    prior_status TEXT;

    request_uuid UUID;
    rfq_uuid UUID;
    po_uuid UUID;
    supplier_uuid UUID;
    department_uuid UUID;

    entity_reference_value TEXT;
    category_value TEXT;
BEGIN
    new_payload :=
        TO_JSONB(NEW);

    IF TG_OP = 'UPDATE' THEN
        old_payload :=
            TO_JSONB(OLD);
    ELSE
        old_payload :=
            NULL;
    END IF;

    entity_uuid :=
        procureiq_process_try_uuid(
            new_payload ->> 'id'
        );

    IF entity_uuid IS NULL THEN
        RETURN NEW;
    END IF;

    event_entity_type :=
        CASE TG_TABLE_NAME
            WHEN 'purchase_requests'
                THEN 'PURCHASE_REQUEST'

            WHEN 'approval_requests'
                THEN 'APPROVAL'

            WHEN 'purchase_request_approvals'
                THEN 'APPROVAL'

            WHEN 'approval_steps'
                THEN 'APPROVAL'

            WHEN 'approvals'
                THEN 'APPROVAL'

            WHEN 'rfqs'
                THEN 'RFQ'

            WHEN 'award_decisions'
                THEN 'AWARD'

            WHEN 'purchase_orders'
                THEN 'PURCHASE_ORDER'

            WHEN 'goods_receipts'
                THEN 'GOODS_RECEIPT'

            WHEN 'procurement_invoices'
                THEN 'INVOICE'

            ELSE NULL
        END;

    IF event_entity_type IS NULL THEN
        RETURN NEW;
    END IF;

    current_status :=
        COALESCE(
            NULLIF(
                new_payload ->> 'status',
                ''
            ),
            'CREATED'
        );

    prior_status :=
        CASE
            WHEN old_payload IS NULL
                THEN NULL
            ELSE NULLIF(
                old_payload ->> 'status',
                ''
            )
        END;

    IF TG_OP = 'UPDATE'
       AND COALESCE(
               current_status,
               ''
           ) =
           COALESCE(
               prior_status,
               ''
           ) THEN
        RETURN NEW;
    END IF;

    request_uuid :=
        COALESCE(
            procureiq_process_try_uuid(
                new_payload
                    ->> 'purchase_request_id'
            ),
            procureiq_process_try_uuid(
                new_payload
                    ->> 'request_id'
            ),
            CASE
                WHEN event_entity_type =
                    'PURCHASE_REQUEST'
                THEN entity_uuid
                ELSE NULL
            END
        );

    rfq_uuid :=
        COALESCE(
            procureiq_process_try_uuid(
                new_payload ->> 'rfq_id'
            ),
            CASE
                WHEN event_entity_type =
                    'RFQ'
                THEN entity_uuid
                ELSE NULL
            END
        );

    po_uuid :=
        COALESCE(
            procureiq_process_try_uuid(
                new_payload
                    ->> 'purchase_order_id'
            ),
            procureiq_process_try_uuid(
                new_payload ->> 'po_id'
            ),
            CASE
                WHEN event_entity_type =
                    'PURCHASE_ORDER'
                THEN entity_uuid
                ELSE NULL
            END
        );

    supplier_uuid :=
        procureiq_process_try_uuid(
            new_payload ->> 'supplier_id'
        );

    department_uuid :=
        procureiq_process_try_uuid(
            new_payload ->> 'department_id'
        );

    category_value :=
        COALESCE(
            NULLIF(
                new_payload ->> 'category',
                ''
            ),
            NULLIF(
                new_payload ->> 'category_name',
                ''
            )
        );

    entity_reference_value :=
        COALESCE(
            NULLIF(
                new_payload
                    ->> 'request_number',
                ''
            ),
            NULLIF(
                new_payload
                    ->> 'rfq_number',
                ''
            ),
            NULLIF(
                new_payload
                    ->> 'po_number',
                ''
            ),
            NULLIF(
                new_payload
                    ->> 'receipt_number',
                ''
            ),
            NULLIF(
                new_payload
                    ->> 'invoice_number',
                ''
            ),
            NULLIF(
                new_payload
                    ->> 'supplier_invoice_number',
                ''
            ),
            entity_uuid::TEXT
        );

    INSERT INTO procurement_process_events (
        entity_type,
        entity_id,
        entity_reference,
        status,
        previous_status,
        event_type,
        event_source,
        purchase_request_id,
        rfq_id,
        purchase_order_id,
        supplier_id,
        department_id,
        category,
        source_table,
        event_at
    )
    VALUES (
        event_entity_type,
        entity_uuid,
        entity_reference_value,
        current_status,
        prior_status,
        CASE
            WHEN TG_OP = 'INSERT'
                THEN 'CREATED'
            ELSE 'STATUS_CHANGED'
        END,
        'LIVE',
        request_uuid,
        rfq_uuid,
        po_uuid,
        supplier_uuid,
        department_uuid,
        category_value,
        TG_TABLE_NAME,
        CURRENT_TIMESTAMP
    );

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION procureiq_backfill_process_table(
    table_name_value TEXT,
    entity_type_value TEXT
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE FORMAT(
        $SQL$
        INSERT INTO procurement_process_events (
            entity_type,
            entity_id,
            entity_reference,
            status,
            previous_status,
            event_type,
            event_source,
            purchase_request_id,
            rfq_id,
            purchase_order_id,
            supplier_id,
            department_id,
            category,
            source_table,
            event_at
        )

        SELECT
            $1,

            procureiq_process_try_uuid(
                payload ->> 'id'
            ),

            COALESCE(
                NULLIF(
                    payload
                        ->> 'request_number',
                    ''
                ),
                NULLIF(
                    payload
                        ->> 'rfq_number',
                    ''
                ),
                NULLIF(
                    payload
                        ->> 'po_number',
                    ''
                ),
                NULLIF(
                    payload
                        ->> 'receipt_number',
                    ''
                ),
                NULLIF(
                    payload
                        ->> 'invoice_number',
                    ''
                ),
                NULLIF(
                    payload
                        ->> 'supplier_invoice_number',
                    ''
                ),
                payload ->> 'id'
            ),

            COALESCE(
                NULLIF(
                    payload ->> 'status',
                    ''
                ),
                'CREATED'
            ),

            NULL,

            'SNAPSHOT',

            'BACKFILL',

            COALESCE(
                procureiq_process_try_uuid(
                    payload
                        ->> 'purchase_request_id'
                ),
                procureiq_process_try_uuid(
                    payload
                        ->> 'request_id'
                ),
                CASE
                    WHEN $1 =
                        'PURCHASE_REQUEST'
                    THEN procureiq_process_try_uuid(
                        payload ->> 'id'
                    )
                    ELSE NULL
                END
            ),

            COALESCE(
                procureiq_process_try_uuid(
                    payload ->> 'rfq_id'
                ),
                CASE
                    WHEN $1 = 'RFQ'
                    THEN procureiq_process_try_uuid(
                        payload ->> 'id'
                    )
                    ELSE NULL
                END
            ),

            COALESCE(
                procureiq_process_try_uuid(
                    payload
                        ->> 'purchase_order_id'
                ),
                procureiq_process_try_uuid(
                    payload ->> 'po_id'
                ),
                CASE
                    WHEN $1 =
                        'PURCHASE_ORDER'
                    THEN procureiq_process_try_uuid(
                        payload ->> 'id'
                    )
                    ELSE NULL
                END
            ),

            procureiq_process_try_uuid(
                payload ->> 'supplier_id'
            ),

            procureiq_process_try_uuid(
                payload ->> 'department_id'
            ),

            COALESCE(
                NULLIF(
                    payload ->> 'category',
                    ''
                ),
                NULLIF(
                    payload
                        ->> 'category_name',
                    ''
                )
            ),

            $2,

            CURRENT_TIMESTAMP

        FROM (
            SELECT
                TO_JSONB(source_row)
                    AS payload
            FROM %I source_row
        ) source_payload

        WHERE
            procureiq_process_try_uuid(
                payload ->> 'id'
            )
            IS NOT NULL

        AND NOT EXISTS (
            SELECT 1
            FROM procurement_process_events
                existing
            WHERE
                existing.entity_type =
                    $1
            AND existing.entity_id =
                procureiq_process_try_uuid(
                    payload ->> 'id'
                )
        )
        $SQL$,
        table_name_value
    )
    USING
        entity_type_value,
        table_name_value;
END;
$$;

DO $$
DECLARE
    process_source RECORD;
    trigger_name TEXT;
BEGIN
    FOR process_source IN
        SELECT *
        FROM (
            VALUES
                (
                    'purchase_requests',
                    'PURCHASE_REQUEST'
                ),
                (
                    'approval_requests',
                    'APPROVAL'
                ),
                (
                    'purchase_request_approvals',
                    'APPROVAL'
                ),
                (
                    'approval_steps',
                    'APPROVAL'
                ),
                (
                    'approvals',
                    'APPROVAL'
                ),
                (
                    'rfqs',
                    'RFQ'
                ),
                (
                    'award_decisions',
                    'AWARD'
                ),
                (
                    'purchase_orders',
                    'PURCHASE_ORDER'
                ),
                (
                    'goods_receipts',
                    'GOODS_RECEIPT'
                ),
                (
                    'procurement_invoices',
                    'INVOICE'
                )
        ) AS source_table(
            table_name,
            entity_type
        )
    LOOP
        IF TO_REGCLASS(
            'public.'
            ||
            process_source.table_name
        ) IS NOT NULL THEN

            PERFORM
                procureiq_backfill_process_table(
                    process_source.table_name,
                    process_source.entity_type
                );

            trigger_name :=
                'trg_process_'
                ||
                process_source.table_name;

            EXECUTE FORMAT(
                'DROP TRIGGER IF EXISTS %I ON %I',
                trigger_name,
                process_source.table_name
            );

            EXECUTE FORMAT(
                'CREATE TRIGGER %I
                 AFTER INSERT OR UPDATE
                 ON %I
                 FOR EACH ROW
                 EXECUTE FUNCTION
                 procureiq_capture_process_event()',
                trigger_name,
                process_source.table_name
            );
        END IF;
    END LOOP;
END;
$$;

DROP FUNCTION procureiq_backfill_process_table(
    TEXT,
    TEXT
);

CREATE TRIGGER trg_audit_process_stage_targets
AFTER INSERT OR UPDATE OR DELETE
ON procurement_process_stage_targets
FOR EACH ROW
EXECUTE FUNCTION procureiq_capture_audit_event();
