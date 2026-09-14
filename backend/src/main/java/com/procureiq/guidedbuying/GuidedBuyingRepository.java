package com.procureiq.guidedbuying;

import com.procureiq.compliance.ProcurementPolicyType;
import com.procureiq.user.ProcurementRole;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class GuidedBuyingRepository {

    private final JdbcTemplate jdbcTemplate;

    public GuidedBuyingRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public Long nextTemplateSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'guided_buying_template_code_seq'
                )
                """,
                Long.class
        );
    }

    public Long nextIntakeSequence() {
        return jdbcTemplate.queryForObject(
                """
                SELECT nextval(
                    'guided_buying_intake_number_seq'
                )
                """,
                Long.class
        );
    }

    public void createTemplate(
            UUID id,
            String templateCode,
            GuidedBuyingTemplateInput input,
            UUID ownerUserId,
            String currency
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO guided_buying_templates (
                    id,
                    template_code,
                    name,
                    description,
                    category,
                    default_title,
                    default_currency,
                    default_estimated_amount,
                    default_department_id,
                    active,
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
                    ?,
                    ?,
                    TRUE,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                templateCode,
                input.name()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.category()
                        .trim(),
                normalizeOptional(
                        input.defaultTitle()
                ),
                currency,
                input.defaultEstimatedAmount(),
                input.defaultDepartmentId(),
                ownerUserId
        );
    }

    public void setTemplateActive(
            UUID templateId,
            boolean active
    ) {
        jdbcTemplate.update(
                """
                UPDATE guided_buying_templates
                SET
                    active = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                active,
                templateId
        );
    }

    public TemplateRow findTemplate(
            UUID templateId
    ) {
        return jdbcTemplate.query(
                templateSql()
                        + """
                        WHERE template.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapTemplate(
                                resultSet
                        ),
                templateId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<TemplateRow> findTemplates() {
        return jdbcTemplate.query(
                templateSql()
                        + """
                        ORDER BY
                            CASE
                                WHEN template.active
                                THEN 1
                                ELSE 2
                            END,
                            template.category,
                            template.name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapTemplate(
                                resultSet
                        )
        );
    }

    public List<TemplateRow> findActiveTemplates() {
        return jdbcTemplate.query(
                templateSql()
                        + """
                        WHERE template.active =
                            TRUE
                        ORDER BY
                            template.category,
                            template.name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapTemplate(
                                resultSet
                        )
        );
    }

    public void createPreferredSupplier(
            UUID id,
            PreferredSupplierInput input,
            UUID currentUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO preferred_supplier_categories (
                    id,
                    category,
                    supplier_id,
                    preference_rank,
                    active,
                    notes,
                    created_by_user_id,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    TRUE,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                input.category()
                        .trim(),
                input.supplierId(),
                input.preferenceRank(),
                normalizeOptional(
                        input.notes()
                ),
                currentUserId
        );
    }

    public void deactivatePreferredSupplier(
            UUID preferredSupplierId
    ) {
        jdbcTemplate.update(
                """
                UPDATE preferred_supplier_categories
                SET
                    active = FALSE,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                preferredSupplierId
        );
    }

    public PreferredSupplierRow findPreferredSupplier(
            UUID id
    ) {
        return jdbcTemplate.query(
                preferredSupplierSql()
                        + """
                        WHERE mapping.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPreferredSupplier(
                                resultSet
                        ),
                id
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<PreferredSupplierRow> findPreferredSuppliers() {
        return jdbcTemplate.query(
                preferredSupplierSql()
                        + """
                        ORDER BY
                            mapping.category,
                            mapping.active DESC,
                            mapping.preference_rank,
                            supplier.legal_name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPreferredSupplier(
                                resultSet
                        )
        );
    }

    public List<PreferredSupplierRow> findPreferredSuppliersForCategory(
            String category
    ) {
        return jdbcTemplate.query(
                preferredSupplierSql()
                        + """
                        WHERE mapping.active =
                            TRUE
                        AND supplier.status =
                            'ACTIVE'
                        AND LOWER(
                            mapping.category
                        ) = LOWER(?)
                        ORDER BY
                            mapping.preference_rank,
                            supplier.rating DESC,
                            supplier.legal_name
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapPreferredSupplier(
                                resultSet
                        ),
                category
        );
    }

    public String supplierRiskLevel(
            UUID supplierId
    ) {
        if (supplierId == null) {
            return null;
        }

        return jdbcTemplate.query(
                """
                SELECT risk_level
                FROM suppliers
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        resultSet.getString(
                                "risk_level"
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<GuidedBuyingRecommendationEngine.PolicyRule>
    activePolicyRules() {
        return jdbcTemplate.query(
                """
                SELECT
                    policy_code,
                    policy_type,
                    threshold_amount,
                    currency
                FROM procurement_policies
                WHERE status =
                    'ACTIVE'
                ORDER BY
                    policy_code
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new GuidedBuyingRecommendationEngine.PolicyRule(
                                resultSet.getString(
                                        "policy_code"
                                ),
                                ProcurementPolicyType
                                        .valueOf(
                                                resultSet.getString(
                                                        "policy_type"
                                                )
                                        ),
                                resultSet.getBigDecimal(
                                        "threshold_amount"
                                ),
                                resultSet.getString(
                                        "currency"
                                )
                        )
        );
    }

    public void createIntake(
            UUID id,
            String intakeNumber,
            GuidedBuyingIntakeInput input,
            UUID requesterUserId,
            GuidedBuyingRoute route,
            String guidanceSummary,
            String currency
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO guided_buying_intakes (
                    id,
                    intake_number,
                    title,
                    description,
                    department_id,
                    category,
                    currency,
                    estimated_amount,
                    supplier_id,
                    template_id,
                    requester_user_id,
                    status,
                    guidance_route,
                    guidance_summary,
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
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    ?,
                    'DRAFT',
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                """,
                id,
                intakeNumber,
                input.title()
                        .trim(),
                normalizeOptional(
                        input.description()
                ),
                input.departmentId(),
                input.category()
                        .trim(),
                currency,
                input.estimatedAmount(),
                input.supplierId(),
                input.templateId(),
                requesterUserId,
                route.name(),
                guidanceSummary,
                normalizeOptional(
                        input.notes()
                )
        );
    }

    public void refreshGuidance(
            UUID intakeId,
            GuidedBuyingRoute route,
            String guidanceSummary
    ) {
        jdbcTemplate.update(
                """
                UPDATE guided_buying_intakes
                SET
                    guidance_route = ?,
                    guidance_summary = ?,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status
                    <> 'CANCELLED'
                """,
                route.name(),
                guidanceSummary,
                intakeId
        );
    }

    public void markReady(
            UUID intakeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE guided_buying_intakes
                SET
                    status = 'READY',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status = 'DRAFT'
                """,
                intakeId
        );
    }

    public void linkPurchaseRequest(
            UUID intakeId,
            UUID purchaseRequestId
    ) {
        jdbcTemplate.update(
                """
                UPDATE guided_buying_intakes
                SET
                    linked_purchase_request_id = ?,
                    status = 'CONVERTED',
                    converted_at =
                        CURRENT_TIMESTAMP,
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'READY'
                )
                """,
                purchaseRequestId,
                intakeId
        );
    }

    public void cancelIntake(
            UUID intakeId
    ) {
        jdbcTemplate.update(
                """
                UPDATE guided_buying_intakes
                SET
                    status = 'CANCELLED',
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                AND status IN (
                    'DRAFT',
                    'READY'
                )
                """,
                intakeId
        );
    }

    public IntakeRow findIntake(
            UUID intakeId
    ) {
        return jdbcTemplate.query(
                intakeSql()
                        + """
                        WHERE intake.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapIntake(
                                resultSet
                        ),
                intakeId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<IntakeRow> findIntakes() {
        return jdbcTemplate.query(
                intakeSql()
                        + """
                        ORDER BY
                            CASE intake.status
                                WHEN 'READY'
                                THEN 1
                                WHEN 'DRAFT'
                                THEN 2
                                WHEN 'CONVERTED'
                                THEN 3
                                ELSE 4
                            END,
                            intake.updated_at DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapIntake(
                                resultSet
                        )
        );
    }

    public PurchaseRequestRow findAvailablePurchaseRequest(
            UUID requestId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    request.id,
                    request.request_number,
                    request.title,
                    request.department_id,
                    department.name
                        AS department_name,
                    request.status,
                    request.currency,
                    request.estimated_total_amount
                FROM purchase_requests request

                JOIN departments department
                    ON department.id =
                       request.department_id

                WHERE request.id = ?
                AND request.status
                    <> 'CANCELLED'

                AND NOT EXISTS (
                    SELECT 1
                    FROM guided_buying_intakes
                        intake
                    WHERE
                        intake.linked_purchase_request_id =
                            request.id
                    AND intake.id
                        <> COALESCE(
                            (
                                SELECT id
                                FROM guided_buying_intakes
                                WHERE linked_purchase_request_id =
                                    request.id
                                LIMIT 1
                            ),
                            '00000000-0000-0000-0000-000000000000'::UUID
                        )
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new PurchaseRequestRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "request_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getObject(
                                        "department_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "department_name"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "estimated_total_amount"
                                )
                        ),
                requestId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public List<GuidedBuyingDepartmentOptionResponse> departments() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    name
                FROM departments
                ORDER BY
                    name
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new GuidedBuyingDepartmentOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "name"
                                )
                        )
        );
    }

    public List<GuidedBuyingUserOptionResponse> users() {
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
                        new GuidedBuyingUserOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "full_name"
                                ),
                                ProcurementRole
                                        .valueOf(
                                                resultSet.getString(
                                                        "role"
                                                )
                                        )
                        )
        );
    }

    public List<GuidedBuyingRequestOptionResponse>
    purchaseRequests() {
        return jdbcTemplate.query(
                """
                SELECT
                    request.id,
                    request.request_number,
                    request.title,
                    request.department_id,
                    department.name
                        AS department_name,
                    request.status,
                    request.currency,
                    request.estimated_total_amount
                FROM purchase_requests request

                JOIN departments department
                    ON department.id =
                       request.department_id

                WHERE request.status
                    <> 'CANCELLED'

                AND NOT EXISTS (
                    SELECT 1
                    FROM guided_buying_intakes
                        intake
                    WHERE
                        intake.linked_purchase_request_id =
                            request.id
                )

                ORDER BY
                    request.created_at DESC

                LIMIT 150
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new GuidedBuyingRequestOptionResponse(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "request_number"
                                ),
                                resultSet.getString(
                                        "title"
                                ),
                                resultSet.getObject(
                                        "department_id",
                                        UUID.class
                                ),
                                resultSet.getString(
                                        "department_name"
                                ),
                                resultSet.getString(
                                        "status"
                                ),
                                resultSet.getString(
                                        "currency"
                                ),
                                resultSet.getBigDecimal(
                                        "estimated_total_amount"
                                )
                        )
        );
    }

    public List<String> categories() {
        return jdbcTemplate.queryForList(
                """
                SELECT DISTINCT category
                FROM (
                    SELECT category
                    FROM guided_buying_templates

                    UNION

                    SELECT category
                    FROM preferred_supplier_categories

                    UNION

                    SELECT category
                    FROM suppliers

                    UNION

                    SELECT category
                    FROM purchase_order_lines
                ) categories
                WHERE category IS NOT NULL
                AND category <> ''
                ORDER BY
                    category
                """,
                String.class
        );
    }

    private String templateSql() {
        return """
                SELECT
                    template.id,
                    template.template_code,
                    template.name,
                    template.description,
                    template.category,
                    template.default_title,
                    template.default_currency,
                    template.default_estimated_amount,
                    template.default_department_id,

                    department.name
                        AS default_department_name,

                    template.active,
                    template.owner_user_id,

                    owner.full_name
                        AS owner_name,

                    template.created_at,
                    template.updated_at,
                    template.version

                FROM guided_buying_templates
                    template

                JOIN app_users owner
                    ON owner.id =
                       template.owner_user_id

                LEFT JOIN departments department
                    ON department.id =
                       template.default_department_id

                """;
    }

    private String preferredSupplierSql() {
        return """
                SELECT
                    mapping.id,
                    mapping.category,
                    mapping.supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.country
                        AS supplier_country,
                    supplier.risk_level
                        AS supplier_risk_level,
                    supplier.rating
                        AS supplier_rating,

                    mapping.preference_rank,
                    mapping.active,
                    mapping.notes,
                    mapping.created_by_user_id,

                    creator.full_name
                        AS created_by_name,

                    mapping.created_at,
                    mapping.updated_at,
                    mapping.version

                FROM preferred_supplier_categories
                    mapping

                JOIN suppliers supplier
                    ON supplier.id =
                       mapping.supplier_id

                JOIN app_users creator
                    ON creator.id =
                       mapping.created_by_user_id

                """;
    }

    private String intakeSql() {
        return """
                SELECT
                    intake.id,
                    intake.intake_number,
                    intake.title,
                    intake.description,

                    intake.department_id,
                    department.name
                        AS department_name,

                    intake.category,
                    intake.currency,
                    intake.estimated_amount,

                    intake.supplier_id,
                    supplier.legal_name
                        AS supplier_name,
                    supplier.risk_level
                        AS supplier_risk_level,

                    intake.template_id,
                    template.template_code,
                    template.name
                        AS template_name,

                    intake.requester_user_id,
                    requester.full_name
                        AS requester_name,

                    intake.status,
                    intake.guidance_route,
                    intake.guidance_summary,

                    intake.linked_purchase_request_id,

                    request.request_number
                        AS linked_request_number,

                    request.status
                        AS linked_request_status,

                    intake.notes,
                    intake.converted_at,
                    intake.created_at,
                    intake.updated_at,
                    intake.version

                FROM guided_buying_intakes
                    intake

                JOIN departments department
                    ON department.id =
                       intake.department_id

                JOIN app_users requester
                    ON requester.id =
                       intake.requester_user_id

                LEFT JOIN suppliers supplier
                    ON supplier.id =
                       intake.supplier_id

                LEFT JOIN guided_buying_templates
                    template
                    ON template.id =
                       intake.template_id

                LEFT JOIN purchase_requests request
                    ON request.id =
                       intake.linked_purchase_request_id

                """;
    }

    private TemplateRow mapTemplate(
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

        return new TemplateRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "template_code"
                ),
                resultSet.getString(
                        "name"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getString(
                        "category"
                ),
                resultSet.getString(
                        "default_title"
                ),
                resultSet.getString(
                        "default_currency"
                ),
                resultSet.getBigDecimal(
                        "default_estimated_amount"
                ),
                resultSet.getObject(
                        "default_department_id",
                        UUID.class
                ),
                resultSet.getString(
                        "default_department_name"
                ),
                resultSet.getBoolean(
                        "active"
                ),
                resultSet.getObject(
                        "owner_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "owner_name"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private PreferredSupplierRow mapPreferredSupplier(
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

        double rating =
                resultSet.getBigDecimal(
                        "supplier_rating"
                ) == null
                        ? 0.0
                        : resultSet
                                .getBigDecimal(
                                        "supplier_rating"
                                )
                                .doubleValue();

        return new PreferredSupplierRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "category"
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
                        "supplier_country"
                ),
                resultSet.getString(
                        "supplier_risk_level"
                ),
                rating,
                resultSet.getInt(
                        "preference_rank"
                ),
                resultSet.getBoolean(
                        "active"
                ),
                resultSet.getString(
                        "notes"
                ),
                resultSet.getObject(
                        "created_by_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "created_by_name"
                ),
                created.toInstant(),
                updated.toInstant(),
                resultSet.getLong(
                        "version"
                )
        );
    }

    private IntakeRow mapIntake(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp converted =
                resultSet.getTimestamp(
                        "converted_at"
                );

        Timestamp created =
                resultSet.getTimestamp(
                        "created_at"
                );

        Timestamp updated =
                resultSet.getTimestamp(
                        "updated_at"
                );

        return new IntakeRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "intake_number"
                ),
                resultSet.getString(
                        "title"
                ),
                resultSet.getString(
                        "description"
                ),
                resultSet.getObject(
                        "department_id",
                        UUID.class
                ),
                resultSet.getString(
                        "department_name"
                ),
                resultSet.getString(
                        "category"
                ),
                resultSet.getString(
                        "currency"
                ),
                resultSet.getBigDecimal(
                        "estimated_amount"
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getString(
                        "supplier_name"
                ),
                resultSet.getString(
                        "supplier_risk_level"
                ),
                resultSet.getObject(
                        "template_id",
                        UUID.class
                ),
                resultSet.getString(
                        "template_code"
                ),
                resultSet.getString(
                        "template_name"
                ),
                resultSet.getObject(
                        "requester_user_id",
                        UUID.class
                ),
                resultSet.getString(
                        "requester_name"
                ),
                GuidedBuyingIntakeStatus
                        .valueOf(
                                resultSet.getString(
                                        "status"
                                )
                        ),
                GuidedBuyingRoute
                        .valueOf(
                                resultSet.getString(
                                        "guidance_route"
                                )
                        ),
                resultSet.getString(
                        "guidance_summary"
                ),
                resultSet.getObject(
                        "linked_purchase_request_id",
                        UUID.class
                ),
                resultSet.getString(
                        "linked_request_number"
                ),
                resultSet.getString(
                        "linked_request_status"
                ),
                resultSet.getString(
                        "notes"
                ),
                converted == null
                        ? null
                        : converted.toInstant(),
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

    public record TemplateRow(
            UUID id,
            String templateCode,
            String name,
            String description,
            String category,
            String defaultTitle,
            String defaultCurrency,
            BigDecimal defaultEstimatedAmount,
            UUID defaultDepartmentId,
            String defaultDepartmentName,
            boolean active,
            UUID ownerUserId,
            String ownerName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record PreferredSupplierRow(
            UUID id,
            String category,
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String supplierCountry,
            String supplierRiskLevel,
            double supplierRating,
            int preferenceRank,
            boolean active,
            String notes,
            UUID createdByUserId,
            String createdByName,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record IntakeRow(
            UUID id,
            String intakeNumber,
            String title,
            String description,
            UUID departmentId,
            String departmentName,
            String category,
            String currency,
            BigDecimal estimatedAmount,
            UUID supplierId,
            String supplierName,
            String supplierRiskLevel,
            UUID templateId,
            String templateCode,
            String templateName,
            UUID requesterUserId,
            String requesterName,
            GuidedBuyingIntakeStatus status,
            GuidedBuyingRoute guidanceRoute,
            String guidanceSummary,
            UUID linkedPurchaseRequestId,
            String linkedRequestNumber,
            String linkedRequestStatus,
            String notes,
            Instant convertedAt,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record PurchaseRequestRow(
            UUID id,
            String requestNumber,
            String title,
            UUID departmentId,
            String departmentName,
            String status,
            String currency,
            BigDecimal estimatedTotal
    ) {
    }
}
