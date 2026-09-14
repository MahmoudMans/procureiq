package com.procureiq.supplierdocument;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.supplierportal.SupplierPortalProfileResponse;
import com.procureiq.supplierportal.SupplierPortalRepository;
import com.procureiq.supplierportal.SupplierPortalSecurityService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class SupplierPortalDocumentService {

    private final SupplierDocumentRepository repository;

    private final SupplierDocumentFilePolicyService filePolicyService;

    private final SupplierPortalRepository portalRepository;

    private final SupplierPortalSecurityService portalSecurityService;

    public SupplierPortalDocumentService(
            SupplierDocumentRepository repository,
            SupplierDocumentFilePolicyService filePolicyService,
            SupplierPortalRepository portalRepository,
            SupplierPortalSecurityService portalSecurityService
    ) {
        this.repository =
                repository;

        this.filePolicyService =
                filePolicyService;

        this.portalRepository =
                portalRepository;

        this.portalSecurityService =
                portalSecurityService;
    }

    public SupplierPortalDocumentDashboardResponse dashboard(
            String rawSessionToken
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        portalRepository.touchSession(
                session.id()
        );

        List<SupplierComplianceItemResponse> items =
                repository
                        .supplierItems(
                                session.supplierId()
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList();

        long onboardingRelevant =
                items.stream()
                        .filter(
                                SupplierComplianceItemResponse::
                                        onboardingRelevant
                        )
                        .filter(
                                SupplierComplianceItemResponse::
                                        mandatory
                        )
                        .count();

        long onboardingCurrent =
                items.stream()
                        .filter(
                                SupplierComplianceItemResponse::
                                        onboardingRelevant
                        )
                        .filter(
                                SupplierComplianceItemResponse::
                                        mandatory
                        )
                        .filter(
                                item ->
                                        isCurrent(
                                                item.effectiveStatus()
                                        )
                        )
                        .count();

        long sustainabilityRelevant =
                items.stream()
                        .filter(
                                SupplierComplianceItemResponse::
                                        sustainabilityRelevant
                        )
                        .filter(
                                SupplierComplianceItemResponse::
                                        mandatory
                        )
                        .count();

        long sustainabilityCurrent =
                items.stream()
                        .filter(
                                SupplierComplianceItemResponse::
                                        sustainabilityRelevant
                        )
                        .filter(
                                SupplierComplianceItemResponse::
                                        mandatory
                        )
                        .filter(
                                item ->
                                        isCurrent(
                                                item.effectiveStatus()
                                        )
                        )
                        .count();

        return new SupplierPortalDocumentDashboardResponse(
                profile(
                        session
                ),
                new SupplierPortalDocumentSummaryResponse(
                        items.size(),
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
                        onboardingRelevant
                                ==
                                onboardingCurrent,
                        sustainabilityRelevant
                                ==
                                sustainabilityCurrent
                ),
                items
        );
    }

    public SupplierPortalDocumentDashboardResponse upload(
            String rawSessionToken,
            UUID requirementId,
            MultipartFile file,
            LocalDate expiryDate
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        SupplierDocumentRepository.RequirementRow requirement =
                repository
                        .findApplicableRequirement(
                                session.supplierId(),
                                requirementId
                        );

        if (requirement == null) {
            throw new ResourceNotFoundException(
                    "Supplier document requirement is unavailable for this supplier."
            );
        }

        if (
                requirement.expiryRequired()
                &&
                expiryDate == null
        ) {
            throw new IllegalArgumentException(
                    "This compliance-document requirement requires an expiry date."
            );
        }

        if (
                expiryDate != null
                &&
                expiryDate.isBefore(
                        LocalDate.now(
                                ZoneOffset.UTC
                        )
                )
        ) {
            throw new IllegalArgumentException(
                    "An already expired compliance document cannot be submitted."
            );
        }

        SupplierDocumentFilePolicyService.ValidatedFile validatedFile =
                filePolicyService
                        .validate(
                                file
                        );

        SupplierDocumentRepository.DocumentRow document =
                repository
                        .ensureDocument(
                                session.supplierId(),
                                requirementId
                        );

        int versionNumber =
                repository
                        .nextVersionNumber(
                                document.id()
                        );

        UUID versionId =
                UUID.randomUUID();

        try {
            repository.insertVersion(
                    versionId,
                    document.id(),
                    versionNumber,
                    validatedFile,
                    expiryDate,
                    session.accountId(),
                    null
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "This exact document version has already been submitted.",
                    exception
            );
        }

        repository.insertEvent(
                document.id(),
                versionId,
                SupplierDocumentEventType.SUBMITTED,
                null,
                session.accountId(),
                "Supplier portal document submission."
        );

        portalRepository.touchSession(
                session.id()
        );

        portalRepository.writeAudit(
                session.accountId(),
                session.supplierId(),
                "DOCUMENT_SUBMITTED",
                "Supplier submitted compliance document "
                        + requirement.requirementCode()
                        + " version "
                        + versionNumber
        );

        return dashboard(
                rawSessionToken
        );
    }

    public SupplierDocumentContentResponse content(
            String rawSessionToken,
            UUID versionId
    ) {
        SupplierPortalRepository.SessionRow session =
                requireSession(
                        rawSessionToken
                );

        SupplierDocumentRepository.VersionRow version =
                repository
                        .findSupplierVersion(
                                session.supplierId(),
                                versionId
                        );

        if (version == null) {
            throw new ResourceNotFoundException(
                    "Supplier document version is unavailable for this account."
            );
        }

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

        portalRepository.touchSession(
                session.id()
        );

        portalRepository.writeAudit(
                session.accountId(),
                session.supplierId(),
                "DOCUMENT_DOWNLOADED",
                "Supplier downloaded compliance document version "
                        + version.versionNumber()
        );

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

    private SupplierPortalRepository.SessionRow requireSession(
            String rawSessionToken
    ) {
        String tokenHash =
                portalSecurityService
                        .hashToken(
                                rawSessionToken
                        );

        SupplierPortalRepository.SessionRow session =
                portalRepository
                        .findActiveSession(
                                tokenHash
                        );

        if (session == null) {
            throw new IllegalArgumentException(
                    "Supplier portal session is invalid or expired."
            );
        }

        return session;
    }

    private SupplierPortalProfileResponse profile(
            SupplierPortalRepository.SessionRow session
    ) {
        return new SupplierPortalProfileResponse(
                session.accountId(),
                session.supplierId(),
                session.supplierCode(),
                session.supplierName(),
                session.email(),
                session.displayName()
        );
    }
}
