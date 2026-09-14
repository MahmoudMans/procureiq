package com.procureiq.supplierportal;

import com.procureiq.suppliercollaboration.CollaborationActionStatus;
import com.procureiq.suppliercollaboration.CollaborationActionType;
import com.procureiq.suppliercollaboration.CollaborationMessageDirection;
import com.procureiq.suppliercollaboration.CollaborationMessageType;
import com.procureiq.suppliercollaboration.CollaborationPriority;
import com.procureiq.suppliercollaboration.CollaborationWorkspaceStatus;
import com.procureiq.suppliercollaboration.CollaborationWorkspaceType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class SupplierPortalRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierPortalRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
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

    public AccountRow findAccount(
            UUID accountId
    ) {
        return jdbcTemplate.query(
                accountSql()
                        + """
                        WHERE account.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAccount(
                                resultSet
                        ),
                accountId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public AccountRow findAccountByEmail(
            String email
    ) {
        return jdbcTemplate.query(
                accountSql()
                        + """
                        WHERE LOWER(account.email) =
                            LOWER(?)
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAccount(
                                resultSet
                        ),
                email
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public AccountRow findInvitedAccountByTokenHash(
            String tokenHash
    ) {
        return jdbcTemplate.query(
                accountSql()
                        + """
                        WHERE account.status =
                            'INVITED'

                        AND account.invitation_token_hash = ?

                        AND account.invitation_expires_at
                            >= CURRENT_TIMESTAMP
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAccount(
                                resultSet
                        ),
                tokenHash
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<AccountRow> accounts() {
        return jdbcTemplate.query(
                accountSql()
                        + """
                        ORDER BY
                            supplier.legal_name,
                            account.display_name,
                            account.email
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAccount(
                                resultSet
                        )
        );
    }

    public void createInvitation(
            UUID accountId,
            SupplierPortalInviteInput input,
            String tokenHash,
            Instant invitationExpiresAt,
            UUID createdByUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_portal_accounts (
                    id,
                    supplier_id,
                    email,
                    display_name,
                    status,
                    invitation_token_hash,
                    invitation_expires_at,
                    created_by_user_id,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    LOWER(?),
                    ?,
                    'INVITED',
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                accountId,
                input.supplierId(),
                input.email()
                        .trim(),
                input.displayName()
                        .trim(),
                tokenHash,
                Timestamp.from(
                        invitationExpiresAt
                ),
                createdByUserId
        );
    }

    public void activateAccount(
            UUID accountId,
            String passwordHash
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_accounts
                SET
                    status =
                        'ACTIVE',
                    password_hash = ?,
                    invitation_token_hash =
                        NULL,
                    invitation_expires_at =
                        NULL,
                    activated_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'INVITED'
                """,
                passwordHash,
                accountId
        );
    }

    public void updateLastLogin(
            UUID accountId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_accounts
                SET
                    last_login_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                accountId
        );
    }

    public void suspendAccount(
            UUID accountId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_accounts
                SET
                    status =
                        'SUSPENDED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'ACTIVE'
                """,
                accountId
        );
    }

    public void reinstateAccount(
            UUID accountId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_accounts
                SET
                    status =
                        'ACTIVE',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'SUSPENDED'
                """,
                accountId
        );
    }

    public void revokeAccount(
            UUID accountId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_accounts
                SET
                    status =
                        'REVOKED',
                    invitation_token_hash =
                        NULL,
                    invitation_expires_at =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'REVOKED'
                """,
                accountId
        );
    }

    public void createSession(
            UUID sessionId,
            UUID accountId,
            String tokenHash,
            Instant expiresAt
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_portal_sessions (
                    id,
                    account_id,
                    token_hash,
                    expires_at,
                    last_seen_at,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                sessionId,
                accountId,
                tokenHash,
                Timestamp.from(
                        expiresAt
                )
        );
    }

    public SessionRow findActiveSession(
            String tokenHash
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    session.id,
                    session.account_id,
                    account.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    account.email,
                    account.display_name,
                    account.status,

                    session.expires_at,
                    session.last_seen_at,
                    session.created_at

                FROM supplier_portal_sessions
                    session

                JOIN supplier_portal_accounts
                    account
                    ON account.id =
                       session.account_id

                JOIN suppliers supplier
                    ON supplier.id =
                       account.supplier_id

                WHERE session.token_hash = ?

                AND session.revoked_at
                    IS NULL

                AND session.expires_at
                    > CURRENT_TIMESTAMP

                AND account.status =
                    'ACTIVE'
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SessionRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "account_id",
                                        UUID.class
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
                                resultSet.getString(
                                        "email"
                                ),
                                resultSet.getString(
                                        "display_name"
                                ),
                                SupplierPortalAccountStatus.valueOf(
                                        resultSet.getString(
                                                "status"
                                        )
                                ),
                                resultSet.getTimestamp(
                                        "expires_at"
                                )
                                        .toInstant(),
                                resultSet.getTimestamp(
                                        "last_seen_at"
                                )
                                        .toInstant(),
                                resultSet.getTimestamp(
                                        "created_at"
                                )
                                        .toInstant()
                        ),
                tokenHash
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void touchSession(
            UUID sessionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_sessions
                SET
                    last_seen_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                sessionId
        );
    }

    public void revokeSession(
            UUID sessionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_sessions
                SET
                    revoked_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                AND revoked_at
                    IS NULL
                """,
                sessionId
        );
    }

    public void revokeSessionsForAccount(
            UUID accountId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_portal_sessions
                SET
                    revoked_at =
                        CURRENT_TIMESTAMP
                WHERE account_id = ?
                AND revoked_at
                    IS NULL
                """,
                accountId
        );
    }

    public List<PortalWorkspaceRow> workspacesForSupplier(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                portalWorkspaceSql()
                        + """
                        WHERE workspace.supplier_id = ?

                        ORDER BY
                            CASE workspace.status
                                WHEN 'WAITING_SUPPLIER'
                                THEN 1
                                WHEN 'OPEN'
                                THEN 2
                                WHEN 'WAITING_INTERNAL'
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
                        mapPortalWorkspace(
                                resultSet
                        ),
                supplierId
        );
    }

    public PortalWorkspaceRow findSupplierWorkspace(
            UUID supplierId,
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                portalWorkspaceSql()
                        + """
                        WHERE workspace.supplier_id = ?
                        AND workspace.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPortalWorkspace(
                                resultSet
                        ),
                supplierId,
                workspaceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<PortalMessageRow> sharedMessages(
            UUID supplierId,
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    message.id,
                    message.message_type,
                    message.direction,
                    message.body,
                    message.reference_text,

                    COALESCE(
                        author.full_name,
                        message.supplier_contact_name
                    )
                        AS sender_name,

                    message.responds_to_message_id,
                    message.created_at

                FROM supplier_collaboration_messages
                    message

                JOIN supplier_collaboration_workspaces
                    workspace
                    ON workspace.id =
                       message.workspace_id

                LEFT JOIN app_users author
                    ON author.id =
                       message.author_user_id

                WHERE workspace.supplier_id = ?

                AND workspace.id = ?

                AND message.visibility =
                    'SUPPLIER_SHARED'

                ORDER BY
                    message.created_at,
                    message.id
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new PortalMessageRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                CollaborationMessageType.valueOf(
                                        resultSet.getString(
                                                "message_type"
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
                                resultSet.getString(
                                        "sender_name"
                                ),
                                resultSet.getObject(
                                        "responds_to_message_id",
                                        UUID.class
                                ),
                                resultSet.getTimestamp(
                                        "created_at"
                                )
                                        .toInstant()
                        ),
                supplierId,
                workspaceId
        );
    }

    public List<PortalActionRow> supplierActions(
            UUID supplierId,
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    action.id,
                    action.action_type,
                    action.title,
                    action.description,
                    action.external_assignee_label,
                    action.due_at,
                    action.status,
                    action.completion_note,
                    action.completed_at

                FROM supplier_collaboration_actions
                    action

                JOIN supplier_collaboration_workspaces
                    workspace
                    ON workspace.id =
                       action.workspace_id

                WHERE workspace.supplier_id = ?

                AND workspace.id = ?

                AND action.audience =
                    'SUPPLIER'

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
                ) -> {
                    Timestamp completed =
                            resultSet.getTimestamp(
                                    "completed_at"
                            );

                    return new PortalActionRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            CollaborationActionType.valueOf(
                                    resultSet.getString(
                                            "action_type"
                                    )
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "description"
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
                                    : completed.toInstant()
                    );
                },
                supplierId,
                workspaceId
        );
    }

    public PortalActionScopeRow findSupplierAction(
            UUID supplierId,
            UUID actionId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    action.id,
                    action.workspace_id,
                    action.action_type,
                    action.status,

                    workspace.status
                        AS workspace_status

                FROM supplier_collaboration_actions
                    action

                JOIN supplier_collaboration_workspaces
                    workspace
                    ON workspace.id =
                       action.workspace_id

                WHERE action.id = ?

                AND workspace.supplier_id = ?

                AND action.audience =
                    'SUPPLIER'
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new PortalActionScopeRow(
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
                                CollaborationActionStatus.valueOf(
                                        resultSet.getString(
                                                "status"
                                        )
                                ),
                                CollaborationWorkspaceStatus.valueOf(
                                        resultSet.getString(
                                                "workspace_status"
                                        )
                                )
                        ),
                actionId,
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public UUID latestAwaitingSupplierMessage(
            UUID supplierId,
            UUID workspaceId
    ) {
        return jdbcTemplate.query(
                """
                SELECT outbound.id

                FROM supplier_collaboration_messages
                    outbound

                JOIN supplier_collaboration_workspaces
                    workspace
                    ON workspace.id =
                       outbound.workspace_id

                WHERE workspace.supplier_id = ?

                AND workspace.id = ?

                AND outbound.direction =
                    'TO_SUPPLIER'

                AND outbound.visibility =
                    'SUPPLIER_SHARED'

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
                supplierId,
                workspaceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void recordSupplierResponse(
            UUID messageId,
            UUID workspaceId,
            CollaborationMessageType messageType,
            String body,
            String referenceText,
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
                    supplier_contact_name,
                    responds_to_message_id,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    'SUPPLIER_SHARED',
                    'FROM_SUPPLIER',
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
                body.trim(),
                normalizeOptional(
                        referenceText
                ),
                supplierContactName,
                respondsToMessageId
        );

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

    public void completeSupplierAction(
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
                AND audience =
                    'SUPPLIER'
                AND status IN (
                    'OPEN',
                    'IN_PROGRESS'
                )
                """,
                note.trim(),
                actionId
        );
    }

    public void writeAudit(
            UUID accountId,
            UUID supplierId,
            String eventType,
            String details
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_portal_audit_events (
                    id,
                    account_id,
                    supplier_id,
                    event_type,
                    details,
                    created_at
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                accountId,
                supplierId,
                eventType,
                normalizeOptional(
                        details
                )
        );
    }

    private String accountSql() {
        return """
                SELECT
                    account.id,
                    account.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    account.email,
                    account.display_name,
                    account.status,
                    account.password_hash,
                    account.invitation_token_hash,
                    account.invitation_expires_at,
                    account.activated_at,
                    account.last_login_at,
                    account.created_at,
                    account.updated_at,
                    account.version

                FROM supplier_portal_accounts
                    account

                JOIN suppliers supplier
                    ON supplier.id =
                       account.supplier_id

                """;
    }

    private String portalWorkspaceSql() {
        return """
                SELECT
                    workspace.id,
                    workspace.workspace_number,
                    workspace.workspace_type,
                    workspace.status,
                    workspace.priority,
                    workspace.title,

                    purchase_order.po_number
                        AS purchase_order_number,

                    rfq.rfq_number,

                    workspace.external_reference,
                    workspace.supplier_response_sla_hours,
                    workspace.response_due_at,
                    workspace.last_message_at,

                    (
                        SELECT COUNT(*)
                        FROM supplier_collaboration_actions
                            action
                        WHERE
                            action.workspace_id =
                                workspace.id
                        AND action.audience =
                            'SUPPLIER'
                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_supplier_actions,

                    (
                        SELECT COUNT(*)
                        FROM supplier_collaboration_actions
                            action
                        WHERE
                            action.workspace_id =
                                workspace.id
                        AND action.audience =
                            'SUPPLIER'
                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND action.due_at
                            < CURRENT_TIMESTAMP
                    )
                        AS overdue_supplier_actions,

                    workspace.created_at,
                    workspace.updated_at

                FROM supplier_collaboration_workspaces
                    workspace

                LEFT JOIN purchase_orders
                    purchase_order
                    ON purchase_order.id =
                       workspace.purchase_order_id

                LEFT JOIN rfqs rfq
                    ON rfq.id =
                       workspace.rfq_id

                """;
    }

    private AccountRow mapAccount(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp invitationExpires =
                resultSet.getTimestamp(
                        "invitation_expires_at"
                );

        Timestamp activated =
                resultSet.getTimestamp(
                        "activated_at"
                );

        Timestamp lastLogin =
                resultSet.getTimestamp(
                        "last_login_at"
                );

        return new AccountRow(
                resultSet.getObject(
                        "id",
                        UUID.class
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
                resultSet.getString(
                        "email"
                ),
                resultSet.getString(
                        "display_name"
                ),
                SupplierPortalAccountStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "password_hash"
                ),
                resultSet.getString(
                        "invitation_token_hash"
                ),
                invitationExpires == null
                        ? null
                        : invitationExpires.toInstant(),
                activated == null
                        ? null
                        : activated.toInstant(),
                lastLogin == null
                        ? null
                        : lastLogin.toInstant(),
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

    private PortalWorkspaceRow mapPortalWorkspace(
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

        return new PortalWorkspaceRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "workspace_number"
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
                resultSet.getString(
                        "purchase_order_number"
                ),
                resultSet.getString(
                        "rfq_number"
                ),
                resultSet.getString(
                        "external_reference"
                ),
                resultSet.getInt(
                        "supplier_response_sla_hours"
                ),
                responseDue == null
                        ? null
                        : responseDue.toInstant(),
                resultSet.getLong(
                        "open_supplier_actions"
                ),
                resultSet.getLong(
                        "overdue_supplier_actions"
                ),
                lastMessage == null
                        ? null
                        : lastMessage.toInstant(),
                resultSet.getTimestamp(
                        "created_at"
                )
                        .toInstant(),
                resultSet.getTimestamp(
                        "updated_at"
                )
                        .toInstant()
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

    public record AccountRow(
            UUID id,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String email,
            String displayName,
            SupplierPortalAccountStatus status,
            String passwordHash,
            String invitationTokenHash,
            Instant invitationExpiresAt,
            Instant activatedAt,
            Instant lastLoginAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record SessionRow(
            UUID id,
            UUID accountId,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String email,
            String displayName,
            SupplierPortalAccountStatus accountStatus,
            Instant expiresAt,
            Instant lastSeenAt,
            Instant createdAt
    ) {
    }

    public record PortalWorkspaceRow(
            UUID id,
            String workspaceNumber,
            CollaborationWorkspaceType workspaceType,
            CollaborationWorkspaceStatus status,
            CollaborationPriority priority,
            String title,
            String purchaseOrderNumber,
            String rfqNumber,
            String externalReference,
            int supplierResponseSlaHours,
            Instant responseDueAt,
            long openSupplierActions,
            long overdueSupplierActions,
            Instant lastMessageAt,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    public record PortalMessageRow(
            UUID id,
            CollaborationMessageType messageType,
            CollaborationMessageDirection direction,
            String body,
            String referenceText,
            String senderName,
            UUID respondsToMessageId,
            Instant createdAt
    ) {
    }

    public record PortalActionRow(
            UUID id,
            CollaborationActionType actionType,
            String title,
            String description,
            String assigneeLabel,
            Instant dueAt,
            CollaborationActionStatus status,
            String completionNote,
            Instant completedAt
    ) {
    }

    public record PortalActionScopeRow(
            UUID id,
            UUID workspaceId,
            CollaborationActionType actionType,
            CollaborationActionStatus status,
            CollaborationWorkspaceStatus workspaceStatus
    ) {
    }
}
