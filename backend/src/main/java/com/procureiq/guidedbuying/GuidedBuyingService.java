package com.procureiq.guidedbuying;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class GuidedBuyingService {

    private final GuidedBuyingRepository repository;

    private final GuidedBuyingRecommendationEngine recommendationEngine;

    private final AppUserRepository appUserRepository;

    public GuidedBuyingService(
            GuidedBuyingRepository repository,
            GuidedBuyingRecommendationEngine recommendationEngine,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.recommendationEngine =
                recommendationEngine;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<GuidedBuyingIntakeResponse> intakes(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        return repository
                .findIntakes()
                .stream()
                .map(
                        this::intakeResponse
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public GuidedBuyingIntakeResponse intake(
            UUID currentUserId,
            UUID intakeId
    ) {
        findCurrentUser(
                currentUserId
        );

        return intakeResponse(
                requireIntake(
                        intakeId
                )
        );
    }

    public GuidedBuyingIntakeResponse createIntake(
            UUID currentUserId,
            GuidedBuyingIntakeInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        validateTemplate(
                input.templateId()
        );

        String currency =
                normalizeCurrency(
                        input.currency()
                );

        GuidedBuyingRecommendationEngine.Recommendation recommendation =
                recommendation(
                        input
                );

        UUID id =
                UUID.randomUUID();

        repository.createIntake(
                id,
                nextIntakeNumber(),
                input,
                currentUser.getId(),
                recommendation.route(),
                recommendation.summary(),
                currency
        );

        return intakeResponse(
                requireIntake(
                        id
                )
        );
    }

    @Transactional(readOnly = true)
    public GuidedBuyingRecommendationResponse recommend(
            UUID currentUserId,
            GuidedBuyingIntakeInput input
    ) {
        findCurrentUser(
                currentUserId
        );

        GuidedBuyingRecommendationEngine.Recommendation recommendation =
                recommendation(
                        input
                );

        return new GuidedBuyingRecommendationResponse(
                recommendation.route(),
                recommendation.summary(),
                recommendation.signals(),
                repository
                        .findPreferredSuppliersForCategory(
                                input.category()
                        )
                        .stream()
                        .map(
                                this::preferredSupplierResponse
                        )
                        .toList()
        );
    }

    public GuidedBuyingIntakeResponse refreshGuidance(
            UUID currentUserId,
            UUID intakeId
    ) {
        findCurrentUser(
                currentUserId
        );

        GuidedBuyingRepository.IntakeRow intake =
                requireIntake(
                        intakeId
                );

        if (
                intake.status()
                        == GuidedBuyingIntakeStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Cancelled guided-buying intakes cannot be refreshed."
            );
        }

        GuidedBuyingIntakeInput input =
                new GuidedBuyingIntakeInput(
                        intake.title(),
                        intake.description(),
                        intake.departmentId(),
                        intake.category(),
                        intake.currency(),
                        intake.estimatedAmount(),
                        intake.supplierId(),
                        intake.templateId(),
                        intake.notes()
                );

        GuidedBuyingRecommendationEngine.Recommendation recommendation =
                recommendation(
                        input
                );

        repository.refreshGuidance(
                intakeId,
                recommendation.route(),
                recommendation.summary()
        );

        return intakeResponse(
                requireIntake(
                        intakeId
                )
        );
    }

    public GuidedBuyingIntakeResponse markReady(
            UUID currentUserId,
            UUID intakeId
    ) {
        findCurrentUser(
                currentUserId
        );

        GuidedBuyingRepository.IntakeRow intake =
                requireIntake(
                        intakeId
                );

        if (
                intake.status()
                        != GuidedBuyingIntakeStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft guided-buying intakes can be marked ready."
            );
        }

        repository.markReady(
                intakeId
        );

        return intakeResponse(
                requireIntake(
                        intakeId
                )
        );
    }

    public GuidedBuyingIntakeResponse linkRequest(
            UUID currentUserId,
            UUID intakeId,
            GuidedBuyingRequestLinkInput input
    ) {
        findCurrentUser(
                currentUserId
        );

        GuidedBuyingRepository.IntakeRow intake =
                requireIntake(
                        intakeId
                );

        if (
                intake.status()
                        != GuidedBuyingIntakeStatus.DRAFT
                &&
                intake.status()
                        != GuidedBuyingIntakeStatus.READY
        ) {
            throw new IllegalArgumentException(
                    "Only draft or ready intakes can be converted to a purchase request."
            );
        }

        GuidedBuyingRepository.PurchaseRequestRow request =
                repository
                        .findAvailablePurchaseRequest(
                                input.purchaseRequestId()
                        );

        if (request == null) {
            throw new ResourceNotFoundException(
                    "Purchase request is unavailable for guided-buying linkage: "
                            + input.purchaseRequestId()
            );
        }

        if (
                !request.departmentId()
                        .equals(
                                intake.departmentId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Purchase request department must match the guided-buying intake department."
            );
        }

        if (
                !request.currency()
                        .equalsIgnoreCase(
                                intake.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Purchase request currency must match the guided-buying intake currency."
            );
        }

        try {
            repository.linkPurchaseRequest(
                    intakeId,
                    request.id()
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "This purchase request is already linked to another guided-buying intake."
            );
        }

        return intakeResponse(
                requireIntake(
                        intakeId
                )
        );
    }

    public GuidedBuyingIntakeResponse cancelIntake(
            UUID currentUserId,
            UUID intakeId
    ) {
        findCurrentUser(
                currentUserId
        );

        GuidedBuyingRepository.IntakeRow intake =
                requireIntake(
                        intakeId
                );

        if (
                intake.status()
                        == GuidedBuyingIntakeStatus.CONVERTED
        ) {
            throw new IllegalArgumentException(
                    "Converted guided-buying intakes cannot be cancelled."
            );
        }

        if (
                intake.status()
                        == GuidedBuyingIntakeStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Guided-buying intake is already cancelled."
            );
        }

        repository.cancelIntake(
                intakeId
        );

        return intakeResponse(
                requireIntake(
                        intakeId
                )
        );
    }

    @Transactional(readOnly = true)
    public List<GuidedBuyingTemplateResponse> templates(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        return repository
                .findTemplates()
                .stream()
                .map(
                        this::templateResponse
                )
                .toList();
    }

    public GuidedBuyingTemplateResponse createTemplate(
            UUID currentUserId,
            GuidedBuyingTemplateInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertGovernanceRole(
                currentUser.getRole()
        );

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireGovernanceUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID id =
                UUID.randomUUID();

        repository.createTemplate(
                id,
                nextTemplateCode(),
                input,
                ownerId,
                normalizeCurrency(
                        input.defaultCurrency()
                )
        );

        return templateResponse(
                requireTemplate(
                        id
                )
        );
    }

    public GuidedBuyingTemplateResponse setTemplateActive(
            UUID currentUserId,
            UUID templateId,
            boolean active
    ) {
        assertGovernanceRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireTemplate(
                templateId
        );

        repository.setTemplateActive(
                templateId,
                active
        );

        return templateResponse(
                requireTemplate(
                        templateId
                )
        );
    }

    @Transactional(readOnly = true)
    public List<PreferredSupplierResponse> preferredSuppliers(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        return repository
                .findPreferredSuppliers()
                .stream()
                .map(
                        this::preferredSupplierResponse
                )
                .toList();
    }

    public PreferredSupplierResponse createPreferredSupplier(
            UUID currentUserId,
            PreferredSupplierInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertGovernanceRole(
                currentUser.getRole()
        );

        UUID id =
                UUID.randomUUID();

        try {
            repository.createPreferredSupplier(
                    id,
                    input,
                    currentUserId
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "This supplier is already active as a preferred supplier for the selected category."
            );
        }

        return preferredSupplierResponse(
                requirePreferredSupplier(
                        id
                )
        );
    }

    public PreferredSupplierResponse deactivatePreferredSupplier(
            UUID currentUserId,
            UUID preferredSupplierId
    ) {
        assertGovernanceRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requirePreferredSupplier(
                preferredSupplierId
        );

        repository.deactivatePreferredSupplier(
                preferredSupplierId
        );

        return preferredSupplierResponse(
                requirePreferredSupplier(
                        preferredSupplierId
                )
        );
    }

    @Transactional(readOnly = true)
    public GuidedBuyingSummaryResponse summary(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        List<GuidedBuyingRepository.IntakeRow> intakes =
                repository
                        .findIntakes();

        long drafts =
                intakes.stream()
                        .filter(
                                intake ->
                                        intake.status()
                                                == GuidedBuyingIntakeStatus.DRAFT
                        )
                        .count();

        long ready =
                intakes.stream()
                        .filter(
                                intake ->
                                        intake.status()
                                                == GuidedBuyingIntakeStatus.READY
                        )
                        .count();

        long converted =
                intakes.stream()
                        .filter(
                                intake ->
                                        intake.status()
                                                == GuidedBuyingIntakeStatus.CONVERTED
                        )
                        .count();

        long competitive =
                intakes.stream()
                        .filter(
                                intake ->
                                        intake.status()
                                                != GuidedBuyingIntakeStatus.CANCELLED
                                        &&
                                        intake.guidanceRoute()
                                                == GuidedBuyingRoute.COMPETITIVE_SOURCING
                        )
                        .count();

        long risk =
                intakes.stream()
                        .filter(
                                intake ->
                                        intake.status()
                                                != GuidedBuyingIntakeStatus.CANCELLED
                                        &&
                                        intake.guidanceRoute()
                                                == GuidedBuyingRoute.RISK_REVIEW
                        )
                        .count();

        long multi =
                intakes.stream()
                        .filter(
                                intake ->
                                        intake.status()
                                                != GuidedBuyingIntakeStatus.CANCELLED
                                        &&
                                        intake.guidanceRoute()
                                                == GuidedBuyingRoute.MULTI_CONTROL
                        )
                        .count();

        BigDecimal pipelineValue =
                intakes.stream()
                        .filter(
                                intake ->
                                        intake.status()
                                                == GuidedBuyingIntakeStatus.DRAFT
                                        ||
                                        intake.status()
                                                == GuidedBuyingIntakeStatus.READY
                        )
                        .map(
                                GuidedBuyingRepository.IntakeRow::
                                        estimatedAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        long activeTemplates =
                repository
                        .findActiveTemplates()
                        .size();

        long activePreferredSuppliers =
                repository
                        .findPreferredSuppliers()
                        .stream()
                        .filter(
                                GuidedBuyingRepository.PreferredSupplierRow::
                                        active
                        )
                        .count();

        return new GuidedBuyingSummaryResponse(
                intakes.size(),
                drafts,
                ready,
                converted,
                competitive,
                risk,
                multi,
                activeTemplates,
                activePreferredSuppliers,
                pipelineValue
        );
    }

    @Transactional(readOnly = true)
    public GuidedBuyingContextResponse contextOptions(
            UUID currentUserId
    ) {
        findCurrentUser(
                currentUserId
        );

        return new GuidedBuyingContextResponse(
                repository.departments(),
                repository.users(),
                repository
                        .findActiveTemplates()
                        .stream()
                        .map(
                                this::templateResponse
                        )
                        .toList(),
                repository
                        .findPreferredSuppliers()
                        .stream()
                        .filter(
                                GuidedBuyingRepository.PreferredSupplierRow::
                                        active
                        )
                        .map(
                                this::preferredSupplierResponse
                        )
                        .toList(),
                repository.purchaseRequests(),
                repository.categories()
        );
    }

    private GuidedBuyingRecommendationEngine.Recommendation
    recommendation(
            GuidedBuyingIntakeInput input
    ) {
        String supplierRisk =
                repository
                        .supplierRiskLevel(
                                input.supplierId()
                        );

        return recommendationEngine
                .recommend(
                        input.estimatedAmount(),
                        normalizeCurrency(
                                input.currency()
                        ),
                        supplierRisk,
                        repository
                                .activePolicyRules()
                );
    }

    private void validateTemplate(
            UUID templateId
    ) {
        if (templateId == null) {
            return;
        }

        GuidedBuyingRepository.TemplateRow template =
                requireTemplate(
                        templateId
                );

        if (!template.active()) {
            throw new IllegalArgumentException(
                    "Inactive guided-buying templates cannot be used for new intakes."
            );
        }
    }

    private GuidedBuyingIntakeResponse intakeResponse(
            GuidedBuyingRepository.IntakeRow row
    ) {
        return new GuidedBuyingIntakeResponse(
                row.id(),
                row.intakeNumber(),
                row.title(),
                row.description(),
                row.departmentId(),
                row.departmentName(),
                row.category(),
                row.currency(),
                money(
                        row.estimatedAmount()
                ),
                row.supplierId(),
                row.supplierName(),
                row.supplierRiskLevel(),
                row.templateId(),
                row.templateCode(),
                row.templateName(),
                row.requesterUserId(),
                row.requesterName(),
                row.status(),
                row.guidanceRoute(),
                row.guidanceSummary(),
                row.linkedPurchaseRequestId(),
                row.linkedRequestNumber(),
                row.linkedRequestStatus(),
                row.notes(),
                row.convertedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private GuidedBuyingTemplateResponse templateResponse(
            GuidedBuyingRepository.TemplateRow row
    ) {
        return new GuidedBuyingTemplateResponse(
                row.id(),
                row.templateCode(),
                row.name(),
                row.description(),
                row.category(),
                row.defaultTitle(),
                row.defaultCurrency(),
                moneyNullable(
                        row.defaultEstimatedAmount()
                ),
                row.defaultDepartmentId(),
                row.defaultDepartmentName(),
                row.active(),
                row.ownerUserId(),
                row.ownerName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private PreferredSupplierResponse preferredSupplierResponse(
            GuidedBuyingRepository.PreferredSupplierRow row
    ) {
        return new PreferredSupplierResponse(
                row.id(),
                row.category(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.supplierCountry(),
                row.supplierRiskLevel(),
                row.supplierRating(),
                row.preferenceRank(),
                row.active(),
                row.notes(),
                row.createdByUserId(),
                row.createdByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private GuidedBuyingRepository.IntakeRow requireIntake(
            UUID intakeId
    ) {
        GuidedBuyingRepository.IntakeRow intake =
                repository
                        .findIntake(
                                intakeId
                        );

        if (intake == null) {
            throw new ResourceNotFoundException(
                    "Guided-buying intake not found: "
                            + intakeId
            );
        }

        return intake;
    }

    private GuidedBuyingRepository.TemplateRow requireTemplate(
            UUID templateId
    ) {
        GuidedBuyingRepository.TemplateRow template =
                repository
                        .findTemplate(
                                templateId
                        );

        if (template == null) {
            throw new ResourceNotFoundException(
                    "Guided-buying template not found: "
                            + templateId
            );
        }

        return template;
    }

    private GuidedBuyingRepository.PreferredSupplierRow
    requirePreferredSupplier(
            UUID preferredSupplierId
    ) {
        GuidedBuyingRepository.PreferredSupplierRow preferredSupplier =
                repository
                        .findPreferredSupplier(
                                preferredSupplierId
                        );

        if (preferredSupplier == null) {
            throw new ResourceNotFoundException(
                    "Preferred supplier mapping not found: "
                            + preferredSupplierId
            );
        }

        return preferredSupplier;
    }

    private String nextTemplateCode() {
        Long sequence =
                repository
                        .nextTemplateSequence();

        return String.format(
                "GBT-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private String nextIntakeNumber() {
        Long sequence =
                repository
                        .nextIntakeSequence();

        return String.format(
                "GBI-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private String normalizeCurrency(
            String currency
    ) {
        if (
                currency == null
                ||
                currency.trim()
                        .length()
                        != 3
        ) {
            throw new IllegalArgumentException(
                    "Guided-buying currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private BigDecimal money(
            BigDecimal value
    ) {
        return (
                value == null
                        ? BigDecimal.ZERO
                        : value
        )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal moneyNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : value.setScale(
                        2,
                        RoundingMode.HALF_UP
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

    private AppUserEntity requireGovernanceUser(
            UUID userId
    ) {
        AppUserEntity user =
                findCurrentUser(
                        userId
                );

        if (
                user.getRole()
                        == ProcurementRole.REQUESTER
        ) {
            throw new IllegalArgumentException(
                    "Guided-buying template ownership requires a procurement governance role."
            );
        }

        return user;
    }

    private void assertGovernanceRole(
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
                    "Your ProcureIQ role cannot manage guided-buying configuration."
            );
        }
    }
}
