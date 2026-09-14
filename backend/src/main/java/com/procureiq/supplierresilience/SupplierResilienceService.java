package com.procureiq.supplierresilience;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class SupplierResilienceService {

    private static final BigDecimal DEFAULT_DEPENDENCY_TOLERANCE =
            new BigDecimal(
                    "40.00"
            );

    private static final int DEFAULT_MINIMUM_ALTERNATES =
            2;

    private final SupplierResilienceRepository repository;

    private final SupplierResilienceScoringService scoringService;

    private final AppUserRepository appUserRepository;

    public SupplierResilienceService(
            SupplierResilienceRepository repository,
            SupplierResilienceScoringService scoringService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.scoringService =
                scoringService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public List<SupplierResilienceIntelligenceResponse> intelligence(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        return repository
                .supplierMetrics(
                        normalizedCurrency
                )
                .stream()
                .map(
                        row ->
                                intelligenceResponse(
                                        row,
                                        normalizedCurrency
                                )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierResilienceDetailResponse detail(
            UUID currentUserId,
            UUID supplierId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        SupplierResilienceRepository.SupplierMetricRow metric =
                repository
                        .supplierMetric(
                                supplierId,
                                normalizedCurrency
                        );

        if (metric == null) {
            throw new ResourceNotFoundException(
                    "Active supplier not found: "
                            + supplierId
            );
        }

        SupplierResilienceRepository.ProfileRow profile =
                repository
                        .findProfileBySupplier(
                                supplierId
                        );

        List<ResilienceActionResponse> actions =
                profile == null
                        ? List.of()
                        : repository
                                .findActions(
                                        profile.id()
                                )
                                .stream()
                                .map(
                                        this::actionResponse
                                )
                                .toList();

        return new SupplierResilienceDetailResponse(
                intelligenceResponse(
                        metric,
                        normalizedCurrency
                ),
                repository
                        .alternatives(
                                supplierId
                        )
                        .stream()
                        .map(
                                alternative ->
                                        new SupplierAlternativeResponse(
                                                alternative.supplierId(),
                                                alternative.supplierCode(),
                                                alternative.supplierName(),
                                                alternative.country(),
                                                alternative.rating(),
                                                alternative.riskLevel(),
                                                moneyNullable(
                                                        alternative.latestPerformanceScore()
                                                )
                                        )
                        )
                        .toList(),
                actions
        );
    }

    public SupplierResilienceDetailResponse upsertProfile(
            UUID currentUserId,
            UUID supplierId,
            String currency,
            SupplierResilienceProfileInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        if (
                repository
                        .supplierMetric(
                                supplierId,
                                normalizeCurrency(
                                        currency
                                )
                        )
                        == null
        ) {
            throw new ResourceNotFoundException(
                    "Active supplier not found: "
                            + supplierId
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireGovernanceUser(
                                input.ownerUserId()
                        )
                                .getId();

        SupplierResilienceRepository.ProfileRow existing =
                repository
                        .findProfileBySupplier(
                                supplierId
                        );

        UUID profileId =
                existing == null
                        ? UUID.randomUUID()
                        : existing.id();

        repository.upsertProfile(
                profileId,
                supplierId,
                input,
                ownerId
        );

        return detail(
                currentUserId,
                supplierId,
                currency
        );
    }

    public SupplierResilienceDetailResponse deactivateProfile(
            UUID currentUserId,
            UUID supplierId,
            String currency
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierResilienceRepository.ProfileRow profile =
                requireProfileForSupplier(
                        supplierId
                );

        repository.setProfileActive(
                profile.id(),
                false
        );

        return detail(
                currentUserId,
                supplierId,
                currency
        );
    }

    public ResilienceActionResponse createAction(
            UUID currentUserId,
            UUID supplierId,
            ResilienceActionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        SupplierResilienceRepository.ProfileRow profile =
                requireProfileForSupplier(
                        supplierId
                );

        if (
                profile.status()
                        != SupplierResilienceProfileStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Mitigation actions require an active supplier resilience profile."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireGovernanceUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID actionId =
                UUID.randomUUID();

        repository.createAction(
                actionId,
                profile.id(),
                input,
                ownerId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public ResilienceActionResponse startAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierResilienceRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        != ResilienceActionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open resilience actions can be started."
            );
        }

        repository.startAction(
                actionId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public ResilienceActionResponse completeAction(
            UUID currentUserId,
            UUID actionId,
            ResilienceActionCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierResilienceRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        != ResilienceActionStatus.OPEN
                &&
                action.status()
                        != ResilienceActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only open or in-progress resilience actions can be completed."
            );
        }

        repository.completeAction(
                actionId,
                input.note()
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public ResilienceActionResponse cancelAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertApprovalRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierResilienceRepository.ActionRow action =
                requireAction(
                        actionId
                );

        if (
                action.status()
                        == ResilienceActionStatus.COMPLETED
        ) {
            throw new IllegalArgumentException(
                    "Completed resilience actions cannot be cancelled."
            );
        }

        repository.cancelAction(
                actionId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    @Transactional(readOnly = true)
    public List<SupplierCountryConcentrationResponse> countries(
            UUID currentUserId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        return repository
                .countryConcentrations(
                        normalizedCurrency
                )
                .stream()
                .map(
                        row ->
                                new SupplierCountryConcentrationResponse(
                                        row.country(),
                                        normalizedCurrency,
                                        row.supplierCount(),
                                        money(
                                                row.spend()
                                        ),
                                        percentage(
                                                row.spend(),
                                                row.totalSpend()
                                        )
                                )
                )
                .toList();
    }

    @Transactional(readOnly = true)
    public SupplierResilienceSummaryResponse summary(
            UUID currentUserId,
            String currency
    ) {
        List<SupplierResilienceIntelligenceResponse> rows =
                intelligence(
                        currentUserId,
                        currency
                );

        long strategicCritical =
                rows.stream()
                        .filter(
                                row ->
                                        row.criticality()
                                                == SupplierCriticality.CRITICAL
                                        ||
                                        row.criticality()
                                                == SupplierCriticality.STRATEGIC
                        )
                        .count();

        long vulnerable =
                rows.stream()
                        .filter(
                                row ->
                                        row.resilienceBand()
                                                == SupplierResilienceBand.VULNERABLE
                        )
                        .count();

        long critical =
                rows.stream()
                        .filter(
                                row ->
                                        row.resilienceBand()
                                                == SupplierResilienceBand.CRITICAL
                        )
                        .count();

        long singleSource =
                rows.stream()
                        .filter(
                                SupplierResilienceIntelligenceResponse::
                                        singleSource
                        )
                        .count();

        long dependencyBreaches =
                rows.stream()
                        .filter(
                                SupplierResilienceIntelligenceResponse::
                                        dependencyToleranceBreached
                        )
                        .count();

        long constrained =
                rows.stream()
                        .filter(
                                row ->
                                        row.capacityStatus()
                                                == SupplierCapacityStatus.CONSTRAINED
                                        ||
                                        row.capacityStatus()
                                                == SupplierCapacityStatus.AT_RISK
                        )
                        .count();

        long openActions =
                rows.stream()
                        .mapToLong(
                                SupplierResilienceIntelligenceResponse::
                                        openMitigationActions
                        )
                        .sum();

        long overdueActions =
                rows.stream()
                        .mapToLong(
                                SupplierResilienceIntelligenceResponse::
                                        overdueMitigationActions
                        )
                        .sum();

        BigDecimal averageScore =
                rows.isEmpty()
                        ? BigDecimal.ZERO
                                .setScale(2)
                        : rows.stream()
                                .map(
                                        SupplierResilienceIntelligenceResponse::
                                                resilienceScore
                                )
                                .reduce(
                                        BigDecimal.ZERO,
                                        BigDecimal::add
                                )
                                .divide(
                                        BigDecimal.valueOf(
                                                rows.size()
                                        ),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal spendAtRisk =
                rows.stream()
                        .filter(
                                row ->
                                        row.resilienceBand()
                                                == SupplierResilienceBand.VULNERABLE
                                        ||
                                        row.resilienceBand()
                                                == SupplierResilienceBand.CRITICAL
                        )
                        .map(
                                SupplierResilienceIntelligenceResponse::
                                        supplierSpend
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new SupplierResilienceSummaryResponse(
                normalizeCurrency(
                        currency
                ),
                rows.size(),
                strategicCritical,
                vulnerable,
                critical,
                singleSource,
                dependencyBreaches,
                constrained,
                openActions,
                overdueActions,
                averageScore,
                spendAtRisk
        );
    }

    @Transactional(readOnly = true)
    public SupplierResilienceContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new SupplierResilienceContextResponse(
                repository.users()
        );
    }

    private SupplierResilienceIntelligenceResponse intelligenceResponse(
            SupplierResilienceRepository.SupplierMetricRow row,
            String currency
    ) {
        boolean activeProfile =
                row.profileId()
                        != null
                &&
                row.profileStatus()
                        == SupplierResilienceProfileStatus.ACTIVE;

        SupplierCriticality criticality =
                activeProfile
                        &&
                        row.criticality()
                                != null
                        ? row.criticality()
                        : SupplierCriticality.STANDARD;

        SupplierCapacityStatus capacity =
                activeProfile
                        &&
                        row.capacityStatus()
                                != null
                        ? row.capacityStatus()
                        : SupplierCapacityStatus.UNKNOWN;

        BigDecimal tolerance =
                activeProfile
                        &&
                        row.dependencyTolerancePct()
                                != null
                        ? row.dependencyTolerancePct()
                        : DEFAULT_DEPENDENCY_TOLERANCE;

        int minimumAlternates =
                activeProfile
                        &&
                        row.minimumAlternates()
                                != null
                        ? row.minimumAlternates()
                        : DEFAULT_MINIMUM_ALTERNATES;

        BigDecimal spendShare =
                percentage(
                        row.supplierSpend(),
                        row.portfolioSpend()
                );

        BigDecimal categoryShare =
                percentage(
                        row.supplierSpend(),
                        row.categorySpend()
                );

        BigDecimal countryShare =
                percentage(
                        row.countrySpend(),
                        row.portfolioSpend()
                );

        int alternateGap =
                Math.max(
                        0,
                        minimumAlternates
                                -
                                row.alternateSupplierCount()
                );

        boolean dependencyBreach =
                categoryShare.compareTo(
                        tolerance
                ) > 0;

        BigDecimal resilienceScore =
                scoringService
                        .score(
                                spendShare,
                                categoryShare,
                                countryShare,
                                row.alternateSupplierCount(),
                                row.supplierRiskLevel(),
                                row.latestPerformanceScore(),
                                row.openCorrectiveActions(),
                                row.activeContractCoverage(),
                                capacity
                        );

        return new SupplierResilienceIntelligenceResponse(
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.category(),
                row.country(),
                moneyNullable(
                        row.supplierRating()
                ),
                row.supplierRiskLevel(),
                row.profileId(),
                row.profileStatus(),
                criticality,
                capacity,
                tolerance.setScale(
                        2,
                        RoundingMode.HALF_UP
                ),
                minimumAlternates,
                row.businessImpact(),
                row.capacityNotes(),
                row.profileNotes(),
                row.profileOwnerUserId(),
                row.profileOwnerName(),
                currency,
                money(
                        row.supplierSpend()
                ),
                money(
                        row.portfolioSpend()
                ),
                spendShare,
                money(
                        row.categorySpend()
                ),
                categoryShare,
                money(
                        row.countrySpend()
                ),
                countryShare,
                row.alternateSupplierCount(),
                alternateGap,
                row.alternateSupplierCount()
                        == 0,
                dependencyBreach,
                moneyNullable(
                        row.latestPerformanceScore()
                ),
                row.openCorrectiveActions(),
                row.activeContractCoverage(),
                resilienceScore,
                scoringService.band(
                        resilienceScore
                ),
                row.openMitigationActions(),
                row.overdueMitigationActions()
        );
    }

    private ResilienceActionResponse actionResponse(
            SupplierResilienceRepository.ActionRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == ResilienceActionStatus.OPEN
                        ||
                        row.status()
                                == ResilienceActionStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new ResilienceActionResponse(
                row.id(),
                row.profileId(),
                row.actionType(),
                row.title(),
                row.description(),
                row.ownerUserId(),
                row.ownerName(),
                row.dueDate(),
                row.status(),
                overdue,
                row.completionNote(),
                row.completedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private SupplierResilienceRepository.ProfileRow
    requireProfileForSupplier(
            UUID supplierId
    ) {
        SupplierResilienceRepository.ProfileRow profile =
                repository
                        .findProfileBySupplier(
                                supplierId
                        );

        if (profile == null) {
            throw new ResourceNotFoundException(
                    "Supplier resilience profile not found for supplier: "
                            + supplierId
            );
        }

        return profile;
    }

    private SupplierResilienceRepository.ActionRow requireAction(
            UUID actionId
    ) {
        SupplierResilienceRepository.ActionRow action =
                repository
                        .findAction(
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Supplier resilience action not found: "
                            + actionId
            );
        }

        return action;
    }

    private BigDecimal percentage(
            BigDecimal numerator,
            BigDecimal denominator
    ) {
        if (
                numerator == null
                ||
                denominator == null
                ||
                denominator.compareTo(
                        BigDecimal.ZERO
                ) == 0
        ) {
            return BigDecimal.ZERO
                    .setScale(2);
        }

        return numerator
                .multiply(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .divide(
                        denominator,
                        2,
                        RoundingMode.HALF_UP
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
                    "Supplier-resilience currency must contain exactly three characters."
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
                    "Supplier resilience ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access supplier resilience intelligence."
            );
        }
    }

    private void assertWriteRole(
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
                    "Your ProcureIQ role cannot manage supplier resilience."
            );
        }
    }

    private void assertApprovalRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can deactivate resilience profiles or cancel mitigation actions."
            );
        }
    }
}
