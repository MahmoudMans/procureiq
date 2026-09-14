package com.procureiq.suppliercollaboration;

import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class SupplierCollaborationRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierCollaborationRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextWorkspaceSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'supplier_collaboration_workspace_number_seq'
                )
                """,
                Long.class
        );
    }

    public SupplierRow findSupplier(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name,
                    status
                FROM suppliers
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SupplierRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_code"
                                ),
                                resultSet.getString(
                                        "legal_name"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public UUID findPurchaseOrderSupplierId(
            UUID purchaseOrderId
    ) {
        return jdbcTemplate.query(
                """
                SELECT supplier_id
                FROM purchase_orders
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        resultSet.getObject(
                                "supplier_id",
                                UUID.class
                        ),
                purchaseOrderId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public boolean rfqExists(
            UUID rfqId
    ) {
        Boolean value =
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM rfqs
                            WHERE id = ?
                        )
                        """,
                        Boolean.class,
                        rfqId
                );

        return Boolean.TRUE.equals(
                value
        );
    }

    public void createWorkspace(
            UUID workspaceId,
            String workspaceNumber,
            CollaborationWorkspaceInput input,
            UUID ownerUserId,
            int supplierResponseSlaHours
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_collaboration_workspaces (
                    id,
                    workspace_number,
                    supplier_id,
                    workspace_type,
                    status,
                    priority,
                    title,
                    purchase_order_id,
                    rfq_id,
                    external_reference,
                    owner_user_id,
                    supplier_response_sla_hours,
                    notes,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    'OPEN',
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                workspaceId,
                workspaceNumber,
                input.supplierId(),
                input.workspaceType()
                        .name(),
                input.priority()
                        .name(),
                input.title()
                        .trim(),
                input.purchaseOrderId(),
                input.rfqId(),
                normalizeOptional(
                        input.externalReference()
                ),
                ownerUserId,
                supplierResponseSlaHours,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public WorkspaceRow findWorkspace(
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                workspaceSql()
                        + """
                        WHERE workspace.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapWorkspace(
                                resultSet
                        ),
                workspaceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<WorkspaceRow> findWorkspaces() {
        return jdbcTemplate.query(
                workspaceSql()
                        + """
                        ORDER BY
                            CASE workspace.status
                                WHEN 'WAITING_SUPPLIER'
                                THEN 1
                                WHEN 'WAITING_INTERNAL'
                                THEN 2
                                WHEN 'OPEN'
                                THEN 3
                                WHEN 'RESOLVED'
                                THEN 4
                                ELSE 5
                            END,

                            CASE workspace.priority
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,

                            workspace.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapWorkspace(
                                resultSet
                        )
        );
    }

    public void createMessage(
            UUID messageId,
            UUID workspaceId,
            CollaborationMessageType messageType,
            CollaborationMessageVisibility visibility,
            CollaborationMessageDirection direction,
            String body,
            String referenceText,
            UUID authorUserId,
            String supplierContactName,
            UUID respondsToMessageId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_collaboration_messages (
                    id,
                    workspace_id,
                    message_type,
                    visibility,
                    direction,
                    body,
                    reference_text,
                    author_user_id,
                    supplier_contact_name,
                    responds_to_message_id,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                messageId,
                workspaceId,
                messageType.name(),
                visibility.name(),
                direction.name(),
                body.trim(),
                normalizeOptional(
                        referenceText
                ),
                authorUserId,
                normalizeOptional(
                        supplierContactName
                ),
                respondsToMessageId
        );
    }

    public MessageRow findMessage(
            UUID messageId
    ) {
        return jdbcTemplate.query(
                messageSql()
                        + """
                        WHERE message.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapMessage(
                                resultSet
                        ),
                messageId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<MessageRow> findMessages(
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                messageSql()
                        + """
                        WHERE message.workspace_id = ?
                        ORDER BY
                            message.created_at,
                            message.id
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapMessage(
                                resultSet
                        ),
                workspaceId
        );
    }

    public UUID latestAwaitingSupplierMessage(
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                """
                SELECT outbound.id

                FROM supplier_collaboration_messages
                    outbound

                WHERE outbound.workspace_id = ?

                AND outbound.direction =
                    'TO_SUPPLIER'

                AND NOT EXISTS (
                    SELECT 1

                    FROM supplier_collaboration_messages
                        response

                    WHERE
                        response.responds_to_message_id =
                            outbound.id

                    AND response.direction =
                        'FROM_SUPPLIER'
                )

                ORDER BY
                    outbound.created_at DESC,
                    outbound.id DESC

                LIMIT 1
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        resultSet.getObject(
                                "id",
                                UUID.class
                        ),
                workspaceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void markInternalMessage(
            UUID workspaceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_collaboration_workspaces
                SET
                    last_message_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                workspaceId
        );
    }

    public void markWaitingSupplier(
            UUID workspaceId,
            Instant responseDueAt
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_collaboration_workspaces
                SET
                    status =
                        'WAITING_SUPPLIER',
                    response_due_at = ?,
                    last_message_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status NOT IN (
                    'RESOLVED',
                    'CLOSED'
                )
                """,
                Timestamp.from(
                        responseDueAt
                ),
                workspaceId
        );
    }

    public void markSupplierResponded(
            UUID workspaceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_collaboration_workspaces
                SET
                    status =
                        'WAITING_INTERNAL',
                    response_due_at =
                        NULL,
                    last_message_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status NOT IN (
                    'RESOLVED',
                    'CLOSED'
                )
                """,
                workspaceId
        );
    }

    public void createAction(
            UUID actionId,
            UUID workspaceId,
            CollaborationActionInput input,
            UUID assigneeUserId,
            String externalAssigneeLabel
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_collaboration_actions (
                    id,
                    workspace_id,
                    action_type,
                    audience,
                    title,
                    description,
                    assignee_user_id,
                    external_assignee_label,
                    due_at,
                    status,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                actionId,
                workspaceId,
                input.actionType()
                        .name(),
                input.audience()
                        .name(),
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                assigneeUserId,
                externalAssigneeLabel,
                Timestamp.from(
                        input.dueAt()
                )
        );
    }

    public ActionRow findAction(
            UUID actionId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                actionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ActionRow> findActions(
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.workspace_id = ?

                        ORDER BY
                            CASE action.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'IN_PROGRESS'
                                THEN 2
                                WHEN 'COMPLETED'
                                THEN 3
                                ELSE 4
                            END,
                            action.due_at
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                workspaceId
        );
    }

    public void startAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_collaboration_actions
                SET
                    status =
                        'IN_PROGRESS',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                actionId
        );
    }

    public void completeAction(
            UUID actionId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_collaboration_actions
                SET
                    status =
                        'COMPLETED',
                    completion_note = ?,
                    completed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'OPEN',
                    'IN_PROGRESS'
                )
                """,
                note.trim(),
                actionId
        );
    }

    public void cancelAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_collaboration_actions
                SET
                    status =
                        'CANCELLED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'COMPLETED'
                """,
                actionId
        );
    }

    public void resolveWorkspace(
            UUID workspaceId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_collaboration_workspaces
                SET
                    status =
                        'RESOLVED',
                    response_due_at =
                        NULL,
                    resolution_note = ?,
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status NOT IN (
                    'RESOLVED',
                    'CLOSED'
                )
                """,
                note.trim(),
                workspaceId
        );
    }

    public void closeWorkspace(
            UUID workspaceId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_collaboration_workspaces
                SET
                    status =
                        'CLOSED',
                    response_due_at =
                        NULL,
                    resolution_note = ?,
                    resolved_at =
                        COALESCE(
                            resolved_at,
                            CURRENT_TIMESTAMP
                        ),
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'CLOSED'
                """,
                note.trim(),
                workspaceId
        );
    }

    public List<CollaborationSupplierOptionResponse> suppliers() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name,
                    status
                FROM suppliers
                ORDER BY
                    legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CollaborationSupplierOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_code"
                                ),
                                resultSet.getString(
                                        "legal_name"
                                ),
                                resultSet.getString(
                                        "status"
                                )
                        )
        );
    }

    public List<CollaborationUserOptionResponse> users() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    full_name,
                    role
                FROM app_users
                WHERE active = TRUE
                ORDER BY
                    full_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CollaborationUserOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "full_name"
                                ),
                                ProcurementRole.valueOf(
                                        resultSet.getString(
                                                "role"
                                        )
                                )
                        )
        );
    }

    public List<CollaborationPurchaseOrderOptionResponse> purchaseOrders() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    po_number,
                    supplier_id
                FROM purchase_orders
                WHERE status
                    <> 'CANCELLED'
                ORDER BY
                    po_number DESC
                LIMIT 500
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CollaborationPurchaseOrderOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "po_number"
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                )
                        )
        );
    }

    public List<CollaborationRfqOptionResponse> rfqs() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    rfq_number
                FROM rfqs
                ORDER BY
                    rfq_number DESC
                LIMIT 500
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CollaborationRfqOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "rfq_number"
                                )
                        )
        );
    }

    private String workspaceSql() {
        return """
                SELECT
                    workspace.id,
                    workspace.workspace_number,
                    workspace.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    workspace.workspace_type,
                    workspace.status,
                    workspace.priority,
                    workspace.title,

                    workspace.purchase_order_id,

                    purchase_order.po_number
                        AS purchase_order_number,

                    workspace.rfq_id,

                    rfq.rfq_number,

                    workspace.external_reference,

                    workspace.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    workspace.supplier_response_sla_hours,
                    workspace.response_due_at,
                    workspace.last_message_at,
                    workspace.resolution_note,
                    workspace.notes,

                    (
                        SELECT COUNT(*)

                        FROM supplier_collaboration_actions
                            action

                        WHERE
                            action.workspace_id =
                                workspace.id

                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_actions,

                    (
                        SELECT COUNT(*)

                        FROM supplier_collaboration_actions
                            action

                        WHERE
                            action.workspace_id =
                                workspace.id

                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )

                        AND action.due_at
                            < CURRENT_TIMESTAMP
                    )
                        AS overdue_actions,

                    (
                        SELECT COUNT(*)

                        FROM supplier_collaboration_messages
                            message

                        WHERE
                            message.workspace_id =
                                workspace.id

                        AND message.visibility =
                            'SUPPLIER_SHARED'
                    )
                        AS supplier_shared_messages,

                    (
                        SELECT COUNT(*)

                        FROM supplier_collaboration_messages
                            response

                        WHERE
                            response.workspace_id =
                                workspace.id

                        AND response.direction =
                            'FROM_SUPPLIER'

                        AND response.responds_to_message_id
                            IS NOT NULL
                    )
                        AS supplier_response_count,

                    (
                        SELECT
                            ROUND(
                                AVG(
                                    EXTRACT(
                                        EPOCH
                                        FROM (
                                            response.created_at
                                            -
                                            outbound.created_at
                                        )
                                    )
                                    /
                                    3600.0
                                )::NUMERIC,
                                2
                            )

                        FROM supplier_collaboration_messages
                            response

                        JOIN supplier_collaboration_messages
                            outbound
                            ON outbound.id =
                               response.responds_to_message_id

                        WHERE
                            response.workspace_id =
                                workspace.id

                        AND response.direction =
                            'FROM_SUPPLIER'

                        AND outbound.direction =
                            'TO_SUPPLIER'
                    )
                        AS average_supplier_response_hours,

                    workspace.created_at,
                    workspace.updated_at,
                    workspace.version

                FROM supplier_collaboration_workspaces
                    workspace

                JOIN suppliers supplier
                    ON supplier.id =
                       workspace.supplier_id

                JOIN app_users owner
                    ON owner.id =
                       workspace.owner_user_id

                LEFT JOIN purchase_orders
                    purchase_order
                    ON purchase_order.id =
                       workspace.purchase_order_id

                LEFT JOIN rfqs rfq
                    ON rfq.id =
                       workspace.rfq_id

                """;
    }

    private String messageSql() {
        return """
                SELECT
                    message.id,
                    message.workspace_id,
                    message.message_type,
                    message.visibility,
                    message.direction,
                    message.body,
                    message.reference_text,
                    message.author_user_id,

                    author.full_name
                        AS author_name,

                    message.supplier_contact_name,
                    message.responds_to_message_id,
                    message.created_at

                FROM supplier_collaboration_messages
                    message

                LEFT JOIN app_users author
                    ON author.id =
                       message.author_user_id

                """;
    }

    private String actionSql() {
        return """
                SELECT
                    action.id,
                    action.workspace_id,
                    action.action_type,
                    action.audience,
                    action.title,
                    action.description,
                    action.assignee_user_id,

                    assignee.full_name
                        AS assignee_name,

                    action.external_assignee_label,
                    action.due_at,
                    action.status,
                    action.completion_note,
                    action.completed_at,
                    action.created_at,
                    action.updated_at,
                    action.version

                FROM supplier_collaboration_actions
                    action

                LEFT JOIN app_users assignee
                    ON assignee.id =
                       action.assignee_user_id

                """;
    }

    private WorkspaceRow mapWorkspace(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp responseDue =
                resultSet.getTimestamp(
                        "response_due_at"
                );

        Timestamp lastMessage =
                resultSet.getTimestamp(
                        "last_message_at"
                );

        BigDecimal averageResponse =
                resultSet.getBigDecimal(
                        "average_supplier_response_hours"
                );

        return new WorkspaceRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "workspace_number"
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getString(
                        "supplier_code"
                ),
                resultSet.getString(
                        "supplier_name"
                ),
                CollaborationWorkspaceType.valueOf(
                        resultSet.getString(
                                "workspace_type"
                        )
                ),
                CollaborationWorkspaceStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                CollaborationPriority.valueOf(
                        resultSet.getString(
                                "priority"
                        )
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getObject(
                        "purchase_order_id",
                        UUID.class
                ),
                resultSet.getString(
                        "purchase_order_number"
                ),
                resultSet.getObject(
                        "rfq_id",
                        UUID.class
                ),
                resultSet.getString(
                        "rfq_number"
                ),
                resultSet.getString(
                        "external_reference"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getInt(
                        "supplier_response_sla_hours"
                ),
                responseDue == null
                        ? null
                        : responseDue.toInstant(),
                lastMessage == null
                        ? null
                        : lastMessage.toInstant(),
                resultSet.getString(
                        "resolution_note"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getLong(
                        "open_actions"
                ),
                resultSet.getLong(
                        "overdue_actions"
                ),
                resultSet.getLong(
                        "supplier_shared_messages"
                ),
                resultSet.getLong(
                        "supplier_response_count"
                ),
                averageResponse,
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "updated_at"
                )
                        .toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private MessageRow mapMessage(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new MessageRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "workspace_id",
                        UUID.class
                ),
                CollaborationMessageType.valueOf(
                        resultSet.getString(
                                "message_type"
                        )
                ),
                CollaborationMessageVisibility.valueOf(
                        resultSet.getString(
                                "visibility"
                        )
                ),
                CollaborationMessageDirection.valueOf(
                        resultSet.getString(
                                "direction"
                        )
                ),
                resultSet.getString(
                        "body"
                ),
                resultSet.getString(
                        "reference_text"
                ),
                resultSet.getObject(
                        "author_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "author_name"
                ),
                resultSet.getString(
                        "supplier_contact_name"
                ),
                resultSet.getObject(
                        "responds_to_message_id",
                        UUID.class
                ),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant()
        );
    }

    private ActionRow mapAction(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp completed =
                resultSet.getTimestamp(
                        "completed_at"
                );

        return new ActionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "workspace_id",
                        UUID.class
                ),
                CollaborationActionType.valueOf(
                        resultSet.getString(
                                "action_type"
                        )
                ),
                CollaborationActionAudience.valueOf(
                        resultSet.getString(
                                "audience"
                        )
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getObject(
                        "assignee_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "assignee_name"
                ),
                resultSet.getString(
                        "external_assignee_label"
                ),
                resultSet.getTimestamp(
                        "due_at"
                )
                        .toInstant(),
                CollaborationActionStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "completion_note"
                ),
                completed == null
                        ? null
                        : completed.toInstant(),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "updated_at"
                )
                        .toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private String normalizeOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String normalized =
                value.trim();

        return normalized.isEmpty()
                ? null
                : normalized;
    }

    public record SupplierRow(
            UUID id,
            String supplierCode,
            String supplierName,
            String status
    ) {
    }

    public record WorkspaceRow(
            UUID id,
            String workspaceNumber,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            CollaborationWorkspaceType workspaceType,
            CollaborationWorkspaceStatus status,
            CollaborationPriority priority,
            String title,
            UUID purchaseOrderId,
            String purchaseOrderNumber,
            UUID rfqId,
            String rfqNumber,
            String externalReference,
            UUID ownerUserId,
            String ownerName,
            int supplierResponseSlaHours,
            Instant responseDueAt,
            Instant lastMessageAt,
            String resolutionNote,
            String notes,
            long openActions,
            long overdueActions,
            long supplierSharedMessages,
            long supplierResponseCount,
            BigDecimal averageSupplierResponseHours,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record MessageRow(
            UUID id,
            UUID workspaceId,
            CollaborationMessageType messageType,
            CollaborationMessageVisibility visibility,
            CollaborationMessageDirection direction,
            String body,
            String referenceText,
            UUID authorUserId,
            String authorName,
            String supplierContactName,
            UUID respondsToMessageId,
            Instant createdAt
    ) {
    }

    public record ActionRow(
            UUID id,
            UUID workspaceId,
            CollaborationActionType actionType,
            CollaborationActionAudience audience,
            String title,
            String description,
            UUID assigneeUserId,
            String assigneeName,
            String externalAssigneeLabel,
            Instant dueAt,
            CollaborationActionStatus status,
            String completionNote,
            Instant completedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }
}
