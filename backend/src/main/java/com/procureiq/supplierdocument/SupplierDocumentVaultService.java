package com.procureiq.supplierdocument;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@Transactional
public class SupplierDocumentVaultService {

    private final SupplierDocumentRepository repository;

    private final AppUserRepository appUserRepository;

    public SupplierDocumentVaultService(
            SupplierDocumentRepository repository,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public SupplierDocumentVaultDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<SupplierComplianceItemResponse> items =
                repository
                        .allItems()
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        return new SupplierDocumentVaultDashboardResponse(
                summary(
                        items
                ),
                items,
                repository
                        .requirements()
                        .stream()
                        .map(
                                this::requirementResponse
                        )
                        .toList()
        );
    }

    public SupplierDocumentRequirementResponse createRequirement(
            UUID currentUserId,
            SupplierDocumentRequirementInput input
    ) {
        assertConfigureRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        UUID requirementId =
                UUID.randomUUID();

        repository.createRequirement(
                requirementId,
                input,
                normalizeRequirementCode(
                        input.requirementCode()
                )
        );

        return requirementResponse(
                requireRequirement(
                        requirementId
                )
        );
    }

    public SupplierDocumentRequirementResponse updateRequirement(
            UUID currentUserId,
            UUID requirementId,
            SupplierDocumentRequirementUpdateInput input
    ) {
        assertConfigureRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireRequirement(
                requirementId
        );

        repository.updateRequirement(
                requirementId,
                input
        );

        return requirementResponse(
                requireRequirement(
                        requirementId
                )
        );
    }

    public SupplierDocumentVersionResponse approveVersion(
            UUID currentUserId,
            UUID versionId,
            SupplierDocumentReviewInput input
    ) {
        assertReviewRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierDocumentRepository.VersionRow version =
                requireVersion(
                        versionId
                );

        ensureReviewableLatestVersion(
                version
        );

        if (
                version.expiryRequired()
                &&
                version.expiryDate()
                        == null
        ) {
            throw new IllegalArgumentException(
                    "This document requirement requires an expiry date."
            );
        }

        if (
                version.expiryDate()
                        != null
                &&
                version.expiryDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "An already expired document cannot be validated."
            );
        }

        repository.reviewVersion(
                version.id(),
                SupplierDocumentVersionStatus.VALID,
                currentUserId,
                input.note()
        );

        repository.insertEvent(
                version.documentId(),
                version.id(),
                SupplierDocumentEventType.VALIDATED,
                currentUserId,
                null,
                input.note()
        );

        return versionResponse(
                requireVersion(
                        versionId
                )
        );
    }

    public SupplierDocumentVersionResponse rejectVersion(
            UUID currentUserId,
            UUID versionId,
            SupplierDocumentReviewInput input
    ) {
        assertReviewRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierDocumentRepository.VersionRow version =
                requireVersion(
                        versionId
                );

        ensureReviewableLatestVersion(
                version
        );

        repository.reviewVersion(
                version.id(),
                SupplierDocumentVersionStatus.REJECTED,
                currentUserId,
                input.note()
        );

        repository.insertEvent(
                version.documentId(),
                version.id(),
                SupplierDocumentEventType.REJECTED,
                currentUserId,
                null,
                input.note()
        );

        return versionResponse(
                requireVersion(
                        versionId
                )
        );
    }

    @Transactional(readOnly = true)
    public SupplierDocumentContentResponse content(
            UUID currentUserId,
            UUID versionId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireVersion(
                versionId
        );

        SupplierDocumentRepository.ContentRow content =
                repository
                        .content(
                                versionId
                        );

        if (content == null) {
            throw new ResourceNotFoundException(
                    "Supplier document content not found."
            );
        }

        return new SupplierDocumentContentResponse(
                content.fileName(),
                content.contentType(),
                content.sha256Checksum(),
                Base64
                        .getEncoder()
                        .encodeToString(
                                content.content()
                        )
        );
    }

    private SupplierDocumentVaultSummaryResponse summary(
            List<SupplierComplianceItemResponse> items
    ) {
        Set<UUID> suppliers =
                items.stream()
                        .map(
                                SupplierComplianceItemResponse::
                                        supplierId
                        )
                        .collect(
                                Collectors.toSet()
                        );

        Map<
                UUID,
                List<SupplierComplianceItemResponse>
        > bySupplier =
                items.stream()
                        .collect(
                                Collectors.groupingBy(
                                        SupplierComplianceItemResponse::
                                                supplierId
                                )
                        );

        long fullyCompliant =
                bySupplier
                        .values()
                        .stream()
                        .filter(
                                supplierItems ->
                                        supplierItems
                                                .stream()
                                                .filter(
                                                        SupplierComplianceItemResponse::
                                                                mandatory
                                                )
                                                .allMatch(
                                                        item ->
                                                                isCurrent(
                                                                        item.effectiveStatus()
                                                                )
                                                )
                        )
                        .count();

        return new SupplierDocumentVaultSummaryResponse(
                suppliers.size(),
                items.stream()
                        .filter(
                                SupplierComplianceItemResponse::
                                        mandatory
                        )
                        .count(),
                items.stream()
                        .filter(
                                item ->
                                        isCurrent(
                                                item.effectiveStatus()
                                        )
                        )
                        .count(),
                countStatus(
                        items,
                        SupplierDocumentEffectiveStatus.SUBMITTED
                ),
                countStatus(
                        items,
                        SupplierDocumentEffectiveStatus.RENEWAL_REQUIRED
                ),
                countStatus(
                        items,
                        SupplierDocumentEffectiveStatus.EXPIRED
                ),
                countStatus(
                        items,
                        SupplierDocumentEffectiveStatus.REJECTED
                ),
                countStatus(
                        items,
                        SupplierDocumentEffectiveStatus.MISSING
                ),
                fullyCompliant,
                items.stream()
                        .filter(
                                SupplierComplianceItemResponse::
                                        onboardingRelevant
                        )
                        .filter(
                                item ->
                                        !isCurrent(
                                                item.effectiveStatus()
                                        )
                        )
                        .count(),
                items.stream()
                        .filter(
                                SupplierComplianceItemResponse::
                                        sustainabilityRelevant
                        )
                        .filter(
                                item ->
                                        !isCurrent(
                                                item.effectiveStatus()
                                        )
                        )
                        .count()
        );
    }

    private long countStatus(
            List<SupplierComplianceItemResponse> items,
            SupplierDocumentEffectiveStatus status
    ) {
        return items.stream()
                .filter(
                        item ->
                                item.effectiveStatus()
                                        == status
                )
                .count();
    }

    private SupplierComplianceItemResponse itemResponse(
            SupplierDocumentRepository.ItemRow row
    ) {
        List<SupplierDocumentVersionResponse> versions =
                row.documentId()
                                == null
                        ? List.of()
                        : repository
                                .versions(
                                        row.documentId()
                                )
                                .stream()
                                .map(
                                        this::versionResponse
                                )
                                .toList();

        return new SupplierComplianceItemResponse(
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.supplierCategory(),
                row.requirementId(),
                row.requirementCode(),
                row.requirementName(),
                row.documentType(),
                row.categoryScope(),
                row.mandatory(),
                row.expiryRequired(),
                row.renewalLeadDays(),
                row.onboardingRelevant(),
                row.sustainabilityRelevant(),
                row.documentId(),
                effectiveStatus(
                        row.latestStatus(),
                        row.latestExpiryDate(),
                        row.renewalLeadDays()
                ),
                row.latestVersionId(),
                row.latestVersionNumber(),
                row.latestFileName(),
                row.latestExpiryDate(),
                row.versionCount(),
                versions
        );
    }

    private SupplierDocumentVersionResponse versionResponse(
            SupplierDocumentRepository.VersionRow row
    ) {
        return new SupplierDocumentVersionResponse(
                row.id(),
                row.versionNumber(),
                row.originalFileName(),
                row.contentType(),
                row.fileSizeBytes(),
                row.sha256Checksum(),
                row.expiryDate(),
                row.status(),
                row.submittedBy(),
                row.reviewerName(),
                row.reviewNote(),
                row.reviewedAt(),
                row.createdAt()
        );
    }

    private SupplierDocumentRequirementResponse requirementResponse(
            SupplierDocumentRepository.RequirementRow row
    ) {
        return new SupplierDocumentRequirementResponse(
                row.id(),
                row.requirementCode(),
                row.name(),
                row.description(),
                row.documentType(),
                row.categoryScope(),
                row.mandatory(),
                row.expiryRequired(),
                row.renewalLeadDays(),
                row.onboardingRelevant(),
                row.sustainabilityRelevant(),
                row.active()
        );
    }

    private SupplierDocumentEffectiveStatus effectiveStatus(
            SupplierDocumentVersionStatus status,
            LocalDate expiryDate,
            int renewalLeadDays
    ) {
        if (status == null) {
            return SupplierDocumentEffectiveStatus.MISSING;
        }

        if (
                status
                        == SupplierDocumentVersionStatus.SUBMITTED
        ) {
            return SupplierDocumentEffectiveStatus.SUBMITTED;
        }

        if (
                status
                        == SupplierDocumentVersionStatus.REJECTED
        ) {
            return SupplierDocumentEffectiveStatus.REJECTED;
        }

        if (expiryDate == null) {
            return SupplierDocumentEffectiveStatus.VALID;
        }

        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        if (
                expiryDate.isBefore(
                        today
                )
        ) {
            return SupplierDocumentEffectiveStatus.EXPIRED;
        }

        if (
                !expiryDate.isAfter(
                        today.plusDays(
                                renewalLeadDays
                        )
                )
        ) {
            return SupplierDocumentEffectiveStatus.RENEWAL_REQUIRED;
        }

        return SupplierDocumentEffectiveStatus.VALID;
    }

    private boolean isCurrent(
            SupplierDocumentEffectiveStatus status
    ) {
        return status
                        == SupplierDocumentEffectiveStatus.VALID
                ||
                status
                        == SupplierDocumentEffectiveStatus.RENEWAL_REQUIRED;
    }

    private void ensureReviewableLatestVersion(
            SupplierDocumentRepository.VersionRow version
    ) {
        if (
                version.status()
                        != SupplierDocumentVersionStatus.SUBMITTED
        ) {
            throw new IllegalArgumentException(
                    "Only submitted document versions can be reviewed."
            );
        }

        if (
                !repository
                        .isLatestVersion(
                                version.documentId(),
                                version.id()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Only the latest document version can be reviewed."
            );
        }
    }

    private SupplierDocumentRepository.RequirementRow requireRequirement(
            UUID requirementId
    ) {
        SupplierDocumentRepository.RequirementRow requirement =
                repository
                        .findRequirement(
                                requirementId
                        );

        if (requirement == null) {
            throw new ResourceNotFoundException(
                    "Supplier document requirement not found: "
                            + requirementId
            );
        }

        return requirement;
    }

    private SupplierDocumentRepository.VersionRow requireVersion(
            UUID versionId
    ) {
        SupplierDocumentRepository.VersionRow version =
                repository
                        .findVersion(
                                versionId
                        );

        if (version == null) {
            throw new ResourceNotFoundException(
                    "Supplier compliance document version not found: "
                            + versionId
            );
        }

        return version;
    }

    private String normalizeRequirementCode(
            String value
    ) {
        return value
                .trim()
                .toUpperCase(
                        Locale.ROOT
                )
                .replaceAll(
                        "[^A-Z0-9]+",
                        "_"
                )
                .replaceAll(
                        "^_+|_+$",
                        ""
                );
    }

    private AppUserEntity findCurrentUser(
            UUID userId
    ) {
        AppUserEntity user =
                appUserRepository
                        .findById(
                                userId
                        )
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Authenticated ProcureIQ user not found."
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "The authenticated ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private void assertReadRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
                &&
                role != ProcurementRole.APPROVER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot access supplier document compliance."
            );
        }
    }

    private void assertReviewRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
                &&
                role != ProcurementRole.BUYER
        ) {
            throw new IllegalArgumentException(
                    "Your ProcureIQ role cannot review supplier compliance documents."
            );
        }
    }

    private void assertConfigureRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can configure document requirements."
            );
        }
    }
}
