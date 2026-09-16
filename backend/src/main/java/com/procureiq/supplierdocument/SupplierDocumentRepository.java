package com.procureiq.supplierdocument;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public class SupplierDocumentRepository {

    private final JdbcTemplate jdbcTemplate;

    public SupplierDocumentRepository(
            JdbcTemplate jdbcTemplate
    ) {
        this.jdbcTemplate =
                jdbcTemplate;
    }

    public List<RequirementRow> requirements() {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    requirement_code,
                    name,
                    description,
                    document_type,
                    category_scope,
                    mandatory,
                    expiry_required,
                    renewal_lead_days,
                    onboarding_relevant,
                    sustainability_relevant,
                    active
                FROM supplier_document_requirements
                ORDER BY
                    active DESC,
                    mandatory DESC,
                    requirement_code
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRequirement(
                                resultSet
                        )
        );
    }

    public RequirementRow findRequirement(
            UUID requirementId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    requirement_code,
                    name,
                    description,
                    document_type,
                    category_scope,
                    mandatory,
                    expiry_required,
                    renewal_lead_days,
                    onboarding_relevant,
                    sustainability_relevant,
                    active
                FROM supplier_document_requirements
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRequirement(
                                resultSet
                        ),
                requirementId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public RequirementRow findApplicableRequirement(
            UUID supplierId,
            UUID requirementId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    requirement.id,
                    requirement.requirement_code,
                    requirement.name,
                    requirement.description,
                    requirement.document_type,
                    requirement.category_scope,
                    requirement.mandatory,
                    requirement.expiry_required,
                    requirement.renewal_lead_days,
                    requirement.onboarding_relevant,
                    requirement.sustainability_relevant,
                    requirement.active

                FROM supplier_document_requirements
                    requirement

                JOIN suppliers supplier
                    ON supplier.id = ?

                WHERE requirement.id = ?

                AND requirement.active =
                    TRUE

                AND (
                    requirement.category_scope
                        IS NULL
                    OR LOWER(
                        BTRIM(
                            requirement.category_scope
                        )
                    )
                    =
                    LOWER(
                        BTRIM(
                            supplier.category
                        )
                    )
                )
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapRequirement(
                                resultSet
                        ),
                supplierId,
                requirementId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public void createRequirement(
            UUID requirementId,
            SupplierDocumentRequirementInput input,
            String code
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_document_requirements (
                    id,
                    requirement_code,
                    name,
                    description,
                    document_type,
                    category_scope,
                    mandatory,
                    expiry_required,
                    renewal_lead_days,
                    onboarding_relevant,
                    sustainability_relevant,
                    active,
                    created_at,
                    updated_at
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
                    TRUE,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                )
                """,
                requirementId,
                code,
                input.name()
                        .trim(),
                input.description()
                        .trim(),
                input.documentType()
                        .name(),
                normalizeOptional(
                        input.categoryScope()
                ),
                input.mandatory(),
                input.expiryRequired(),
                input.renewalLeadDays(),
                input.onboardingRelevant(),
                input.sustainabilityRelevant()
        );
    }

    public void updateRequirement(
            UUID requirementId,
            SupplierDocumentRequirementUpdateInput input
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_document_requirements
                SET
                    name = ?,
                    description = ?,
                    category_scope = ?,
                    mandatory = ?,
                    expiry_required = ?,
                    renewal_lead_days = ?,
                    onboarding_relevant = ?,
                    sustainability_relevant = ?,
                    active = ?,
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                """,
                input.name()
                        .trim(),
                input.description()
                        .trim(),
                normalizeOptional(
                        input.categoryScope()
                ),
                input.mandatory(),
                input.expiryRequired(),
                input.renewalLeadDays(),
                input.onboardingRelevant(),
                input.sustainabilityRelevant(),
                input.active(),
                requirementId
        );
    }

    public List<ItemRow> allItems() {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE supplier.status =
                            'ACTIVE'

                        ORDER BY
                            supplier.legal_name,
                            requirement.mandatory DESC,
                            requirement.requirement_code
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        )
        );
    }

    public List<ItemRow> supplierItems(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                itemSql()
                        + """
                        WHERE supplier.id = ?

                        AND supplier.status =
                            'ACTIVE'

                        ORDER BY
                            requirement.mandatory DESC,
                            requirement.requirement_code
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapItem(
                                resultSet
                        ),
                supplierId
        );
    }

    public DocumentRow ensureDocument(
            UUID supplierId,
            UUID requirementId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_document_vault_documents (
                    id,
                    supplier_id,
                    requirement_id,
                    created_at,
                    updated_at,
                    version
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP,
                    0
                )
                ON CONFLICT (
                    supplier_id,
                    requirement_id
                )
                DO NOTHING
                """,
                UUID.randomUUID(),
                supplierId,
                requirementId
        );

        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_id,
                    requirement_id
                FROM supplier_document_vault_documents
                WHERE supplier_id = ?
                AND requirement_id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new DocumentRow(
                                resultSet.getObject(
                                        "id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "supplier_id",
                                        UUID.class
                                ),
                                resultSet.getObject(
                                        "requirement_id",
                                        UUID.class
                                )
                        ),
                supplierId,
                requirementId
        )
                .stream()
                .findFirst()
                .orElseThrow();
    }

    public int nextVersionNumber(
            UUID documentId
    ) {
        Integer value =
                jdbcTemplate.queryForObject(
                        """
                        SELECT
                            COALESCE(
                                MAX(
                                    version_number
                                ),
                                0
                            )
                            + 1
                        FROM supplier_compliance_document_versions
                        WHERE document_id = ?
                        """,
                        Integer.class,
                        documentId
                );

        return value == null
                ? 1
                : value;
    }

    public void insertVersion(
            UUID versionId,
            UUID documentId,
            int versionNumber,
            SupplierDocumentFilePolicyService.ValidatedFile file,
            LocalDate expiryDate,
            UUID portalAccountId,
            UUID internalUserId
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_compliance_document_versions (
                    id,
                    document_id,
                    version_number,
                    original_file_name,
                    content_type,
                    file_size_bytes,
                    sha256_checksum,
                    content_bytes,
                    expiry_date,
                    status,
                    submitted_by_portal_account_id,
                    submitted_by_user_id,
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
                    'SUBMITTED',
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
                """,
                versionId,
                documentId,
                versionNumber,
                file.originalFileName(),
                file.contentType(),
                file.fileSizeBytes(),
                file.sha256Checksum(),
                file.content(),
                expiryDate,
                portalAccountId,
                internalUserId
        );

        jdbcTemplate.update(
                """
                UPDATE supplier_document_vault_documents
                SET
                    updated_at =
                        CURRENT_TIMESTAMP,
                    version =
                        version + 1
                WHERE id = ?
                """,
                documentId
        );
    }

    public void insertEvent(
            UUID documentId,
            UUID versionId,
            SupplierDocumentEventType eventType,
            UUID actorUserId,
            UUID actorPortalAccountId,
            String note
    ) {
        jdbcTemplate.update(
                """
                INSERT INTO supplier_compliance_document_events (
                    id,
                    document_id,
                    version_id,
                    event_type,
                    actor_user_id,
                    actor_portal_account_id,
                    note,
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
                    CURRENT_TIMESTAMP
                )
                """,
                UUID.randomUUID(),
                documentId,
                versionId,
                eventType.name(),
                actorUserId,
                actorPortalAccountId,
                normalizeOptional(
                        note
                )
        );
    }

    public List<VersionRow> versions(
            UUID documentId
    ) {
        return jdbcTemplate.query(
                versionSql()
                        + """
                        WHERE version.document_id = ?
                        ORDER BY
                            version.version_number DESC
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapVersion(
                                resultSet
                        ),
                documentId
        );
    }

    public VersionRow findVersion(
            UUID versionId
    ) {
        return jdbcTemplate.query(
                versionSql()
                        + """
                        WHERE version.id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapVersion(
                                resultSet
                        ),
                versionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public VersionRow findSupplierVersion(
            UUID supplierId,
            UUID versionId
    ) {
        return jdbcTemplate.query(
                versionSql()
                        + """
                        WHERE version.id = ?
                        AND document.supplier_id = ?
                        """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        mapVersion(
                                resultSet
                        ),
                versionId,
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public boolean isLatestVersion(
            UUID documentId,
            UUID versionId
    ) {
        Boolean value =
                jdbcTemplate.queryForObject(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM supplier_compliance_document_versions
                            WHERE id = ?
                            AND document_id = ?
                            AND version_number = (
                                SELECT MAX(
                                    version_number
                                )
                                FROM supplier_compliance_document_versions
                                WHERE document_id = ?
                            )
                        )
                        """,
                        Boolean.class,
                        versionId,
                        documentId,
                        documentId
                );

        return Boolean.TRUE.equals(
                value
        );
    }

    public void reviewVersion(
            UUID versionId,
            SupplierDocumentVersionStatus status,
            UUID reviewerUserId,
            String note
    ) {
        jdbcTemplate.update(
                """
                UPDATE supplier_compliance_document_versions
                SET
                    status = ?,
                    reviewed_by_user_id = ?,
                    review_note = ?,
                    reviewed_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
                AND status =
                    'SUBMITTED'
                """,
                status.name(),
                reviewerUserId,
                note.trim(),
                versionId
        );
    }

    public ContentRow content(
            UUID versionId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    original_file_name,
                    content_type,
                    sha256_checksum,
                    content_bytes
                FROM supplier_compliance_document_versions
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new ContentRow(
                                resultSet.getString(
                                        "original_file_name"
                                ),
                                resultSet.getString(
                                        "content_type"
                                ),
                                resultSet.getString(
                                        "sha256_checksum"
                                ),
                                resultSet.getBytes(
                                        "content_bytes"
                                )
                        ),
                versionId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    public SupplierProfileRow supplierProfile(
            UUID supplierId
    ) {
        return jdbcTemplate.query(
                """
                SELECT
                    id,
                    supplier_code,
                    legal_name,
                    category
                FROM suppliers
                WHERE id = ?
                """,
                (
                        resultSet,
                        rowNumber
                ) ->
                        new SupplierProfileRow(
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
                                )
                        ),
                supplierId
        )
                .stream()
                .findFirst()
                .orElse(null);
    }

    private String itemSql() {
        return """
                SELECT
                    supplier.id
                        AS supplier_id,

                    supplier.supplier_code,
                    supplier.legal_name
                        AS supplier_name,

                    supplier.category
                        AS supplier_category,

                    requirement.id
                        AS requirement_id,

                    requirement.requirement_code,
                    requirement.name
                        AS requirement_name,

                    requirement.document_type,
                    requirement.category_scope,
                    requirement.mandatory,
                    requirement.expiry_required,
                    requirement.renewal_lead_days,
                    requirement.onboarding_relevant,
                    requirement.sustainability_relevant,

                    document.id
                        AS document_id,

                    latest.id
                        AS latest_version_id,

                    latest.version_number
                        AS latest_version_number,

                    latest.original_file_name
                        AS latest_file_name,

                    latest.expiry_date
                        AS latest_expiry_date,

                    latest.status
                        AS latest_status,

                    (
                        SELECT COUNT(*)
                        FROM supplier_compliance_document_versions
                            version_count
                        WHERE
                            version_count.document_id =
                                document.id
                    )
                        AS version_count

                FROM suppliers supplier

                JOIN supplier_document_requirements
                    requirement
                    ON requirement.active =
                       TRUE

                AND (
                    requirement.category_scope
                        IS NULL
                    OR LOWER(
                        BTRIM(
                            requirement.category_scope
                        )
                    )
                    =
                    LOWER(
                        BTRIM(
                            supplier.category
                        )
                    )
                )

                LEFT JOIN supplier_document_vault_documents
                    document
                    ON document.supplier_id =
                       supplier.id
                    AND document.requirement_id =
                        requirement.id

                LEFT JOIN LATERAL (
                    SELECT
                        version.id,
                        version.version_number,
                        version.original_file_name,
                        version.expiry_date,
                        version.status

                    FROM supplier_compliance_document_versions
                        version

                    WHERE
                        version.document_id =
                            document.id

                    ORDER BY
                        version.version_number DESC

                    LIMIT 1
                )
                    latest
                    ON TRUE

                """;
    }

    private String versionSql() {
        return """
                SELECT
                    version.id,
                    version.document_id,

                    document.supplier_id,
                    document.requirement_id,

                    requirement.expiry_required,
                    requirement.renewal_lead_days,

                    version.version_number,
                    version.original_file_name,
                    version.content_type,
                    version.file_size_bytes,
                    version.sha256_checksum,
                    version.expiry_date,
                    version.status,

                    portal_account.display_name
                        AS portal_submitter_name,

                    internal_submitter.full_name
                        AS internal_submitter_name,

                    reviewer.full_name
                        AS reviewer_name,

                    version.review_note,
                    version.reviewed_at,
                    version.created_at

                FROM supplier_compliance_document_versions
                    version

                JOIN supplier_document_vault_documents
                    document
                    ON document.id =
                       version.document_id

                JOIN supplier_document_requirements
                    requirement
                    ON requirement.id =
                       document.requirement_id

                LEFT JOIN supplier_portal_accounts
                    portal_account
                    ON portal_account.id =
                       version.submitted_by_portal_account_id

                LEFT JOIN app_users
                    internal_submitter
                    ON internal_submitter.id =
                       version.submitted_by_user_id

                LEFT JOIN app_users reviewer
                    ON reviewer.id =
                       version.reviewed_by_user_id

                """;
    }

    private RequirementRow mapRequirement(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        return new RequirementRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getString(
                        "requirement_code"
                ),
                resultSet.getString(
                        "name"
                ),
                resultSet.getString(
                        "description"
                ),
                SupplierDocumentType.valueOf(
                        resultSet.getString(
                                "document_type"
                        )
                ),
                resultSet.getString(
                        "category_scope"
                ),
                resultSet.getBoolean(
                        "mandatory"
                ),
                resultSet.getBoolean(
                        "expiry_required"
                ),
                resultSet.getInt(
                        "renewal_lead_days"
                ),
                resultSet.getBoolean(
                        "onboarding_relevant"
                ),
                resultSet.getBoolean(
                        "sustainability_relevant"
                ),
                resultSet.getBoolean(
                        "active"
                )
        );
    }

    private ItemRow mapItem(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        String latestStatus =
                resultSet.getString(
                        "latest_status"
                );

        Integer latestVersionNumber =
                (
                        Integer
                )
                resultSet.getObject(
                        "latest_version_number"
                );

        return new ItemRow(
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
                resultSet.getObject(
                        "requirement_id",
                        UUID.class
                ),
                resultSet.getString(
                        "requirement_code"
                ),
                resultSet.getString(
                        "requirement_name"
                ),
                SupplierDocumentType.valueOf(
                        resultSet.getString(
                                "document_type"
                        )
                ),
                resultSet.getString(
                        "category_scope"
                ),
                resultSet.getBoolean(
                        "mandatory"
                ),
                resultSet.getBoolean(
                        "expiry_required"
                ),
                resultSet.getInt(
                        "renewal_lead_days"
                ),
                resultSet.getBoolean(
                        "onboarding_relevant"
                ),
                resultSet.getBoolean(
                        "sustainability_relevant"
                ),
                resultSet.getObject(
                        "document_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "latest_version_id",
                        UUID.class
                ),
                latestVersionNumber,
                resultSet.getString(
                        "latest_file_name"
                ),
                resultSet.getObject(
                        "latest_expiry_date",
                        LocalDate.class
                ),
                latestStatus == null
                        ? null
                        : SupplierDocumentVersionStatus.valueOf(
                                latestStatus
                        ),
                resultSet.getInt(
                        "version_count"
                )
        );
    }

    private VersionRow mapVersion(
            java.sql.ResultSet resultSet
    ) throws java.sql.SQLException {
        Timestamp reviewed =
                resultSet.getTimestamp(
                        "reviewed_at"
                );

        String submittedBy =
                resultSet.getString(
                        "portal_submitter_name"
                );

        if (submittedBy == null) {
            submittedBy =
                    resultSet.getString(
                            "internal_submitter_name"
                    );
        }

        return new VersionRow(
                resultSet.getObject(
                        "id",
                        UUID.class
                ),
                resultSet.getObject(
                        "document_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "supplier_id",
                        UUID.class
                ),
                resultSet.getObject(
                        "requirement_id",
                        UUID.class
                ),
                resultSet.getBoolean(
                        "expiry_required"
                ),
                resultSet.getInt(
                        "renewal_lead_days"
                ),
                resultSet.getInt(
                        "version_number"
                ),
                resultSet.getString(
                        "original_file_name"
                ),
                resultSet.getString(
                        "content_type"
                ),
                resultSet.getLong(
                        "file_size_bytes"
                ),
                resultSet.getString(
                        "sha256_checksum"
                ),
                resultSet.getObject(
                        "expiry_date",
                        LocalDate.class
                ),
                SupplierDocumentVersionStatus.valueOf(
                        resultSet.getString(
                                "status"
                        )
                ),
                submittedBy,
                resultSet.getString(
                        "reviewer_name"
                ),
                resultSet.getString(
                        "review_note"
                ),
                reviewed == null
                        ? null
                        : reviewed.toInstant(),
                resultSet.getTimestamp(
                        "created_at"
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

    public record RequirementRow(
            UUID id,
            String requirementCode,
            String name,
            String description,
            SupplierDocumentType documentType,
            String categoryScope,
            boolean mandatory,
            boolean expiryRequired,
            int renewalLeadDays,
            boolean onboardingRelevant,
            boolean sustainabilityRelevant,
            boolean active
    ) {
    }

    public record ItemRow(
            UUID supplierId,
            String supplierCode,
            String supplierName,
            String supplierCategory,
            UUID requirementId,
            String requirementCode,
            String requirementName,
            SupplierDocumentType documentType,
            String categoryScope,
            boolean mandatory,
            boolean expiryRequired,
            int renewalLeadDays,
            boolean onboardingRelevant,
            boolean sustainabilityRelevant,
            UUID documentId,
            UUID latestVersionId,
            Integer latestVersionNumber,
            String latestFileName,
            LocalDate latestExpiryDate,
            SupplierDocumentVersionStatus latestStatus,
            int versionCount
    ) {
    }

    public record DocumentRow(
            UUID id,
            UUID supplierId,
            UUID requirementId
    ) {
    }

    public record VersionRow(
            UUID id,
            UUID documentId,
            UUID supplierId,
            UUID requirementId,
            boolean expiryRequired,
            int renewalLeadDays,
            int versionNumber,
            String originalFileName,
            String contentType,
            long fileSizeBytes,
            String sha256Checksum,
            LocalDate expiryDate,
            SupplierDocumentVersionStatus status,
            String submittedBy,
            String reviewerName,
            String reviewNote,
            Instant reviewedAt,
            Instant createdAt
    ) {
    }

    public record ContentRow(
            String fileName,
            String contentType,
            String sha256Checksum,
            byte[] content
    ) {
    }

    public record SupplierProfileRow(
            UUID id,
            String supplierCode,
            String supplierName,
            String category
    ) {
    }
}
