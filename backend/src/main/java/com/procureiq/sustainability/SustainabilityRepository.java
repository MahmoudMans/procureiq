package com.procureiq.sustainability;

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
public class SustainabilityRepository {

    private final JdbcTemplate jdbcTemplate;

    public SustainabilityRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextAssessmentSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'sustainability_assessment_number_seq'
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

    public boolean hasOpenAssessment(
            UUID supplierId
    ) {
        Boolean result =
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM supplier_sustainability_assessments
                            WHERE supplier_id = ?
                            AND status IN (
                                'DRAFT',
                                'SUBMITTED'
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

    public void createAssessment(
            UUID id,
            String assessmentNumber,
            SustainabilityAssessmentInput input,
            UUID ownerUserId,
            BigDecimal overallScore,
            SustainabilityRating rating
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_sustainability_assessments (
                    id,
                    assessment_number,
                    supplier_id,
                    status,
                    environmental_score,
                    social_score,
                    governance_score,
                    overall_score,
                    rating,
                    assessment_date,
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
                    'DRAFT',
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
                assessmentNumber,
                input.supplierId(),
                input.environmentalScore(),
                input.socialScore(),
                input.governanceScore(),
                overallScore,
                rating.name(),
                input.assessmentDate(),
                ownerUserId,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void seedDeclaration(
            UUID assessmentId,
            SustainabilityDeclarationType type,
            boolean mandatory
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_sustainability_declarations (
                    id,
                    assessment_id,
                    declaration_type,
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
                assessmentId,
                type.name(),
                mandatory
        );
    }

    public AssessmentRow findAssessment(
            UUID assessmentId
    ) {
        return jdbcTemplate.query(
                assessmentSql()
                        + """
                        WHERE assessment.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAssessment(
                                resultSet
                        ),
                assessmentId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<DeclarationRow> findDeclarations(
            UUID assessmentId
    ) {
        return jdbcTemplate.query(
                declarationSql()
                        + """
                        WHERE declaration.assessment_id = ?
                        ORDER BY
                            declaration.mandatory DESC,
                            declaration.declaration_type
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDeclaration(
                                resultSet
                        ),
                assessmentId
        );
    }

    public DeclarationRow findDeclaration(
            UUID declarationId
    ) {
        return jdbcTemplate.query(
                declarationSql()
                        + """
                        WHERE declaration.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDeclaration(
                                resultSet
                        ),
                declarationId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public DeclarationRow findDeclarationByType(
            UUID assessmentId,
            SustainabilityDeclarationType type
    ) {
        return jdbcTemplate.query(
                declarationSql()
                        + """
                        WHERE declaration.assessment_id = ?
                        AND declaration.declaration_type = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapDeclaration(
                                resultSet
                        ),
                assessmentId,
                type.name()
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void uploadDeclaration(
            UUID assessmentId,
            SustainabilityDeclarationType type,
            SustainabilityDeclarationInput input
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_sustainability_declarations
                SET
                    document_reference = ?,
                    expiry_date = ?,
                    status =
                        'DECLARED',
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
                WHERE assessment_id = ?
                AND declaration_type = ?
                """,
                input.documentReference()
                        .trim(),
                input.expiryDate(),
                assessmentId,
                type.name()
        );
    }

    public void reviewDeclaration(
            UUID declarationId,
            SustainabilityDeclarationStatus status,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_sustainability_declarations
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
                declarationId
        );
    }

    public void submitAssessment(
            UUID assessmentId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_sustainability_assessments
                SET
                    status =
                        'SUBMITTED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'DRAFT'
                """,
                assessmentId
        );
    }

    public void approveAssessment(
            UUID assessmentId,
            UUID currentUserId,
            String note,
            LocalDate nextReviewDate
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_sustainability_assessments
                SET
                    status =
                        'APPROVED',
                    next_review_date = ?,
                    reviewed_by_user_id = ?,
                    review_note = ?,
                    reviewed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'SUBMITTED'
                """,
                nextReviewDate,
                currentUserId,
                note.trim(),
                assessmentId
        );
    }

    public void rejectAssessment(
            UUID assessmentId,
            UUID currentUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_sustainability_assessments
                SET
                    status =
                        'REJECTED',
                    reviewed_by_user_id = ?,
                    review_note = ?,
                    reviewed_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status =
                    'SUBMITTED'
                """,
                currentUserId,
                note.trim(),
                assessmentId
        );
    }

    public void createAction(
            UUID actionId,
            UUID assessmentId,
            SustainabilityActionInput input,
            UUID ownerUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_sustainability_actions (
                    id,
                    assessment_id,
                    action_type,
                    title,
                    description,
                    owner_user_id,
                    due_date,
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
                    'OPEN',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                actionId,
                assessmentId,
                input.actionType()
                        .name(),
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                ownerUserId,
                input.dueDate()
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
            UUID assessmentId
    ) {
        return jdbcTemplate.query(
                actionSql()
                        + """
                        WHERE action.assessment_id = ?
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
                            action.due_date
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapAction(
                                resultSet
                        ),
                assessmentId
        );
    }

    public void startAction(
            UUID actionId
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_sustainability_actions
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
                UPDATE supplier_sustainability_actions
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
                UPDATE supplier_sustainability_actions
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

    public List<PortfolioRow> portfolio(
            String currency
    ) {
        return jdbcTemplate.query(
                """
                WITH supplier_spend AS (
                    SELECT
                        supplier_id,

                        COALESCE(
                            SUM(total_amount),
                            0
                        )
                            AS spend

                    FROM purchase_orders

                    WHERE currency = ?

                    AND status IN (
                        'ISSUED',
                        'PARTIALLY_RECEIVED',
                        'RECEIVED'
                    )

                    GROUP BY
                        supplier_id
                ),

                latest_assessment AS (
                    SELECT DISTINCT ON (
                        supplier_id
                    )
                        id,
                        assessment_number,
                        supplier_id,
                        status,
                        environmental_score,
                        social_score,
                        governance_score,
                        overall_score,
                        rating,
                        next_review_date

                    FROM supplier_sustainability_assessments

                    ORDER BY
                        supplier_id,
                        created_at DESC
                )

                SELECT
                    supplier.id
                        AS supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    supplier.category,
                    supplier.country,
                    supplier.risk_level,

                    COALESCE(
                        supplier_spend.spend,
                        0
                    )
                        AS spend,

                    latest_assessment.id
                        AS assessment_id,

                    latest_assessment.assessment_number,
                    latest_assessment.status
                        AS assessment_status,

                    latest_assessment.environmental_score,
                    latest_assessment.social_score,
                    latest_assessment.governance_score,
                    latest_assessment.overall_score,
                    latest_assessment.rating,
                    latest_assessment.next_review_date,

                    EXISTS (
                        SELECT 1
                        FROM supplier_onboarding_cases
                            onboarding
                        WHERE
                            onboarding.supplier_id =
                                supplier.id
                        AND onboarding.status =
                            'APPROVED'
                        AND onboarding.activation_clearance =
                            TRUE
                        AND (
                            onboarding.requalification_due_date
                                IS NULL
                            OR onboarding.requalification_due_date
                                >= CURRENT_DATE
                        )
                    )
                        AS onboarding_clearance,

                    (
                        SELECT COUNT(*)
                        FROM supplier_sustainability_declarations
                            declaration
                        WHERE
                            declaration.assessment_id =
                                latest_assessment.id
                        AND declaration.mandatory =
                            TRUE
                    )
                        AS mandatory_declarations,

                    (
                        SELECT COUNT(*)
                        FROM supplier_sustainability_declarations
                            declaration
                        WHERE
                            declaration.assessment_id =
                                latest_assessment.id
                        AND declaration.mandatory =
                            TRUE
                        AND declaration.status =
                            'VERIFIED'
                        AND (
                            declaration.expiry_date
                                IS NULL
                            OR declaration.expiry_date
                                >= CURRENT_DATE
                        )
                    )
                        AS verified_mandatory_declarations,

                    (
                        SELECT COUNT(*)
                        FROM supplier_sustainability_actions
                            action
                        WHERE
                            action.assessment_id =
                                latest_assessment.id
                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_actions,

                    (
                        SELECT COUNT(*)
                        FROM supplier_sustainability_actions
                            action
                        WHERE
                            action.assessment_id =
                                latest_assessment.id
                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND action.due_date
                            < CURRENT_DATE
                    )
                        AS overdue_actions

                FROM suppliers supplier

                LEFT JOIN supplier_spend
                    ON supplier_spend.supplier_id =
                       supplier.id

                LEFT JOIN latest_assessment
                    ON latest_assessment.supplier_id =
                       supplier.id

                WHERE supplier.status =
                    'ACTIVE'

                ORDER BY
                    COALESCE(
                        supplier_spend.spend,
                        0
                    ) DESC,
                    supplier.legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) -> {
                    String assessmentStatus =
                            resultSet.getString(
                                    "assessment_status"
                            );

                    String rating =
                            resultSet.getString(
                                    "rating"
                            );

                    return new PortfolioRow(
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
                                    "category"
                            ),
                            resultSet.getString(
                                    "country"
                            ),
                            resultSet.getString(
                                    "risk_level"
                            ),
                            resultSet.getBigDecimal(
                                    "spend"
                            ),
                            resultSet.getObject(
                                    "assessment_id",
                                    UUID.class
                            ),
                            resultSet.getString(
                                    "assessment_number"
                            ),
                            assessmentStatus == null
                                    ? null
                                    : SustainabilityAssessmentStatus.valueOf(
                                            assessmentStatus
                                    ),
                            rating == null
                                    ? null
                                    : SustainabilityRating.valueOf(
                                            rating
                                    ),
                            resultSet.getBigDecimal(
                                    "environmental_score"
                            ),
                            resultSet.getBigDecimal(
                                    "social_score"
                            ),
                            resultSet.getBigDecimal(
                                    "governance_score"
                            ),
                            resultSet.getBigDecimal(
                                    "overall_score"
                            ),
                            resultSet.getObject(
                                    "next_review_date",
                                    LocalDate.class
                            ),
                            resultSet.getBoolean(
                                    "onboarding_clearance"
                            ),
                            resultSet.getInt(
                                    "mandatory_declarations"
                            ),
                            resultSet.getInt(
                                    "verified_mandatory_declarations"
                            ),
                            resultSet.getLong(
                                    "open_actions"
                            ),
                            resultSet.getLong(
                                    "overdue_actions"
                            )
                    );
                },
                currency
        );
    }

    public List<SustainabilitySupplierOptionResponse> suppliers() {
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
                WHERE status =
                    'ACTIVE'
                ORDER BY
                    legal_name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SustainabilitySupplierOptionResponse(
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

    public List<SustainabilityUserOptionResponse> users() {
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
                        new SustainabilityUserOptionResponse(
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

    private String assessmentSql() {
        return """
                SELECT
                    assessment.id,
                    assessment.assessment_number,
                    assessment.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.category
                        AS supplier_category,
                    supplier.country
                        AS supplier_country,
                    supplier.risk_level
                        AS supplier_risk_level,

                    assessment.status,
                    assessment.environmental_score,
                    assessment.social_score,
                    assessment.governance_score,
                    assessment.overall_score,
                    assessment.rating,

                    assessment.assessment_date,
                    assessment.next_review_date,

                    assessment.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    reviewer.full_name
                        AS reviewed_by_name,

                    assessment.review_note,
                    assessment.reviewed_at,
                    assessment.notes,

                    (
                        SELECT COUNT(*)
                        FROM supplier_sustainability_declarations
                            declaration
                        WHERE
                            declaration.assessment_id =
                                assessment.id
                        AND declaration.mandatory =
                            TRUE
                    )
                        AS mandatory_declarations,

                    (
                        SELECT COUNT(*)
                        FROM supplier_sustainability_declarations
                            declaration
                        WHERE
                            declaration.assessment_id =
                                assessment.id
                        AND declaration.mandatory =
                            TRUE
                        AND declaration.status =
                            'VERIFIED'
                        AND (
                            declaration.expiry_date
                                IS NULL
                            OR declaration.expiry_date
                                >= CURRENT_DATE
                        )
                    )
                        AS verified_mandatory_declarations,

                    EXISTS (
                        SELECT 1
                        FROM supplier_onboarding_cases
                            onboarding
                        WHERE
                            onboarding.supplier_id =
                                assessment.supplier_id
                        AND onboarding.status =
                            'APPROVED'
                        AND onboarding.activation_clearance =
                            TRUE
                        AND (
                            onboarding.requalification_due_date
                                IS NULL
                            OR onboarding.requalification_due_date
                                >= CURRENT_DATE
                        )
                    )
                        AS onboarding_clearance,

                    (
                        SELECT COUNT(*)
                        FROM supplier_sustainability_actions
                            action
                        WHERE
                            action.assessment_id =
                                assessment.id
                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                    )
                        AS open_actions,

                    (
                        SELECT COUNT(*)
                        FROM supplier_sustainability_actions
                            action
                        WHERE
                            action.assessment_id =
                                assessment.id
                        AND action.status IN (
                            'OPEN',
                            'IN_PROGRESS'
                        )
                        AND action.due_date
                            < CURRENT_DATE
                    )
                        AS overdue_actions,

                    assessment.created_at,
                    assessment.updated_at,
                    assessment.version

                FROM supplier_sustainability_assessments
                    assessment

                JOIN suppliers supplier
                    ON supplier.id =
                       assessment.supplier_id

                JOIN app_users owner
                    ON owner.id =
                       assessment.owner_user_id

                LEFT JOIN app_users reviewer
                    ON reviewer.id =
                       assessment.reviewed_by_user_id

                """;
    }

    private String declarationSql() {
        return """
                SELECT
                    declaration.id,
                    declaration.assessment_id,
                    declaration.declaration_type,
                    declaration.mandatory,
                    declaration.document_reference,
                    declaration.expiry_date,
                    declaration.status,

                    reviewer.full_name
                        AS reviewed_by_name,

                    declaration.review_note,
                    declaration.reviewed_at

                FROM supplier_sustainability_declarations
                    declaration

                LEFT JOIN app_users reviewer
                    ON reviewer.id =
                       declaration.reviewed_by_user_id

                """;
    }

    private String actionSql() {
        return """
                SELECT
                    action.id,
                    action.assessment_id,
                    action.action_type,
                    action.title,
                    action.description,
                    action.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    action.due_date,
                    action.status,
                    action.completion_note,
                    action.completed_at,
                    action.created_at,
                    action.updated_at,
                    action.version

                FROM supplier_sustainability_actions
                    action

                JOIN app_users owner
                    ON owner.id =
                       action.owner_user_id

                """;
    }

    private AssessmentRow mapAssessment(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp reviewed =
                resultSet.getTimestamp(
                        "reviewed_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new AssessmentRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "assessment_number"
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
                        "supplier_risk_level"
                ),
                SustainabilityAssessmentStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                resultSet.getBigDecimal(
                        "environmental_score"
                ),
                resultSet.getBigDecimal(
                        "social_score"
                ),
                resultSet.getBigDecimal(
                        "governance_score"
                ),
                resultSet.getBigDecimal(
                        "overall_score"
                ),
                SustainabilityRating.valueOf(
                        resultSet.getString(
                                "rating"
                        )
                ),
                resultSet.getObject(
                        "assessment_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "next_review_date",
                        LocalDate.class
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getString(
                        "reviewed_by_name"
                ),
                resultSet.getString(
                        "review_note"
                ),
                reviewed == null
                        ? null
                        : reviewed.toInstant(),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getInt(
                        "mandatory_declarations"
                ),
                resultSet.getInt(
                        "verified_mandatory_declarations"
                ),
                resultSet.getBoolean(
                        "onboarding_clearance"
                ),
                resultSet.getLong(
                        "open_actions"
                ),
                resultSet.getLong(
                        "overdue_actions"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private DeclarationRow mapDeclaration(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp reviewed =
                resultSet.getTimestamp(
                        "reviewed_at"
                );

        return new DeclarationRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "assessment_id",
                        UUID.class
                ),
                SustainabilityDeclarationType.valueOf(
                        resultSet.getString(
                                "declaration_type"
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
                SustainabilityDeclarationStatus.valueOf(
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

    private ActionRow mapAction(
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

        return new ActionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "assessment_id",
                        UUID.class
                ),
                SustainabilityActionType.valueOf(
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
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                resultSet.getObject(
                        "due_date",
                        LocalDate.class
                ),
                SustainabilityActionStatus.valueOf(
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

    public record AssessmentRow(
            UUID id,
            String assessmentNumber,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String supplierCategory,
            String supplierCountry,
            String supplierRiskLevel,
            SustainabilityAssessmentStatus status,
            BigDecimal environmentalScore,
            BigDecimal socialScore,
            BigDecimal governanceScore,
            BigDecimal overallScore,
            SustainabilityRating rating,
            LocalDate assessmentDate,
            LocalDate nextReviewDate,
            UUID ownerUserId,
            String ownerName,
            String reviewedByName,
            String reviewNote,
            Instant reviewedAt,
            String notes,
            int mandatoryDeclarations,
            int verifiedMandatoryDeclarations,
            boolean onboardingClearance,
            long openActions,
            long overdueActions,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record DeclarationRow(
            UUID id,
            UUID assessmentId,
            SustainabilityDeclarationType declarationType,
            boolean mandatory,
            String documentReference,
            LocalDate expiryDate,
            SustainabilityDeclarationStatus status,
            String reviewedByName,
            String reviewNote,
            Instant reviewedAt
    ) {
    }

    public record ActionRow(
            UUID id,
            UUID assessmentId,
            SustainabilityActionType actionType,
            String title,
            String description,
            UUID ownerUserId,
            String ownerName,
            LocalDate dueDate,
            SustainabilityActionStatus status,
            String completionNote,
            Instant completedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record PortfolioRow(
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String category,
            String country,
            String supplierRiskLevel,
            BigDecimal spend,
            UUID assessmentId,
            String assessmentNumber,
            SustainabilityAssessmentStatus assessmentStatus,
            SustainabilityRating rating,
            BigDecimal environmentalScore,
            BigDecimal socialScore,
            BigDecimal governanceScore,
            BigDecimal overallScore,
            LocalDate nextReviewDate,
            boolean onboardingClearance,
            int mandatoryDeclarations,
            int verifiedMandatoryDeclarations,
            long openActions,
            long overdueActions
    ) {
    }
}
