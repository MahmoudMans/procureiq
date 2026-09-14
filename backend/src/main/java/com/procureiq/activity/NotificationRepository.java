package com.procureiq.activity;

import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class NotificationRepository {

    private final JdbcTemplate jdbcTemplate;

    public NotificationRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void refreshForUser(
            UUID userId,
            ProcurementRole role
    ) {
        refreshApprovals(
                userId,
                role
        );

        if (
                role == ProcurementRole.ADMIN
                ||
                role == ProcurementRole.PROCUREMENT_MANAGER
                ||
                role == ProcurementRole.BUYER
        ) {
            refreshOverdueOrders(
                    userId
            );

            refreshRfqDeadlines(
                    userId
            );

            refreshAwardedWithoutOrder(
                    userId
            );
        }
    }

    private void refreshApprovals(
            UUID userId,
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.APPROVER
        ) {
            return;
        }

        jdbcTemplate.update(
                """
                INSERT INTO user_notifications (
                    user_id,
                    notification_key,
                    notification_type,
                    severity,
                    title,
                    message,
                    entity_type,
                    entity_id,
                    href
                )
                SELECT
                    ?,
                    'APPROVAL:' || task.id::text,
                    'APPROVAL_REQUIRED',
                    'HIGH',
                    'Approval required',
                    'Purchase request '
                        || request.request_number
                        || ' is awaiting your decision.',
                    'APPROVAL',
                    task.id,
                    '/approvals'
                FROM approval_tasks task
                JOIN purchase_requests request
                    ON request.id =
                       task.purchase_request_id
                WHERE task.status = 'PENDING'
                AND (
                    ? = 'ADMIN'
                    OR task.required_role = ?
                )
                ON CONFLICT (
                    user_id,
                    notification_key
                )
                DO NOTHING
                """,
                userId,
                role.name(),
                role.name()
        );
    }

    private void refreshOverdueOrders(
            UUID userId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO user_notifications (
                    user_id,
                    notification_key,
                    notification_type,
                    severity,
                    title,
                    message,
                    entity_type,
                    entity_id,
                    href
                )
                SELECT
                    ?,
                    'OVERDUE_PO:'
                        || purchase_order.id::text,
                    'OVERDUE_DELIVERY',
                    'HIGH',
                    'Delivery overdue',
                    'Purchase order '
                        || purchase_order.po_number
                        || ' for '
                        || supplier.legal_name
                        || ' is past its expected delivery date.',
                    'PURCHASE_ORDER',
                    purchase_order.id,
                    '/purchase-orders/'
                        || purchase_order.id::text
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED'
                )
                AND purchase_order.expected_delivery_date
                    < CURRENT_DATE
                ON CONFLICT (
                    user_id,
                    notification_key
                )
                DO NOTHING
                """,
                userId
        );
    }

    private void refreshRfqDeadlines(
            UUID userId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO user_notifications (
                    user_id,
                    notification_key,
                    notification_type,
                    severity,
                    title,
                    message,
                    entity_type,
                    entity_id,
                    href
                )
                SELECT
                    ?,
                    'RFQ_DEADLINE:'
                        || rfq.id::text,
                    'RFQ_DEADLINE',
                    'WARNING',
                    'RFQ deadline approaching',
                    rfq.rfq_number
                        || ' closes within 48 hours.',
                    'RFQ',
                    rfq.id,
                    '/rfqs/'
                        || rfq.id::text
                FROM rfqs rfq
                WHERE rfq.status = 'PUBLISHED'
                AND rfq.response_deadline
                    > CURRENT_TIMESTAMP
                AND rfq.response_deadline
                    <= CURRENT_TIMESTAMP
                       + INTERVAL '48 hours'
                ON CONFLICT (
                    user_id,
                    notification_key
                )
                DO NOTHING
                """,
                userId
        );
    }

    private void refreshAwardedWithoutOrder(
            UUID userId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO user_notifications (
                    user_id,
                    notification_key,
                    notification_type,
                    severity,
                    title,
                    message,
                    entity_type,
                    entity_id,
                    href
                )
                SELECT
                    ?,
                    'AWARD_TO_PO:'
                        || rfq.id::text,
                    'AWARD_TO_ORDER',
                    'INFO',
                    'Award ready for purchase order',
                    rfq.rfq_number
                        || ' has been awarded and is ready for PO creation.',
                    'RFQ',
                    rfq.id,
                    '/purchase-orders/new'
                FROM rfqs rfq
                LEFT JOIN purchase_orders purchase_order
                    ON purchase_order.rfq_id =
                       rfq.id
                WHERE rfq.status = 'AWARDED'
                AND purchase_order.id IS NULL
                ON CONFLICT (
                    user_id,
                    notification_key
                )
                DO NOTHING
                """,
                userId
        );
    }

    public List<NotificationRow> findForUser(
            UUID userId,
            boolean unreadOnly
    ) {
        String sql =
                """
                SELECT
                    id,
                    notification_type,
                    severity,
                    title,
                    message,
                    entity_type,
                    entity_id,
                    href,
                    read_at,
                    created_at
                FROM user_notifications
                WHERE user_id = ?
                """
                +
                (
                        unreadOnly
                                ? " AND read_at IS NULL "
                                : " "
                )
                +
                """
                ORDER BY
                    created_at DESC,
                    id DESC
                LIMIT 200
                """;

        return jdbcTemplate.query(
                sql,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp readAt =
                            resultSet.getTimestamp(
                                    "read_at"
                            );

                    Timestamp createdAt =
                            resultSet.getTimestamp(
                                    "created_at"
                            );

                    return new NotificationRow(
                            resultSet.getLong("id"),
                            resultSet.getString(
                                    "notification_type"
                            ),
                            resultSet.getString(
                                    "severity"
                            ),
                            resultSet.getString(
                                    "title"
                            ),
                            resultSet.getString(
                                    "message"
                            ),
                            resultSet.getString(
                                    "entity_type"
                            ),
                            resultSet.getObject(
                                    "entity_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "href"
                            ),
                            readAt == null
                                    ? null
                                    : readAt.toInstant(),
                            createdAt.toInstant()
                    );
                },
                userId
        );
    }

    public long unreadCount(
            UUID userId
    ) {
        Long count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM user_notifications
                        WHERE user_id = ?
                        AND read_at IS NULL
                        """,
                        Long.class,
                        userId
                );

        return count == null
                ? 0
                : count;
    }

    public void markRead(
            UUID userId,
            long notificationId
    ) {
        jdbcTemplate.update(
                """
                UPDATE user_notifications
                SET read_at =
                    COALESCE(
                        read_at,
                        CURRENT_TIMESTAMP
                    )
                WHERE id = ?
                AND user_id = ?
                """,
                notificationId,
                userId
        );
    }

    public void markAllRead(
            UUID userId
    ) {
        jdbcTemplate.update(
                """
                UPDATE user_notifications
                SET read_at =
                    CURRENT_TIMESTAMP
                WHERE user_id = ?
                AND read_at IS NULL
                """,
                userId
        );
    }

    public record NotificationRow(
            long id,
            String notificationType,
            String severity,
            String title,
            String message,
            String entityType,
            UUID entityId,
            String href,
            Instant readAt,
            Instant createdAt
    ) {
    }
}
