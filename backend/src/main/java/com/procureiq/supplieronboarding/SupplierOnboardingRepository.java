package com.procureiq.supplieronboarding;

import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class SupplierOnboardingRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierOnboardingRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextCaseSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'supplier_onboarding_case_number_seq'
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
                    category,
                    country,
                    status,
                    risk_level
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
                                        "category"
                                ),
                                resultSet.getString(
                                        "country"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getString(
                                        "risk_level"
                                )
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public boolean hasOpenCase(
            UUID supplierId
    ) {
        Boolean result =
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM supplier_onboarding_cases
                            WHERE supplier_id = ?
                            AND status IN (
                                'DRAFT',
                                'IN_REVIEW'
                            )
                        )
                        """,
                        Boolean.class,
                        supplierId
                );

        return Boolean.TRUE.equals(
                result
        );
    }

    public void createCase(
            UUID id,
            String caseNumber,
            SupplierOnboardingCaseInput input,
            UUID ownerUserId,
            Instant slaDueAt
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_onboarding_cases (
                    id,
                    case_number,
                    supplier_id,
                    case_type,
                    status,
                    risk_tier,
                    owner_user_id,
                    activation_clearance,
                    sla_due_at,
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
                    'DRAFT',
                    ?,
                    ?,
                    FALSE,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                caseNumber,
                input.supplierId(),
                input.caseType()
                        .name(),
                input.riskTier()
                        .name(),
                ownerUserId,
                Timestamp.from(
                        slaDueAt
                ),
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void seedQuestion(
            UUID caseId,
            String code,
            String label,
            boolean mandatory
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_onboarding_questions (
                    id,
                    case_id,
                    question_code,
                    question_label,
                    mandatory,
                    compliance_status,
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
                    'PENDING',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                UUID.randomUUID(),
                caseId,
                code,
                label,
                mandatory
        );
    }

    public void seedEvidence(
            UUID caseId,
            OnboardingEvidenceType type,
            boolean mandatory
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_onboarding_evidence (
                    id,
                    case_id,
                    evidence_type,
                    mandatory,
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
                    'MISSING',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                UUID.randomUUID(),
                caseId,
                type.name(),
                mandatory
        );
    }

    public CaseRow findCase(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        WHERE onboarding.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        ),
                caseId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<CaseRow> findCases() {
        return jdbcTemplate.query(
                caseSql()
                        + """
                        ORDER BY
                            CASE onboarding.status
                                WHEN 'IN_REVIEW'
                                THEN 1
                                WHEN 'DRAFT'
                                THEN 2
                                WHEN 'APPROVED'
                                THEN 3
                                WHEN 'REJECTED'
                                THEN 4
                                WHEN 'EXPIRED'
                                THEN 5
                                ELSE 6
                            END,
                            onboarding.sla_due_at,
                            onboarding.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapCase(
                                resultSet
                        )
        );
    }

    public void answerQuestion(
            UUID caseId,
            String questionCode,
            QualificationAnswerInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_questions
                SET
                    answer_value = ?,
                    compliance_status = ?,
                    answered_by_user_id = ?,
                    answered_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE case_id = ?
                AND question_code = ?
                """,
                input.answerValue()
                        .trim(),
                input.complianceStatus()
                        .name(),
                currentUserId,
                caseId,
                questionCode
        );
    }

    public List<QuestionRow> findQuestions(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    question.id,
                    question.question_code,
                    question.question_label,
                    question.mandatory,
                    question.answer_value,
                    question.compliance_status,
                    question.answered_by_user_id,

                    answerer.full_name
                        AS answered_by_name,

                    question.answered_at

                FROM supplier_onboarding_questions
                    question

                LEFT JOIN app_users answerer
                    ON answerer.id =
                       question.answered_by_user_id

                WHERE question.case_id = ?

                ORDER BY
                    question.mandatory DESC,
                    question.question_code
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    Timestamp answered =
                            resultSet.getTimestamp(
                                    "answered_at"
                            );

                    return new QuestionRow(
                            resultSet.getObject(
                                    "id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "question_code"
                            ),
                            resultSet.getString(
                                    "question_label"
                            ),
                            resultSet.getBoolean(
                                    "mandatory"
                            ),
                            resultSet.getString(
                                    "answer_value"
                            ),
                            QualificationComplianceStatus.valueOf(
                                    resultSet.getString(
                                            "compliance_status"
                                    )
                            ),
                            resultSet.getObject(
                                    "answered_by_user_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "answered_by_name"
                            ),
                            answered == null
                                    ? null
                                    : answered.toInstant()
                    );
                },
                caseId
        );
    }

    public EvidenceRow findEvidenceByType(
            UUID caseId,
            OnboardingEvidenceType type
    ) {
        return jdbcTemplate.query(
                evidenceSql()
                        + """
                        WHERE evidence.case_id = ?
                        AND evidence.evidence_type = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEvidence(
                                resultSet
                        ),
                caseId,
                type.name()
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public EvidenceRow findEvidenceById(
            UUID evidenceId
    ) {
        return jdbcTemplate.query(
                evidenceSql()
                        + """
                        WHERE evidence.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEvidence(
                                resultSet
                        ),
                evidenceId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<EvidenceRow> findEvidence(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                evidenceSql()
                        + """
                        WHERE evidence.case_id = ?
                        ORDER BY
                            evidence.mandatory DESC,
                            evidence.evidence_type
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapEvidence(
                                resultSet
                        ),
                caseId
        );
    }

    public void uploadEvidence(
            UUID caseId,
            OnboardingEvidenceType type,
            OnboardingEvidenceInput input
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_evidence
                SET
                    document_reference = ?,
                    expiry_date = ?,
                    status =
                        'UPLOADED',
                    reviewed_by_user_id =
                        NULL,
                    review_note =
                        NULL,
                    reviewed_at =
                        NULL,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE case_id = ?
                AND evidence_type = ?
                """,
                input.documentReference()
                        .trim(),
                input.expiryDate(),
                caseId,
                type.name()
        );
    }

    public void reviewEvidence(
            UUID evidenceId,
            OnboardingEvidenceStatus status,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_evidence
                SET
                    status = ?,
                    reviewed_by_user_id = ?,
                    review_note = ?,
                    reviewed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                status.name(),
                currentUserId,
                note.trim(),
                evidenceId
        );
    }

    public void submitCase(
            UUID caseId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_cases
                SET
                    status =
                        'IN_REVIEW',
                    submitted_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'DRAFT'
                """,
                caseId
        );
    }

    public void createApproval(
            UUID caseId,
            OnboardingApprovalLevel level,
            boolean required
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_onboarding_approvals (
                    id,
                    case_id,
                    approval_level,
                    required,
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
                    'PENDING',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )

                ON CONFLICT (
                    case_id,
                    approval_level
                )
                DO NOTHING
                """,
                UUID.randomUUID(),
                caseId,
                level.name(),
                required
        );
    }

    public ApprovalRow findApproval(
            UUID approvalId
    ) {
        return jdbcTemplate.query(
                approvalSql()
                        + """
                        WHERE approval.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapApproval(
                                resultSet
                        ),
                approvalId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<ApprovalRow> findApprovals(
            UUID caseId
    ) {
        return jdbcTemplate.query(
                approvalSql()
                        + """
                        WHERE approval.case_id = ?
                        ORDER BY
                            CASE approval.approval_level
                                WHEN 'PROCUREMENT'
                                THEN 1
                                WHEN 'COMPLIANCE'
                                THEN 2
                                ELSE 3
                            END
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapApproval(
                                resultSet
                        ),
                caseId
        );
    }

    public void decideApproval(
            UUID approvalId,
            OnboardingApprovalStatus status,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_approvals
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
                    'PENDING'
                """,
                status.name(),
                currentUserId,
                note.trim(),
                approvalId
        );
    }

    public void finalizeCase(
            UUID caseId,
            LocalDate requalificationDueDate,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_cases
                SET
                    status =
                        'APPROVED',
                    activation_clearance =
                        TRUE,
                    requalification_due_date = ?,
                    decision_note = ?,
                    decision_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'IN_REVIEW'
                """,
                requalificationDueDate,
                note,
                caseId
        );
    }

    public void rejectCase(
            UUID caseId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_cases
                SET
                    status =
                        'REJECTED',
                    activation_clearance =
                        FALSE,
                    decision_note = ?,
                    decision_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'IN_REVIEW'
                """,
                note,
                caseId
        );
    }

    public void cancelCase(
            UUID caseId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_cases
                SET
                    status =
                        'CANCELLED',
                    activation_clearance =
                        FALSE,
                    decision_note = ?,
                    decision_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'IN_REVIEW'
                )
                """,
                note,
                caseId
        );
    }

    public void expireDueRequalifications() {
        jdbcTemplate.update(
                """
                UPDATE supplier_onboarding_cases
                SET
                    status =
                        'EXPIRED',
                    activation_clearance =
                        FALSE,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE status =
                    'APPROVED'
                AND requalification_due_date
                    IS NOT NULL
                AND requalification_due_date
                    < CURRENT_DATE
                """
        );
    }

    public List<SupplierOnboardingSupplierOptionResponse> suppliers() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name,
                    category,
                    country,
                    status,
                    risk_level
                FROM suppliers
                ORDER BY
                    legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SupplierOnboardingSupplierOptionResponse(
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
                                        "category"
                                ),
                                resultSet.getString(
                                        "country"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getString(
                                        "risk_level"
                                )
                        )
        );
    }

    public List<SupplierOnboardingUserOptionResponse> users() {
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
                        new SupplierOnboardingUserOptionResponse(
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

    private String caseSql() {
        return """
                SELECT
                    onboarding.id,
                    onboarding.case_number,
                    onboarding.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.category
                        AS supplier_category,
                    supplier.country
                        AS supplier_country,
                    supplier.status
                        AS supplier_status,
                    supplier.risk_level
                        AS supplier_risk_level,

                    onboarding.case_type,
                    onboarding.status,
                    onboarding.risk_tier,
                    onboarding.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    onboarding.activation_clearance,

                    onboarding.sla_due_at,
                    onboarding.submitted_at,
                    onboarding.decision_at,
                    onboarding.requalification_due_date,
                    onboarding.decision_note,
                    onboarding.notes,

                    (
                        SELECT COUNT(*)
                        FROM supplier_onboarding_questions
                            question
                        WHERE
                            question.case_id =
                                onboarding.id
                        AND question.mandatory =
                            TRUE
                    )
                        AS mandatory_questions,

                    (
                        SELECT COUNT(*)
                        FROM supplier_onboarding_questions
                            question
                        WHERE
                            question.case_id =
                                onboarding.id
                        AND question.mandatory =
                            TRUE
                        AND question.answer_value
                            IS NOT NULL
                        AND BTRIM(
                            question.answer_value
                        )
                            <> ''
                    )
                        AS answered_mandatory_questions,

                    (
                        SELECT COUNT(*)
                        FROM supplier_onboarding_questions
                            question
                        WHERE
                            question.case_id =
                                onboarding.id
                        AND question.mandatory =
                            TRUE
                        AND question.compliance_status =
                            'NON_COMPLIANT'
                    )
                        AS non_compliant_mandatory_questions,

                    (
                        SELECT COUNT(*)
                        FROM supplier_onboarding_evidence
                            evidence
                        WHERE
                            evidence.case_id =
                                onboarding.id
                        AND evidence.mandatory =
                            TRUE
                    )
                        AS mandatory_evidence,

                    (
                        SELECT COUNT(*)
                        FROM supplier_onboarding_evidence
                            evidence
                        WHERE
                            evidence.case_id =
                                onboarding.id
                        AND evidence.mandatory =
                            TRUE
                        AND evidence.status =
                            'VALID'
                        AND (
                            evidence.expiry_date
                                IS NULL
                            OR evidence.expiry_date
                                >= CURRENT_DATE
                        )
                    )
                        AS valid_mandatory_evidence,

                    (
                        SELECT COUNT(*)
                        FROM supplier_onboarding_approvals
                            approval
                        WHERE
                            approval.case_id =
                                onboarding.id
                        AND approval.required =
                            TRUE
                    )
                        AS required_approvals,

                    (
                        SELECT COUNT(*)
                        FROM supplier_onboarding_approvals
                            approval
                        WHERE
                            approval.case_id =
                                onboarding.id
                        AND approval.required =
                            TRUE
                        AND approval.status =
                            'APPROVED'
                    )
                        AS approved_required_approvals,

                    onboarding.created_at,
                    onboarding.updated_at,
                    onboarding.version

                FROM supplier_onboarding_cases
                    onboarding

                JOIN suppliers supplier
                    ON supplier.id =
                       onboarding.supplier_id

                JOIN app_users owner
                    ON owner.id =
                       onboarding.owner_user_id

                """;
    }

    private String evidenceSql() {
        return """
                SELECT
                    evidence.id,
                    evidence.case_id,
                    evidence.evidence_type,
                    evidence.mandatory,
                    evidence.document_reference,
                    evidence.expiry_date,
                    evidence.status,

                    reviewer.full_name
                        AS reviewed_by_name,

                    evidence.review_note,
                    evidence.reviewed_at

                FROM supplier_onboarding_evidence
                    evidence

                LEFT JOIN app_users reviewer
                    ON reviewer.id =
                       evidence.reviewed_by_user_id

                """;
    }

    private String approvalSql() {
        return """
                SELECT
                    approval.id,
                    approval.case_id,
                    approval.approval_level,
                    approval.required,
                    approval.status,

                    decider.full_name
                        AS decided_by_name,

                    approval.decision_note,
                    approval.decided_at

                FROM supplier_onboarding_approvals
                    approval

                LEFT JOIN app_users decider
                    ON decider.id =
                       approval.decided_by_user_id

                """;
    }

    private CaseRow mapCase(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp slaDue =
                resultSet.getTimestamp(
                        "sla_due_at"
                );

        Timestamp submitted =
                resultSet.getTimestamp(
                        "submitted_at"
                );

        Timestamp decision =
                resultSet.getTimestamp(
                        "decision_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new CaseRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "case_number"
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
                        "supplier_category"
                ),
                resultSet.getString(
                        "supplier_country"
                ),
                resultSet.getString(
                        "supplier_status"
                ),
                resultSet.getString(
                        "supplier_risk_level"
                ),
                SupplierOnboardingCaseType.valueOf(
                        resultSet.getString(
                                "case_type"
                        )
                ),
                SupplierOnboardingStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                SupplierOnboardingRiskTier.valueOf(
                        resultSet.getString(
                                "risk_tier"
                        )
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getBoolean(
                        "activation_clearance"
                ),
                resultSet.getInt(
                        "mandatory_questions"
                ),
                resultSet.getInt(
                        "answered_mandatory_questions"
                ),
                resultSet.getInt(
                        "non_compliant_mandatory_questions"
                ),
                resultSet.getInt(
                        "mandatory_evidence"
                ),
                resultSet.getInt(
                        "valid_mandatory_evidence"
                ),
                resultSet.getInt(
                        "required_approvals"
                ),
                resultSet.getInt(
                        "approved_required_approvals"
                ),
                slaDue.toInstant(),
                submitted == null
                        ? null
                        : submitted.toInstant(),
                decision == null
                        ? null
                        : decision.toInstant(),
                resultSet.getObject(
                        "requalification_due_date",
                        LocalDate.class
                ),
                resultSet.getString(
                        "decision_note"
                ),
                resultSet.getString(
                        "notes"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private EvidenceRow mapEvidence(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp reviewed =
                resultSet.getTimestamp(
                        "reviewed_at"
                );

        return new EvidenceRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "case_id",
                        UUID.class
                ),
                OnboardingEvidenceType.valueOf(
                        resultSet.getString(
                                "evidence_type"
                        )
                ),
                resultSet.getBoolean(
                        "mandatory"
                ),
                resultSet.getString(
                        "document_reference"
                ),
                resultSet.getObject(
                        "expiry_date",
                        LocalDate.class
                ),
                OnboardingEvidenceStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "reviewed_by_name"
                ),
                resultSet.getString(
                        "review_note"
                ),
                reviewed == null
                        ? null
                        : reviewed.toInstant()
        );
    }

    private ApprovalRow mapApproval(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp decided =
                resultSet.getTimestamp(
                        "decided_at"
                );

        return new ApprovalRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "case_id",
                        UUID.class
                ),
                OnboardingApprovalLevel.valueOf(
                        resultSet.getString(
                                "approval_level"
                        )
                ),
                resultSet.getBoolean(
                        "required"
                ),
                OnboardingApprovalStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getString(
                        "decided_by_name"
                ),
                resultSet.getString(
                        "decision_note"
                ),
                decided == null
                        ? null
                        : decided.toInstant()
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
            String category,
            String country,
            String status,
            String riskLevel
    ) {
    }

    public record CaseRow(
            UUID id,
            String caseNumber,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String supplierCategory,
            String supplierCountry,
            String supplierStatus,
            String supplierRiskLevel,
            SupplierOnboardingCaseType caseType,
            SupplierOnboardingStatus status,
            SupplierOnboardingRiskTier riskTier,
            UUID ownerUserId,
            String ownerName,
            boolean activationClearance,
            int mandatoryQuestions,
            int answeredMandatoryQuestions,
            int nonCompliantMandatoryQuestions,
            int mandatoryEvidence,
            int validMandatoryEvidence,
            int requiredApprovals,
            int approvedRequiredApprovals,
            Instant slaDueAt,
            Instant submittedAt,
            Instant decisionAt,
            LocalDate requalificationDueDate,
            String decisionNote,
            String notes,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record QuestionRow(
            UUID id,
            String questionCode,
            String questionLabel,
            boolean mandatory,
            String answerValue,
            QualificationComplianceStatus complianceStatus,
            UUID answeredByUserId,
            String answeredByName,
            Instant answeredAt
    ) {
    }

    public record EvidenceRow(
            UUID id,
            UUID caseId,
            OnboardingEvidenceType evidenceType,
            boolean mandatory,
            String documentReference,
            LocalDate expiryDate,
            OnboardingEvidenceStatus status,
            String reviewedByName,
            String reviewNote,
            Instant reviewedAt
    ) {
    }

    public record ApprovalRow(
            UUID id,
            UUID caseId,
            OnboardingApprovalLevel approvalLevel,
            boolean required,
            OnboardingApprovalStatus status,
            String decidedByName,
            String decisionNote,
            Instant decidedAt
    ) {
    }
}
