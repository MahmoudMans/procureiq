package com.procureiq.compliance;

import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class PolicyComplianceRepository {

    private final JdbcTemplate jdbcTemplate;

    public PolicyComplianceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public void createPolicy(
            UUID id,
            ProcurementPolicyInput input,
            UUID ownerUserId,
            String policyCode,
            String currency
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_policies (
                    id,
                    policy_code,
                    name,
                    description,
                    policy_type,
                    severity,
                    status,
                    threshold_amount,
                    currency,
                    requires_waiver,
                    owner_user_id,
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
                    'ACTIVE',
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                policyCode,
                input.name().trim(),
                normalizeOptional(
                        input.description()
                ),
                input.policyType().name(),
                input.severity().name(),
                input.thresholdAmount(),
                currency,
                input.requiresWaiver(),
                ownerUserId
        );
    }

    public void updatePolicyStatus(
            UUID policyId,
            ProcurementPolicyStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_policies
                SET
                    status = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                status.name(),
                policyId
        );
    }

    public PolicyRow findPolicy(
            UUID policyId
    ) {
        return jdbcTemplate.query(
                policySql()
                        + """
                        WHERE policy.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPolicy(
                                resultSet
                        ),
                policyId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<PolicyRow> findPolicies() {
        return jdbcTemplate.query(
                policySql()
                        + """
                        ORDER BY
                            CASE policy.status
                                WHEN 'ACTIVE'
                                THEN 1
                                ELSE 2
                            END,
                            policy.name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPolicy(
                                resultSet
                        )
        );
    }

    public List<PolicyRow> findActivePolicies() {
        return jdbcTemplate.query(
                policySql()
                        + """
                        WHERE policy.status =
                            'ACTIVE'
                        ORDER BY
                            policy.name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPolicy(
                                resultSet
                        )
        );
    }

    public List<CandidateRow> competitiveSourcingCandidates(
            BigDecimal threshold,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    request.id,
                    request.request_number
                        AS source_reference,
                    request.estimated_total_amount
                        AS source_amount,
                    request.currency,
                    request.title
                FROM purchase_requests request
                WHERE request.status IN (
                    'SUBMITTED',
                    'APPROVED'
                )
                AND request.estimated_total_amount >= ?
                AND (
                    ? IS NULL
                    OR request.currency = ?
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM rfqs rfq
                    WHERE
                        rfq.source_purchase_request_id =
                            request.id
                    AND rfq.status
                        <> 'CANCELLED'
                )
                ORDER BY
                    request.estimated_total_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CandidateRow(
                                PolicyViolationSourceType.PURCHASE_REQUEST,
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "source_reference"
                                ),
                                resultSet.getBigDecimal(
                                        "source_amount"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                "Purchase request "
                                        + resultSet.getString(
                                                "source_reference"
                                        )
                                        + " exceeds the competitive-sourcing threshold but has no active RFQ."
                        ),
                threshold,
                currency,
                currency
        );
    }

    public List<CandidateRow> purchaseOrderRequiredCandidates(
            BigDecimal threshold,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    request.id,
                    request.request_number
                        AS source_reference,
                    request.estimated_total_amount
                        AS source_amount,
                    request.currency,
                    request.title
                FROM purchase_requests request
                WHERE request.status =
                    'APPROVED'
                AND request.estimated_total_amount >= ?
                AND (
                    ? IS NULL
                    OR request.currency = ?
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM rfqs rfq
                    JOIN purchase_orders purchase_order
                        ON purchase_order.rfq_id =
                           rfq.id
                    WHERE
                        rfq.source_purchase_request_id =
                            request.id
                    AND purchase_order.status
                        <> 'CANCELLED'
                )
                ORDER BY
                    request.estimated_total_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CandidateRow(
                                PolicyViolationSourceType.PURCHASE_REQUEST,
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "source_reference"
                                ),
                                resultSet.getBigDecimal(
                                        "source_amount"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                "Approved purchase request "
                                        + resultSet.getString(
                                                "source_reference"
                                        )
                                        + " exceeds the PO-required threshold but has no non-cancelled purchase order."
                        ),
                threshold,
                currency,
                currency
        );
    }

    public List<CandidateRow> contractRequiredCandidates(
            BigDecimal threshold,
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id,
                    purchase_order.po_number
                        AS source_reference,
                    purchase_order.total_amount
                        AS source_amount,
                    purchase_order.currency,
                    supplier.legal_name
                        AS supplier_name
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                WHERE purchase_order.status
                    <> 'CANCELLED'
                AND purchase_order.total_amount >= ?
                AND (
                    ? IS NULL
                    OR purchase_order.currency = ?
                )
                AND NOT EXISTS (
                    SELECT 1
                    FROM supplier_contracts contract
                    WHERE
                        contract.supplier_id =
                            purchase_order.supplier_id
                    AND contract.status =
                        'ACTIVE'
                    AND contract.end_date
                        >= CURRENT_DATE
                )
                ORDER BY
                    purchase_order.total_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CandidateRow(
                                PolicyViolationSourceType.PURCHASE_ORDER,
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "source_reference"
                                ),
                                resultSet.getBigDecimal(
                                        "source_amount"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                "Purchase order "
                                        + resultSet.getString(
                                                "source_reference"
                                        )
                                        + " for "
                                        + resultSet.getString(
                                                "supplier_name"
                                        )
                                        + " exceeds the contract-required threshold but no active supplier contract was found."
                        ),
                threshold,
                currency,
                currency
        );
    }

    public List<CandidateRow> highRiskSupplierCandidates(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id,
                    purchase_order.po_number
                        AS source_reference,
                    purchase_order.total_amount
                        AS source_amount,
                    purchase_order.currency,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.risk_level
                FROM purchase_orders purchase_order
                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id
                WHERE purchase_order.status
                    <> 'CANCELLED'
                AND supplier.risk_level IN (
                    'HIGH',
                    'CRITICAL'
                )
                AND (
                    ? IS NULL
                    OR purchase_order.currency = ?
                )
                ORDER BY
                    CASE supplier.risk_level
                        WHEN 'CRITICAL'
                        THEN 1
                        ELSE 2
                    END,
                    purchase_order.total_amount DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new CandidateRow(
                                PolicyViolationSourceType.PURCHASE_ORDER,
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "source_reference"
                                ),
                                resultSet.getBigDecimal(
                                        "source_amount"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                "Purchase order "
                                        + resultSet.getString(
                                                "source_reference"
                                        )
                                        + " uses "
                                        + resultSet.getString(
                                                "supplier_name"
                                        )
                                        + ", currently classified as "
                                        + resultSet.getString(
                                                "risk_level"
                                        )
                                        + " supplier risk."
                        ),
                currency,
                currency
        );
    }

    public ViolationRow findViolationBySourceKey(
            String sourceKey
    ) {
        return jdbcTemplate.query(
                violationSql()
                        + """
                        WHERE violation.source_key = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapViolation(
                                resultSet
                        ),
                sourceKey
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createViolation(
            UUID id,
            UUID policyId,
            String sourceKey,
            CandidateRow candidate,
            ProcurementPolicySeverity severity
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_policy_violations (
                    id,
                    policy_id,
                    source_key,
                    source_type,
                    source_id,
                    source_reference,
                    source_amount,
                    currency,
                    severity,
                    status,
                    details,
                    detected_at,
                    last_checked_at,
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
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                policyId,
                sourceKey,
                candidate.sourceType()
                        .name(),
                candidate.sourceId(),
                candidate.sourceReference(),
                candidate.sourceAmount(),
                candidate.currency(),
                severity.name(),
                candidate.details()
        );
    }

    public void refreshViolation(
            UUID violationId,
            CandidateRow candidate,
            ProcurementPolicySeverity severity
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_policy_violations
                SET
                    source_reference = ?,
                    source_amount = ?,
                    currency = ?,
                    severity = ?,
                    details = ?,
                    last_checked_at =
                        CURRENT_TIMESTAMP,
                    status =
                        CASE
                            WHEN status IN (
                                'RESOLVED',
                                'DISMISSED'
                            )
                            THEN 'OPEN'
                            ELSE status
                        END,
                    resolved_by_user_id =
                        CASE
                            WHEN status IN (
                                'RESOLVED',
                                'DISMISSED'
                            )
                            THEN NULL
                            ELSE resolved_by_user_id
                        END,
                    resolution_note =
                        CASE
                            WHEN status IN (
                                'RESOLVED',
                                'DISMISSED'
                            )
                            THEN NULL
                            ELSE resolution_note
                        END,
                    resolved_at =
                        CASE
                            WHEN status IN (
                                'RESOLVED',
                                'DISMISSED'
                            )
                            THEN NULL
                            ELSE resolved_at
                        END,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                candidate.sourceReference(),
                candidate.sourceAmount(),
                candidate.currency(),
                severity.name(),
                candidate.details(),
                violationId
        );
    }

    public List<ViolationRow> findViolations() {
        return jdbcTemplate.query(
                violationSql()
                        + """
                        ORDER BY
                            CASE violation.severity
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,
                            CASE violation.status
                                WHEN 'OPEN'
                                THEN 1
                                WHEN 'WAIVER_REQUESTED'
                                THEN 2
                                ELSE 3
                            END,
                            violation.detected_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapViolation(
                                resultSet
                        )
        );
    }

    public ViolationRow findViolation(
            UUID violationId
    ) {
        return jdbcTemplate.query(
                violationSql()
                        + """
                        WHERE violation.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapViolation(
                                resultSet
                        ),
                violationId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public Long nextWaiverSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'policy_waiver_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createWaiver(
            UUID id,
            String waiverNumber,
            UUID violationId,
            String rationale,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_policy_waivers (
                    id,
                    waiver_number,
                    violation_id,
                    rationale,
                    status,
                    requested_by_user_id,
                    requested_at,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    'SUBMITTED',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                waiverNumber,
                violationId,
                rationale.trim(),
                currentUserId
        );

        jdbcTemplate.update(
                """
                UPDATE procurement_policy_violations
                SET
                    status =
                        'WAIVER_REQUESTED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                violationId
        );
    }

    public void decideWaiver(
            UUID waiverId,
            PolicyWaiverStatus status,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_policy_waivers
                SET
                    status = ?,
                    decided_by_user_id = ?,
                    decision_note = ?,
                    decided_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'SUBMITTED'
                """,
                status.name(),
                currentUserId,
                note.trim(),
                waiverId
        );

        jdbcTemplate.update(
                """
                UPDATE procurement_policy_violations
                SET
                    status =
                        CASE
                            WHEN ? =
                                'APPROVED'
                            THEN 'WAIVED'
                            ELSE 'OPEN'
                        END,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = (
                    SELECT violation_id
                    FROM procurement_policy_waivers
                    WHERE id = ?
                )
                """,
                status.name(),
                waiverId
        );
    }

    public WaiverRow findWaiver(
            UUID waiverId
    ) {
        return jdbcTemplate.query(
                waiverSql()
                        + """
                        WHERE waiver.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapWaiver(
                                resultSet
                        ),
                waiverId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<WaiverRow> findWaivers(
            UUID violationId
    ) {
        return jdbcTemplate.query(
                waiverSql()
                        + """
                        WHERE waiver.violation_id = ?
                        ORDER BY
                            waiver.requested_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapWaiver(
                                resultSet
                        ),
                violationId
        );
    }

    public void addEvidence(
            UUID id,
            UUID violationId,
            PolicyEvidenceInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO procurement_policy_evidence (
                    id,
                    violation_id,
                    evidence_type,
                    content,
                    added_by_user_id,
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
                id,
                violationId,
                input.evidenceType()
                        .name(),
                input.content()
                        .trim(),
                currentUserId
        );
    }

    public List<EvidenceRow> findEvidence(
            UUID violationId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    evidence.id,
                    evidence.violation_id,
                    evidence.evidence_type,
                    evidence.content,
                    evidence.added_by_user_id,
                    app_user.full_name
                        AS added_by_name,
                    evidence.created_at
                FROM procurement_policy_evidence
                    evidence
                JOIN app_users app_user
                    ON app_user.id =
                       evidence.added_by_user_id
                WHERE evidence.violation_id = ?
                ORDER BY
                    evidence.created_at DESC
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp created =
                            resultSet.getTimestamp(
                                    "created_at"
                            );

                    return new EvidenceRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "violation_id",
                                    UUID.class
                            ),
                            PolicyEvidenceType
                                    .valueOf(
                                            resultSet.getString(
                                                    "evidence_type"
                                            )
                                    ),
                            resultSet.getString(
                                    "content"
                            ),
                            resultSet.getObject(
                                    "added_by_user_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "added_by_name"
                            ),
                            created.toInstant()
                    );
                },
                violationId
        );
    }

    public void resolveViolation(
            UUID violationId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE procurement_policy_violations
                SET
                    status =
                        'RESOLVED',
                    resolved_by_user_id = ?,
                    resolution_note = ?,
                    resolved_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                currentUserId,
                note.trim(),
                violationId
        );
    }

    public List<ComplianceUserOptionResponse> users() {
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
                        new ComplianceUserOptionResponse(
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

    private String policySql() {
        return """
                SELECT
                    policy.id,
                    policy.policy_code,
                    policy.name,
                    policy.description,
                    policy.policy_type,
                    policy.severity,
                    policy.status,
                    policy.threshold_amount,
                    policy.currency,
                    policy.requires_waiver,
                    policy.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    (
                        SELECT COUNT(*)
                        FROM procurement_policy_violations
                            violation
                        WHERE
                            violation.policy_id =
                                policy.id
                        AND violation.status IN (
                            'OPEN',
                            'WAIVER_REQUESTED'
                        )
                    )
                        AS open_violations,

                    policy.created_at,
                    policy.updated_at,
                    policy.version

                FROM procurement_policies policy

                JOIN app_users owner
                    ON owner.id =
                       policy.owner_user_id

                """;
    }

    private String violationSql() {
        return """
                SELECT
                    violation.id,

                    violation.policy_id,
                    policy.policy_code,
                    policy.name
                        AS policy_name,
                    policy.policy_type,

                    violation.source_key,
                    violation.source_type,
                    violation.source_id,
                    violation.source_reference,
                    violation.source_amount,
                    violation.currency,

                    violation.severity,
                    violation.status,
                    violation.details,

                    owner.full_name
                        AS policy_owner_name,

                    violation.detected_at,
                    violation.last_checked_at,

                    violation.resolution_note,
                    violation.resolved_at,

                    resolver.full_name
                        AS resolved_by_name,

                    violation.created_at,
                    violation.updated_at,
                    violation.version

                FROM procurement_policy_violations
                    violation

                JOIN procurement_policies policy
                    ON policy.id =
                       violation.policy_id

                JOIN app_users owner
                    ON owner.id =
                       policy.owner_user_id

                LEFT JOIN app_users resolver
                    ON resolver.id =
                       violation.resolved_by_user_id

                """;
    }

    private String waiverSql() {
        return """
                SELECT
                    waiver.id,
                    waiver.waiver_number,
                    waiver.violation_id,
                    waiver.rationale,
                    waiver.status,
                    waiver.requested_by_user_id,

                    requester.full_name
                        AS requested_by_name,

                    waiver.requested_at,

                    waiver.decision_note,

                    decider.full_name
                        AS decided_by_name,

                    waiver.decided_at,
                    waiver.created_at,
                    waiver.updated_at,
                    waiver.version

                FROM procurement_policy_waivers
                    waiver

                JOIN app_users requester
                    ON requester.id =
                       waiver.requested_by_user_id

                LEFT JOIN app_users decider
                    ON decider.id =
                       waiver.decided_by_user_id

                """;
    }

    private PolicyRow mapPolicy(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new PolicyRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "policy_code"
                ),
                resultSet.getString(
                        "name"
                ),
                resultSet.getString(
                        "description"
                ),
                ProcurementPolicyType
                        .valueOf(
                                resultSet.getString(
                                        "policy_type"
                                )
                        ),
                ProcurementPolicySeverity
                        .valueOf(
                                resultSet.getString(
                                        "severity"
                                )
                        ),
                ProcurementPolicyStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                resultSet.getBigDecimal(
                        "threshold_amount"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBoolean(
                        "requires_waiver"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getLong(
                        "open_violations"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ViolationRow mapViolation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp detected =
                resultSet.getTimestamp(
                        "detected_at"
                );

        Timestamp checked =
                resultSet.getTimestamp(
                        "last_checked_at"
                );

        Timestamp resolved =
                resultSet.getTimestamp(
                        "resolved_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new ViolationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "policy_id",
                        UUID.class
                ),
                resultSet.getString(
                        "policy_code"
                ),
                resultSet.getString(
                        "policy_name"
                ),
                ProcurementPolicyType
                        .valueOf(
                                resultSet.getString(
                                        "policy_type"
                                )
                        ),
                resultSet.getString(
                        "source_key"
                ),
                PolicyViolationSourceType
                        .valueOf(
                                resultSet.getString(
                                        "source_type"
                                )
                        ),
                resultSet.getObject(
                        "source_id",
                        UUID.class
                ),
                resultSet.getString(
                        "source_reference"
                ),
                resultSet.getBigDecimal(
                        "source_amount"
                ),
                resultSet.getString(
                        "currency"
                ),
                ProcurementPolicySeverity
                        .valueOf(
                                resultSet.getString(
                                        "severity"
                                )
                        ),
                PolicyViolationStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                resultSet.getString(
                        "details"
                ),
                resultSet.getString(
                        "policy_owner_name"
                ),
                detected.toInstant(),
                checked.toInstant(),
                resultSet.getString(
                        "resolution_note"
                ),
                resolved == null
                        ? null
                        : resolved.toInstant(),
                resultSet.getString(
                        "resolved_by_name"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private WaiverRow mapWaiver(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp requested =
                resultSet.getTimestamp(
                        "requested_at"
                );

        Timestamp decided =
                resultSet.getTimestamp(
                        "decided_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new WaiverRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "waiver_number"
                ),
                resultSet.getObject(
                        "violation_id",
                        UUID.class
                ),
                resultSet.getString(
                        "rationale"
                ),
                PolicyWaiverStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                resultSet.getObject(
                        "requested_by_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "requested_by_name"
                ),
                requested.toInstant(),
                resultSet.getString(
                        "decision_note"
                ),
                resultSet.getString(
                        "decided_by_name"
                ),
                decided == null
                        ? null
                        : decided.toInstant(),
                created.toInstant(),
                updated.toInstant(),
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

    public record PolicyRow(
            UUID id,
            String policyCode,
            String name,
            String description,
            ProcurementPolicyType policyType,
            ProcurementPolicySeverity severity,
            ProcurementPolicyStatus status,
            BigDecimal thresholdAmount,
            String currency,
            boolean requiresWaiver,
            UUID ownerUserId,
            String ownerName,
            long openViolations,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record CandidateRow(
            PolicyViolationSourceType sourceType,
            UUID sourceId,
            String sourceReference,
            BigDecimal sourceAmount,
            String currency,
            String details
    ) {
    }

    public record ViolationRow(
            UUID id,
            UUID policyId,
            String policyCode,
            String policyName,
            ProcurementPolicyType policyType,
            String sourceKey,
            PolicyViolationSourceType sourceType,
            UUID sourceId,
            String sourceReference,
            BigDecimal sourceAmount,
            String currency,
            ProcurementPolicySeverity severity,
            PolicyViolationStatus status,
            String details,
            String policyOwnerName,
            Instant detectedAt,
            Instant lastCheckedAt,
            String resolutionNote,
            Instant resolvedAt,
            String resolvedByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record WaiverRow(
            UUID id,
            String waiverNumber,
            UUID violationId,
            String rationale,
            PolicyWaiverStatus status,
            UUID requestedByUserId,
            String requestedByName,
            Instant requestedAt,
            String decisionNote,
            String decidedByName,
            Instant decidedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record EvidenceRow(
            UUID id,
            UUID violationId,
            PolicyEvidenceType evidenceType,
            String content,
            UUID addedByUserId,
            String addedByName,
            Instant createdAt
    ) {
    }
}
