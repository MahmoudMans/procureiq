package com.procureiq.commercialgovernance;

import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class CommercialGovernanceRepository {

    private final JdbcTemplate jdbcTemplate;

    public CommercialGovernanceRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public ContractRow findContract(
            UUID contractId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    contract.id,
                    contract.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    contract.status
                        AS contract_status,
                    contract.end_date,

                    EXISTS (
                        SELECT 1
                        FROM contract_commercial_governance governance
                        WHERE governance.contract_id =
                            contract.id
                    )
                        AS governance_configured

                FROM supplier_contracts contract

                JOIN suppliers supplier
                    ON supplier.id =
                       contract.supplier_id

                WHERE contract.id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapContract(
                                resultSet
                        ),
                contractId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ContractGovernanceOptionResponse> contracts() {
        return jdbcTemplate.query(
                """
                SELECT
                    contract.id,
                    contract.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    contract.status
                        AS contract_status,
                    contract.end_date,

                    EXISTS (
                        SELECT 1
                        FROM contract_commercial_governance governance
                        WHERE governance.contract_id =
                            contract.id
                    )
                        AS governance_configured

                FROM supplier_contracts contract

                JOIN suppliers supplier
                    ON supplier.id =
                       contract.supplier_id

                ORDER BY
                    contract.end_date,
                    supplier.legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ContractGovernanceOptionResponse(
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
                                        "contract_status"
                                ),
                                resultSet.getObject(
                                        "end_date",
                                        LocalDate.class
                                ),
                                resultSet.getBoolean(
                                        "governance_configured"
                                )
                        )
        );
    }

    public void createGovernance(
            UUID id,
            ContractRow contract,
            CommercialGovernanceInput input,
            UUID ownerUserId,
            String currency,
            LocalDate noticeDeadline
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO contract_commercial_governance (
                    id,
                    contract_id,
                    supplier_id,
                    status,
                    renewal_status,
                    contract_end_date_snapshot,
                    notice_period_days,
                    notice_deadline,
                    baseline_contract_value,
                    currency,
                    price_escalation_pct,
                    max_po_variance_pct,
                    auto_renewal,
                    owner_user_id,
                    notes,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    'ACTIVE',
                    'UPCOMING',
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
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                contract.id(),
                contract.supplierId(),
                contract.endDate(),
                input.noticePeriodDays(),
                noticeDeadline,
                input.baselineContractValue(),
                currency,
                input.priceEscalationPct(),
                input.maxPoVariancePct(),
                input.autoRenewal(),
                ownerUserId,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public GovernanceRow findGovernance(
            UUID governanceId
    ) {
        return jdbcTemplate.query(
                governanceSql()
                        + """
                        WHERE governance.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapGovernance(
                                resultSet
                        ),
                governanceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public GovernanceRow findGovernanceByContract(
            UUID contractId
    ) {
        return jdbcTemplate.query(
                governanceSql()
                        + """
                        WHERE governance.contract_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapGovernance(
                                resultSet
                        ),
                contractId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<GovernanceRow> findGovernanceRecords(
            String currency
    ) {
        return jdbcTemplate.query(
                governanceSql()
                        + """
                        WHERE governance.currency = ?
                        ORDER BY
                            CASE governance.renewal_status
                                WHEN 'UNDER_REVIEW'
                                THEN 1
                                WHEN 'UPCOMING'
                                THEN 2
                                WHEN 'RENEGOTIATE'
                                THEN 3
                                WHEN 'RENEW'
                                THEN 4
                                WHEN 'TERMINATE'
                                THEN 5
                                ELSE 6
                            END,
                            governance.notice_deadline,
                            governance.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapGovernance(
                                resultSet
                        ),
                currency
        );
    }

    public void startRenewalReview(
            UUID governanceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE contract_commercial_governance
                SET
                    renewal_status =
                        'UNDER_REVIEW',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND renewal_status =
                    'UPCOMING'
                """,
                governanceId
        );
    }

    public void decideRenewal(
            UUID governanceId,
            ContractRenewalDecision decision,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE contract_commercial_governance
                SET
                    renewal_status = ?,
                    renewal_decision_note = ?,
                    renewal_decided_by_user_id = ?,
                    renewal_decided_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND renewal_status IN (
                    'UPCOMING',
                    'UNDER_REVIEW'
                )
                """,
                decision.name(),
                note.trim(),
                currentUserId,
                governanceId
        );
    }

    public void completeRenewal(
            UUID governanceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE contract_commercial_governance
                SET
                    renewal_status =
                        'COMPLETED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND renewal_status IN (
                    'RENEW',
                    'RENEGOTIATE',
                    'TERMINATE'
                )
                """,
                governanceId
        );
    }

    public void deactivateGovernance(
            UUID governanceId
    ) {
        jdbcTemplate.update(
                """
                UPDATE contract_commercial_governance
                SET
                    status =
                        'INACTIVE',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                governanceId
        );
    }

    public void createObligation(
            UUID id,
            UUID governanceId,
            ContractObligationInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO contract_obligations (
                    id,
                    governance_id,
                    obligation_type,
                    title,
                    description,
                    due_date,
                    critical,
                    status,
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
                    ?,
                    'OPEN',
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                governanceId,
                input.obligationType()
                        .name(),
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.dueDate(),
                input.critical(),
                ownerUserId
        );
    }

    public ObligationRow findObligation(
            UUID obligationId
    ) {
        return jdbcTemplate.query(
                obligationSql()
                        + """
                        WHERE obligation.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapObligation(
                                resultSet
                        ),
                obligationId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ObligationRow> findObligations(
            UUID governanceId
    ) {
        return jdbcTemplate.query(
                obligationSql()
                        + """
                        WHERE obligation.governance_id = ?
                        ORDER BY
                            CASE obligation.status
                                WHEN 'OPEN'
                                THEN 1
                                ELSE 2
                            END,
                            obligation.critical DESC,
                            obligation.due_date
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapObligation(
                                resultSet
                        ),
                governanceId
        );
    }

    public void completeObligation(
            UUID obligationId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE contract_obligations
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
                AND status =
                    'OPEN'
                """,
                note.trim(),
                obligationId
        );
    }

    public void waiveObligation(
            UUID obligationId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE contract_obligations
                SET
                    status =
                        'WAIVED',
                    completion_note = ?,
                    completed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'OPEN'
                """,
                note.trim(),
                obligationId
        );
    }

    public List<LeakageCandidateRow> noActiveContractCandidates(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id
                        AS purchase_order_id,

                    purchase_order.po_number,

                    purchase_order.supplier_id,

                    supplier.legal_name
                        AS supplier_name,

                    purchase_order.total_amount,

                    purchase_order.currency,

                    latest_governance.id
                        AS governance_id,

                    latest_governance.contract_id

                FROM purchase_orders purchase_order

                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id

                LEFT JOIN LATERAL (
                    SELECT
                        governance.id,
                        governance.contract_id
                    FROM contract_commercial_governance
                        governance
                    WHERE
                        governance.supplier_id =
                            purchase_order.supplier_id
                    ORDER BY
                        governance.updated_at DESC
                    LIMIT 1
                )
                    latest_governance
                    ON TRUE

                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )

                AND purchase_order.currency = ?

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
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new LeakageCandidateRow(
                                "NO_CONTRACT:PO:"
                                        + resultSet.getObject(
                                                "purchase_order_id",
                                                UUID.class
                                        ),
                                resultSet.getObject(
                                        "governance_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "contract_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                resultSet.getObject(
                                        "purchase_order_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "po_number"
                                ),
                                null,
                                null,
                                CommercialLeakageType.NO_ACTIVE_CONTRACT,
                                CommercialLeakageSeverity.CRITICAL,
                                resultSet.getString(
                                        "currency"
                                ),
                                BigDecimal.ZERO,
                                resultSet.getBigDecimal(
                                        "total_amount"
                                ),
                                resultSet.getBigDecimal(
                                        "total_amount"
                                ),
                                resultSet.getString(
                                        "po_number"
                                ),
                                "Purchase order "
                                        + resultSet.getString(
                                                "po_number"
                                        )
                                        + " has no currently active supplier contract coverage."
                        ),
                currency
        );
    }

    public List<LeakageCandidateRow> expiredContractCandidates(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    governance.id
                        AS governance_id,

                    governance.contract_id,
                    governance.supplier_id,

                    supplier.legal_name
                        AS supplier_name,

                    governance.currency,
                    governance.baseline_contract_value,

                    contract.end_date

                FROM contract_commercial_governance
                    governance

                JOIN supplier_contracts contract
                    ON contract.id =
                       governance.contract_id

                JOIN suppliers supplier
                    ON supplier.id =
                       governance.supplier_id

                WHERE governance.status =
                    'ACTIVE'

                AND governance.currency = ?

                AND (
                    contract.status
                        <> 'ACTIVE'
                    OR contract.end_date
                        < CURRENT_DATE
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new LeakageCandidateRow(
                                "EXPIRED:CONTRACT:"
                                        + resultSet.getObject(
                                                "contract_id",
                                                UUID.class
                                        ),
                                resultSet.getObject(
                                        "governance_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "contract_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "supplier_name"
                                ),
                                null,
                                null,
                                null,
                                null,
                                CommercialLeakageType.EXPIRED_CONTRACT,
                                CommercialLeakageSeverity.HIGH,
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_contract_value"
                                ),
                                resultSet.getBigDecimal(
                                        "baseline_contract_value"
                                ),
                                BigDecimal.ZERO,
                                resultSet.getObject(
                                        "contract_id",
                                        UUID.class
                                )
                                        .toString(),
                                "Governed contract expired or is no longer active. Contract end date: "
                                        + resultSet.getObject(
                                                "end_date",
                                                LocalDate.class
                                        )
                        ),
                currency
        );
    }

    public List<LeakageCandidateRow> poVarianceCandidates(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    governance.id
                        AS governance_id,

                    governance.contract_id,
                    governance.supplier_id,

                    supplier.legal_name
                        AS supplier_name,

                    purchase_order.id
                        AS purchase_order_id,

                    purchase_order.po_number,

                    purchase_order.currency,

                    governance.baseline_contract_value,

                    governance.max_po_variance_pct,

                    ROUND(
                        governance.baseline_contract_value
                        *
                        (
                            1
                            +
                            governance.max_po_variance_pct
                            / 100
                        ),
                        2
                    )
                        AS allowed_value,

                    purchase_order.total_amount
                        AS actual_value

                FROM contract_commercial_governance
                    governance

                JOIN suppliers supplier
                    ON supplier.id =
                       governance.supplier_id

                JOIN purchase_orders purchase_order
                    ON purchase_order.supplier_id =
                       governance.supplier_id

                WHERE governance.status =
                    'ACTIVE'

                AND governance.currency = ?

                AND purchase_order.currency =
                    governance.currency

                AND purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )

                AND purchase_order.created_at
                    >= governance.created_at

                AND purchase_order.total_amount
                    >
                    governance.baseline_contract_value
                    *
                    (
                        1
                        +
                        governance.max_po_variance_pct
                        / 100
                    )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    BigDecimal expected =
                            resultSet.getBigDecimal(
                                    "allowed_value"
                            );

                    BigDecimal actual =
                            resultSet.getBigDecimal(
                                    "actual_value"
                            );

                    BigDecimal leakage =
                            actual.subtract(
                                    expected
                            )
                                    .max(
                                            BigDecimal.ZERO
                                    );

                    return new LeakageCandidateRow(
                            "PO_VARIANCE:"
                                    + resultSet.getObject(
                                            "governance_id",
                                            UUID.class
                                    )
                                    + ":"
                                    + resultSet.getObject(
                                            "purchase_order_id",
                                            UUID.class
                                    ),
                            resultSet.getObject(
                                    "governance_id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "contract_id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "supplier_name"
                            ),
                            resultSet.getObject(
                                    "purchase_order_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "po_number"
                            ),
                            null,
                            null,
                            CommercialLeakageType.PO_VALUE_VARIANCE,
                            CommercialLeakageSeverity.HIGH,
                            resultSet.getString(
                                    "currency"
                            ),
                            expected,
                            actual,
                            leakage,
                            resultSet.getString(
                                    "po_number"
                            ),
                            "Purchase order exceeds the configured contract commercial variance ceiling of "
                                    + resultSet.getBigDecimal(
                                            "max_po_variance_pct"
                                    )
                                    + "%."
                    );
                },
                currency
        );
    }

    public List<LeakageCandidateRow> priceEscalationCandidates(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    governance.id
                        AS governance_id,

                    governance.contract_id,
                    governance.supplier_id,

                    supplier.legal_name
                        AS supplier_name,

                    purchase_order.id
                        AS purchase_order_id,

                    purchase_order.po_number,

                    purchase_order.currency,

                    governance.price_escalation_pct,

                    ROUND(
                        governance.baseline_contract_value
                        *
                        (
                            1
                            +
                            governance.price_escalation_pct
                            / 100
                        ),
                        2
                    )
                        AS allowed_value,

                    purchase_order.total_amount
                        AS actual_value

                FROM contract_commercial_governance
                    governance

                JOIN suppliers supplier
                    ON supplier.id =
                       governance.supplier_id

                JOIN purchase_orders purchase_order
                    ON purchase_order.supplier_id =
                       governance.supplier_id

                WHERE governance.status =
                    'ACTIVE'

                AND governance.currency = ?

                AND purchase_order.currency =
                    governance.currency

                AND purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )

                AND purchase_order.created_at
                    >= governance.created_at

                AND purchase_order.total_amount
                    >
                    governance.baseline_contract_value
                    *
                    (
                        1
                        +
                        governance.price_escalation_pct
                        / 100
                    )
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    BigDecimal expected =
                            resultSet.getBigDecimal(
                                    "allowed_value"
                            );

                    BigDecimal actual =
                            resultSet.getBigDecimal(
                                    "actual_value"
                            );

                    BigDecimal leakage =
                            actual.subtract(
                                    expected
                            )
                                    .max(
                                            BigDecimal.ZERO
                                    );

                    return new LeakageCandidateRow(
                            "ESCALATION:"
                                    + resultSet.getObject(
                                            "governance_id",
                                            UUID.class
                                    )
                                    + ":"
                                    + resultSet.getObject(
                                            "purchase_order_id",
                                            UUID.class
                                    ),
                            resultSet.getObject(
                                    "governance_id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "contract_id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "supplier_name"
                            ),
                            resultSet.getObject(
                                    "purchase_order_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "po_number"
                            ),
                            null,
                            null,
                            CommercialLeakageType.PRICE_ESCALATION_BREACH,
                            CommercialLeakageSeverity.HIGH,
                            resultSet.getString(
                                    "currency"
                            ),
                            expected,
                            actual,
                            leakage,
                            resultSet.getString(
                                    "po_number"
                            ),
                            "Purchase order exceeds the configured contract price-escalation allowance of "
                                    + resultSet.getBigDecimal(
                                            "price_escalation_pct"
                                    )
                                    + "%."
                    );
                },
                currency
        );
    }

    public List<LeakageCandidateRow> negotiatedValueCandidates(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    purchase_order.id
                        AS purchase_order_id,

                    purchase_order.po_number,
                    purchase_order.supplier_id,

                    supplier.legal_name
                        AS supplier_name,

                    purchase_order.currency,

                    negotiation.id
                        AS negotiation_workspace_id,

                    negotiation.negotiation_number,

                    negotiation.agreed_value
                        AS expected_value,

                    purchase_order.total_amount
                        AS actual_value,

                    latest_governance.id
                        AS governance_id,

                    latest_governance.contract_id

                FROM purchase_orders purchase_order

                JOIN suppliers supplier
                    ON supplier.id =
                       purchase_order.supplier_id

                JOIN procurement_negotiation_workspaces
                    negotiation
                    ON negotiation.rfq_id =
                       purchase_order.rfq_id
                    AND negotiation.supplier_id =
                       purchase_order.supplier_id

                LEFT JOIN LATERAL (
                    SELECT
                        governance.id,
                        governance.contract_id
                    FROM contract_commercial_governance
                        governance
                    WHERE
                        governance.supplier_id =
                            purchase_order.supplier_id
                    AND governance.status =
                            'ACTIVE'
                    ORDER BY
                        governance.updated_at DESC
                    LIMIT 1
                )
                    latest_governance
                    ON TRUE

                WHERE purchase_order.status IN (
                    'ISSUED',
                    'PARTIALLY_RECEIVED',
                    'RECEIVED'
                )

                AND purchase_order.currency = ?

                AND negotiation.status IN (
                    'AGREED',
                    'CLOSED'
                )

                AND negotiation.agreed_value
                    IS NOT NULL

                AND purchase_order.total_amount
                    >
                    negotiation.agreed_value
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    BigDecimal expected =
                            resultSet.getBigDecimal(
                                    "expected_value"
                            );

                    BigDecimal actual =
                            resultSet.getBigDecimal(
                                    "actual_value"
                            );

                    BigDecimal leakage =
                            actual.subtract(
                                    expected
                            )
                                    .max(
                                            BigDecimal.ZERO
                                    );

                    return new LeakageCandidateRow(
                            "NEGOTIATED:"
                                    + resultSet.getObject(
                                            "negotiation_workspace_id",
                                            UUID.class
                                    )
                                    + ":PO:"
                                    + resultSet.getObject(
                                            "purchase_order_id",
                                            UUID.class
                                    ),
                            resultSet.getObject(
                                    "governance_id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "contract_id",
                                    UUID.class
                            ),
                            resultSet.getObject(
                                    "supplier_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "supplier_name"
                            ),
                            resultSet.getObject(
                                    "purchase_order_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "po_number"
                            ),
                            resultSet.getObject(
                                    "negotiation_workspace_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "negotiation_number"
                            ),
                            CommercialLeakageType.NEGOTIATED_VALUE_VARIANCE,
                            CommercialLeakageSeverity.HIGH,
                            resultSet.getString(
                                    "currency"
                            ),
                            expected,
                            actual,
                            leakage,
                            resultSet.getString(
                                    "po_number"
                            ),
                            "Purchase order value exceeds the final agreed negotiation value from "
                                    + resultSet.getString(
                                            "negotiation_number"
                                    )
                                    + "."
                    );
                },
                currency
        );
    }

    public LeakageRow findLeakageBySourceKey(
            String sourceKey
    ) {
        return jdbcTemplate.query(
                leakageSql()
                        + """
                        WHERE finding.source_key = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLeakage(
                                resultSet
                        ),
                sourceKey
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createLeakageFinding(
            UUID id,
            LeakageCandidateRow candidate,
            CommercialLeakageSeverity severity
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO commercial_leakage_findings (
                    id,
                    source_key,
                    governance_id,
                    contract_id,
                    supplier_id,
                    purchase_order_id,
                    negotiation_workspace_id,
                    finding_type,
                    severity,
                    status,
                    currency,
                    expected_value,
                    actual_value,
                    leakage_amount,
                    source_reference,
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
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                candidate.sourceKey(),
                candidate.governanceId(),
                candidate.contractId(),
                candidate.supplierId(),
                candidate.purchaseOrderId(),
                candidate.negotiationWorkspaceId(),
                candidate.findingType()
                        .name(),
                severity.name(),
                candidate.currency(),
                candidate.expectedValue(),
                candidate.actualValue(),
                candidate.leakageAmount(),
                candidate.sourceReference(),
                candidate.details()
        );
    }

    public void refreshLeakageFinding(
            UUID findingId,
            LeakageCandidateRow candidate,
            CommercialLeakageSeverity severity
    ) {
        jdbcTemplate.update(
                """
                UPDATE commercial_leakage_findings
                SET
                    governance_id = ?,
                    contract_id = ?,
                    purchase_order_id = ?,
                    negotiation_workspace_id = ?,
                    severity = ?,
                    currency = ?,
                    expected_value = ?,
                    actual_value = ?,
                    leakage_amount = ?,
                    source_reference = ?,
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
                candidate.governanceId(),
                candidate.contractId(),
                candidate.purchaseOrderId(),
                candidate.negotiationWorkspaceId(),
                severity.name(),
                candidate.currency(),
                candidate.expectedValue(),
                candidate.actualValue(),
                candidate.leakageAmount(),
                candidate.sourceReference(),
                candidate.details(),
                findingId
        );
    }

    public LeakageRow findLeakage(
            UUID findingId
    ) {
        return jdbcTemplate.query(
                leakageSql()
                        + """
                        WHERE finding.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLeakage(
                                resultSet
                        ),
                findingId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<LeakageRow> findLeakageFindings(
            String currency
    ) {
        return jdbcTemplate.query(
                leakageSql()
                        + """
                        WHERE finding.currency = ?
                        OR finding.currency IS NULL
                        ORDER BY
                            CASE finding.severity
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,
                            CASE finding.status
                                WHEN 'OPEN'
                                THEN 1
                                ELSE 2
                            END,
                            finding.detected_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLeakage(
                                resultSet
                        ),
                currency
        );
    }

    public List<LeakageRow> findLeakageForGovernance(
            UUID governanceId
    ) {
        return jdbcTemplate.query(
                leakageSql()
                        + """
                        WHERE finding.governance_id = ?
                        ORDER BY
                            CASE finding.status
                                WHEN 'OPEN'
                                THEN 1
                                ELSE 2
                            END,
                            CASE finding.severity
                                WHEN 'CRITICAL'
                                THEN 1
                                WHEN 'HIGH'
                                THEN 2
                                WHEN 'MEDIUM'
                                THEN 3
                                ELSE 4
                            END,
                            finding.detected_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapLeakage(
                                resultSet
                        ),
                governanceId
        );
    }

    public void resolveLeakage(
            UUID findingId,
            UUID currentUserId,
            String note,
            CommercialLeakageStatus status
    ) {
        jdbcTemplate.update(
                """
                UPDATE commercial_leakage_findings
                SET
                    status = ?,
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
                status.name(),
                currentUserId,
                note.trim(),
                findingId
        );
    }

    public List<CommercialGovernanceUserOptionResponse> users() {
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
                        new CommercialGovernanceUserOptionResponse(
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

    private String governanceSql() {
        return """
                SELECT
                    governance.id,
                    governance.contract_id,

                    governance.supplier_id,
                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    contract.status
                        AS contract_status,
                    contract.end_date
                        AS contract_end_date,

                    governance.status
                        AS governance_status,
                    governance.renewal_status,
                    governance.notice_period_days,
                    governance.notice_deadline,
                    governance.baseline_contract_value,
                    governance.currency,
                    governance.price_escalation_pct,
                    governance.max_po_variance_pct,
                    governance.auto_renewal,

                    governance.owner_user_id,
                    owner.full_name
                        AS owner_name,

                    governance.renewal_decision_note,
                    governance.renewal_decided_at,

                    renewal_decider.full_name
                        AS renewal_decided_by_name,

                    governance.notes,

                    (
                        SELECT COUNT(*)
                        FROM contract_obligations
                            obligation
                        WHERE
                            obligation.governance_id =
                                governance.id
                        AND obligation.status =
                            'OPEN'
                    )
                        AS open_obligations,

                    (
                        SELECT COUNT(*)
                        FROM contract_obligations
                            obligation
                        WHERE
                            obligation.governance_id =
                                governance.id
                        AND obligation.status =
                            'OPEN'
                        AND obligation.due_date
                            < CURRENT_DATE
                    )
                        AS overdue_obligations,

                    (
                        SELECT COUNT(*)
                        FROM commercial_leakage_findings
                            finding
                        WHERE
                            finding.governance_id =
                                governance.id
                        AND finding.status =
                            'OPEN'
                    )
                        AS open_leakage_findings,

                    (
                        SELECT COALESCE(
                            SUM(
                                finding.leakage_amount
                            ),
                            0
                        )
                        FROM commercial_leakage_findings
                            finding
                        WHERE
                            finding.governance_id =
                                governance.id
                        AND finding.status =
                            'OPEN'
                    )
                        AS leakage_exposure,

                    governance.created_at,
                    governance.updated_at,
                    governance.version

                FROM contract_commercial_governance
                    governance

                JOIN supplier_contracts contract
                    ON contract.id =
                       governance.contract_id

                JOIN suppliers supplier
                    ON supplier.id =
                       governance.supplier_id

                JOIN app_users owner
                    ON owner.id =
                       governance.owner_user_id

                LEFT JOIN app_users renewal_decider
                    ON renewal_decider.id =
                       governance.renewal_decided_by_user_id

                """;
    }

    private String obligationSql() {
        return """
                SELECT
                    obligation.id,
                    obligation.governance_id,
                    obligation.obligation_type,
                    obligation.title,
                    obligation.description,
                    obligation.due_date,
                    obligation.critical,
                    obligation.status,
                    obligation.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    obligation.completion_note,
                    obligation.completed_at,
                    obligation.created_at,
                    obligation.updated_at,
                    obligation.version

                FROM contract_obligations
                    obligation

                JOIN app_users owner
                    ON owner.id =
                       obligation.owner_user_id

                """;
    }

    private String leakageSql() {
        return """
                SELECT
                    finding.id,
                    finding.governance_id,
                    finding.contract_id,
                    finding.supplier_id,

                    supplier.legal_name
                        AS supplier_name,

                    finding.purchase_order_id,
                    purchase_order.po_number,

                    finding.negotiation_workspace_id,
                    negotiation.negotiation_number,

                    finding.finding_type,
                    finding.severity,
                    finding.status,
                    finding.currency,
                    finding.expected_value,
                    finding.actual_value,
                    finding.leakage_amount,
                    finding.source_reference,
                    finding.details,
                    finding.detected_at,
                    finding.last_checked_at,

                    finding.resolution_note,
                    finding.resolved_at,

                    resolver.full_name
                        AS resolved_by_name,

                    finding.created_at,
                    finding.updated_at,
                    finding.version

                FROM commercial_leakage_findings
                    finding

                JOIN suppliers supplier
                    ON supplier.id =
                       finding.supplier_id

                LEFT JOIN purchase_orders purchase_order
                    ON purchase_order.id =
                       finding.purchase_order_id

                LEFT JOIN procurement_negotiation_workspaces
                    negotiation
                    ON negotiation.id =
                       finding.negotiation_workspace_id

                LEFT JOIN app_users resolver
                    ON resolver.id =
                       finding.resolved_by_user_id

                """;
    }

    private ContractRow mapContract(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new ContractRow(
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
                        "contract_status"
                ),
                resultSet.getObject(
                        "end_date",
                        LocalDate.class
                ),
                resultSet.getBoolean(
                        "governance_configured"
                )
        );
    }

    private GovernanceRow mapGovernance(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp decided =
                resultSet.getTimestamp(
                        "renewal_decided_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new GovernanceRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "contract_id",
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
                        "contract_status"
                ),
                resultSet.getObject(
                        "contract_end_date",
                        LocalDate.class
                ),
                CommercialGovernanceStatus
                        .valueOf(
                                resultSet.getString(
                                        "governance_status"
                                )
                        ),
                ContractRenewalStatus
                        .valueOf(
                                resultSet.getString(
                                        "renewal_status"
                                )
                        ),
                resultSet.getInt(
                        "notice_period_days"
                ),
                resultSet.getObject(
                        "notice_deadline",
                        LocalDate.class
                ),
                resultSet.getBigDecimal(
                        "baseline_contract_value"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBigDecimal(
                        "price_escalation_pct"
                ),
                resultSet.getBigDecimal(
                        "max_po_variance_pct"
                ),
                resultSet.getBoolean(
                        "auto_renewal"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getString(
                        "renewal_decision_note"
                ),
                decided == null
                        ? null
                        : decided.toInstant(),
                resultSet.getString(
                        "renewal_decided_by_name"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getLong(
                        "open_obligations"
                ),
                resultSet.getLong(
                        "overdue_obligations"
                ),
                resultSet.getLong(
                        "open_leakage_findings"
                ),
                resultSet.getBigDecimal(
                        "leakage_exposure"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private ObligationRow mapObligation(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp completed =
                resultSet.getTimestamp(
                        "completed_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new ObligationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "governance_id",
                        UUID.class
                ),
                ContractObligationType
                        .valueOf(
                                resultSet.getString(
                                        "obligation_type"
                                )
                        ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                resultSet.getBoolean(
                        "critical"
                ),
                ContractObligationStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getString(
                        "completion_note"
                ),
                completed == null
                        ? null
                        : completed.toInstant(),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private LeakageRow mapLeakage(
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

        return new LeakageRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "governance_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "contract_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getString(
                        "supplier_name"
                ),
                resultSet.getObject(
                        "purchase_order_id",
                        UUID.class
                ),
                resultSet.getString(
                        "po_number"
                ),
                resultSet.getObject(
                        "negotiation_workspace_id",
                        UUID.class
                ),
                resultSet.getString(
                        "negotiation_number"
                ),
                CommercialLeakageType
                        .valueOf(
                                resultSet.getString(
                                        "finding_type"
                                )
                        ),
                CommercialLeakageSeverity
                        .valueOf(
                                resultSet.getString(
                                        "severity"
                                )
                        ),
                CommercialLeakageStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBigDecimal(
                        "expected_value"
                ),
                resultSet.getBigDecimal(
                        "actual_value"
                ),
                resultSet.getBigDecimal(
                        "leakage_amount"
                ),
                resultSet.getString(
                        "source_reference"
                ),
                resultSet.getString(
                        "details"
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

    public record ContractRow(
            UUID id,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String contractStatus,
            LocalDate endDate,
            boolean governanceConfigured
    ) {
    }

    public record GovernanceRow(
            UUID id,
            UUID contractId,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String contractStatus,
            LocalDate contractEndDate,
            CommercialGovernanceStatus governanceStatus,
            ContractRenewalStatus renewalStatus,
            int noticePeriodDays,
            LocalDate noticeDeadline,
            BigDecimal baselineContractValue,
            String currency,
            BigDecimal priceEscalationPct,
            BigDecimal maxPoVariancePct,
            boolean autoRenewal,
            UUID ownerUserId,
            String ownerName,
            String renewalDecisionNote,
            Instant renewalDecidedAt,
            String renewalDecidedByName,
            String notes,
            long openObligations,
            long overdueObligations,
            long openLeakageFindings,
            BigDecimal leakageExposure,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record ObligationRow(
            UUID id,
            UUID governanceId,
            ContractObligationType obligationType,
            String title,
            String description,
            LocalDate dueDate,
            boolean critical,
            ContractObligationStatus status,
            UUID ownerUserId,
            String ownerName,
            String completionNote,
            Instant completedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record LeakageCandidateRow(
            String sourceKey,
            UUID governanceId,
            UUID contractId,
            UUID supplierId,
            String supplierName,
            UUID purchaseOrderId,
            String purchaseOrderNumber,
            UUID negotiationWorkspaceId,
            String negotiationNumber,
            CommercialLeakageType findingType,
            CommercialLeakageSeverity severity,
            String currency,
            BigDecimal expectedValue,
            BigDecimal actualValue,
            BigDecimal leakageAmount,
            String sourceReference,
            String details
    ) {
    }

    public record LeakageRow(
            UUID id,
            UUID governanceId,
            UUID contractId,
            UUID supplierId,
            String supplierName,
            UUID purchaseOrderId,
            String purchaseOrderNumber,
            UUID negotiationWorkspaceId,
            String negotiationNumber,
            CommercialLeakageType findingType,
            CommercialLeakageSeverity severity,
            CommercialLeakageStatus status,
            String currency,
            BigDecimal expectedValue,
            BigDecimal actualValue,
            BigDecimal leakageAmount,
            String sourceReference,
            String details,
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
}
