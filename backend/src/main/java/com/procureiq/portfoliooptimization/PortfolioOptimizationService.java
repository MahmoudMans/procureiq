package com.procureiq.portfoliooptimization;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@Transactional
public class PortfolioOptimizationService {

    private final PortfolioOptimizationRepository repository;

    private final PortfolioOptimizationEngine engine;

    private final AppUserRepository appUserRepository;

    public PortfolioOptimizationService(
            PortfolioOptimizationRepository repository,
            PortfolioOptimizationEngine engine,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.engine =
                engine;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public PortfolioOptimizationDashboardResponse dashboard(
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

        List<PortfolioScenarioSummaryResponse> scenarios =
                repository
                        .scenarios(
                                normalizedCurrency
                        )
                        .stream()
                        .map(
                                this::summaryResponse
                        )
                        .toList();

        List<PortfolioScenarioSummaryResponse> comparable =
                scenarios.stream()
                        .filter(
                                scenario ->
                                        scenario.status()
                                                == PortfolioScenarioStatus.EVALUATED
                                        ||
                                        scenario.status()
                                                == PortfolioScenarioStatus.APPROVED
                        )
                        .filter(
                                PortfolioScenarioSummaryResponse::
                                        minimumTargetMet
                        )
                        .filter(
                                scenario ->
                                        scenario.selectedCount()
                                                > 0
                        )
                        .toList();

        UUID recommended =
                comparable.stream()
                        .sorted(
                                Comparator
                                        .comparing(
                                                PortfolioScenarioSummaryResponse::
                                                        selectedTargetSavings
                                        )
                                        .reversed()
                                        .thenComparing(
                                                PortfolioScenarioSummaryResponse::
                                                        averageSelectedRisk
                                        )
                                        .thenComparing(
                                                PortfolioScenarioSummaryResponse::
                                                        selectedBudget
                                        )
                        )
                        .map(
                                PortfolioScenarioSummaryResponse::
                                        id
                        )
                        .findFirst()
                        .orElse(null);

        BigDecimal approvedBudget =
                scenarios.stream()
                        .filter(
                                scenario ->
                                        scenario.status()
                                                == PortfolioScenarioStatus.APPROVED
                        )
                        .map(
                                PortfolioScenarioSummaryResponse::
                                        selectedBudget
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal approvedSavings =
                scenarios.stream()
                        .filter(
                                scenario ->
                                        scenario.status()
                                                == PortfolioScenarioStatus.APPROVED
                        )
                        .map(
                                PortfolioScenarioSummaryResponse::
                                        selectedTargetSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new PortfolioOptimizationDashboardResponse(
                new PortfolioOptimizationSummaryResponse(
                        normalizedCurrency,
                        scenarios.size(),
                        scenarios.stream()
                                .filter(
                                        scenario ->
                                                scenario.status()
                                                        == PortfolioScenarioStatus.EVALUATED
                                )
                                .count(),
                        scenarios.stream()
                                .filter(
                                        scenario ->
                                                scenario.status()
                                                        == PortfolioScenarioStatus.APPROVED
                                )
                                .count(),
                        money(
                                approvedBudget
                        ),
                        money(
                                approvedSavings
                        ),
                        recommended
                ),
                scenarios
        );
    }

    @Transactional(readOnly = true)
    public PortfolioScenarioDetailResponse scenario(
            UUID currentUserId,
            UUID scenarioId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        PortfolioOptimizationRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        return new PortfolioScenarioDetailResponse(
                summaryResponse(
                        scenario
                ),
                scenario.notes(),
                repository
                        .items(
                                scenarioId
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList()
        );
    }

    public PortfolioScenarioDetailResponse createScenario(
            UUID currentUserId,
            PortfolioScenarioInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        String currency =
                normalizeCurrency(
                        input.currency()
                );

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requirePortfolioUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID scenarioId =
                UUID.randomUUID();

        repository.createScenario(
                scenarioId,
                nextScenarioCode(),
                input,
                currency,
                ownerId
        );

        return scenario(
                currentUserId,
                scenarioId
        );
    }

    public PortfolioOptimizationRunResponse evaluate(
            UUID currentUserId,
            UUID scenarioId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        PortfolioOptimizationRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        if (
                scenario.status()
                        == PortfolioScenarioStatus.APPROVED
                ||
                scenario.status()
                        == PortfolioScenarioStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Approved or archived portfolio scenarios cannot be re-evaluated."
            );
        }

        List<PortfolioOptimizationCandidate> candidates =
                repository
                        .candidates(
                                scenario.currency()
                        );

        PortfolioOptimizationResult result =
                engine.optimize(
                        candidates,
                        new PortfolioOptimizationConstraints(
                                scenario.budgetLimit(),
                                scenario.maxInitiatives(),
                                scenario.maxAverageRiskScore(),
                                scenario.minTotalTargetSavings(),
                                scenario.allowCriticalPriority()
                        )
                );

        Map<
                UUID,
                PortfolioOptimizationCandidate
        > candidateById =
                candidates.stream()
                        .collect(
                                Collectors.toMap(
                                        PortfolioOptimizationCandidate::
                                                initiativeId,
                                        Function.identity()
                                )
                        );

        repository.clearScenarioItems(
                scenarioId
        );

        for (
                PortfolioOptimizationSelection selection
                : result.selections()
        ) {
            PortfolioOptimizationCandidate candidate =
                    candidateById.get(
                            selection.initiativeId()
                    );

            if (candidate == null) {
                throw new IllegalStateException(
                        "Optimization selection references an unknown category initiative."
                );
            }

            repository.insertScenarioItem(
                    scenarioId,
                    candidate,
                    selection
            );
        }

        repository.markEvaluated(
                scenarioId
        );

        return new PortfolioOptimizationRunResponse(
                result.candidateCount(),
                result.selectedCount(),
                result.candidateCount()
                        -
                        result.selectedCount(),
                result.selectedBudget(),
                result.selectedTargetSavings(),
                result.averageRiskScore(),
                result.minimumTargetMet()
        );
    }

    public PortfolioScenarioSummaryResponse approve(
            UUID currentUserId,
            UUID scenarioId
    ) {
        assertApproveRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        PortfolioOptimizationRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        PortfolioScenarioSummaryResponse summary =
                summaryResponse(
                        scenario
                );

        if (
                summary.status()
                        != PortfolioScenarioStatus.EVALUATED
        ) {
            throw new IllegalArgumentException(
                    "Only evaluated portfolio scenarios can be approved."
            );
        }

        if (
                summary.selectedCount()
                        == 0
        ) {
            throw new IllegalArgumentException(
                    "A scenario with no selected initiatives cannot be approved."
            );
        }

        if (!summary.minimumTargetMet()) {
            throw new IllegalArgumentException(
                    "Scenario does not satisfy its minimum target-savings constraint."
            );
        }

        repository.approveScenario(
                scenarioId,
                currentUserId
        );

        return summaryResponse(
                requireScenario(
                        scenarioId
                )
        );
    }

    public PortfolioScenarioSummaryResponse archive(
            UUID currentUserId,
            UUID scenarioId
    ) {
        assertApproveRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        PortfolioOptimizationRepository.ScenarioRow scenario =
                requireScenario(
                        scenarioId
                );

        if (
                scenario.status()
                        == PortfolioScenarioStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Portfolio scenario is already archived."
            );
        }

        repository.archiveScenario(
                scenarioId
        );

        return summaryResponse(
                requireScenario(
                        scenarioId
                )
        );
    }

    @Transactional(readOnly = true)
    public PortfolioOptimizationContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new PortfolioOptimizationContextResponse(
                repository.users()
        );
    }

    private PortfolioScenarioSummaryResponse summaryResponse(
            PortfolioOptimizationRepository.ScenarioRow row
    ) {
        BigDecimal savingsToBudget =
                row.selectedBudget()
                                .compareTo(
                                        BigDecimal.ZERO
                                ) <= 0
                        ? BigDecimal.ZERO
                        : row
                                .selectedTargetSavings()
                                .multiply(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                                .divide(
                                        row.selectedBudget(),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new PortfolioScenarioSummaryResponse(
                row.id(),
                row.scenarioCode(),
                row.name(),
                row.currency(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                money(
                        row.budgetLimit()
                ),
                row.maxInitiatives(),
                decimal(
                        row.maxAverageRiskScore()
                ),
                money(
                        row.minTotalTargetSavings()
                ),
                row.allowCriticalPriority(),
                row.candidateCount(),
                row.selectedCount(),
                row.excludedCount(),
                money(
                        row.selectedBudget()
                ),
                money(
                        row.selectedTargetSavings()
                ),
                decimal(
                        row.averageSelectedRisk()
                ),
                decimal(
                        savingsToBudget
                ),
                row.selectedTargetSavings()
                                .compareTo(
                                        row.minTotalTargetSavings()
                                )
                        >= 0,
                row.evaluatedAt(),
                row.approvedAt(),
                row.approvedByName(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private PortfolioScenarioItemResponse itemResponse(
            PortfolioOptimizationRepository.ItemRow row
    ) {
        return new PortfolioScenarioItemResponse(
                row.id(),
                row.scenarioId(),
                row.initiativeId(),
                row.initiativeNumber(),
                row.categoryName(),
                row.initiativeTitle(),
                row.initiativeType(),
                row.priority(),
                row.matrixPosition(),
                row.decision(),
                row.rankPosition(),
                money(
                        row.estimatedValue()
                ),
                money(
                        row.targetSavings()
                ),
                decimal(
                        row.savingsEfficiencyPct()
                ),
                decimal(
                        row.strategicValueScore()
                ),
                decimal(
                        row.supplyRiskScore()
                ),
                decimal(
                        row.priorityScore()
                ),
                decimal(
                        row.matrixUrgencyScore()
                ),
                decimal(
                        row.utilityScore()
                ),
                row.exclusionReason()
        );
    }

    private PortfolioOptimizationRepository.ScenarioRow requireScenario(
            UUID scenarioId
    ) {
        PortfolioOptimizationRepository.ScenarioRow scenario =
                repository
                        .findScenario(
                                scenarioId
                        );

        if (scenario == null) {
            throw new ResourceNotFoundException(
                    "Portfolio optimization scenario not found: "
                            + scenarioId
            );
        }

        return scenario;
    }

    private String nextScenarioCode() {
        Long sequence =
                repository
                        .nextScenarioSequence();

        return String.format(
                "PSC-%d-%05d",
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
                    "Portfolio scenario currency must contain exactly three characters."
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

    private BigDecimal decimal(
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

    private AppUserEntity requirePortfolioUser(
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
                    "Portfolio ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access procurement portfolio optimization."
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
                    "Your ProcureIQ role cannot manage procurement optimization scenarios."
            );
        }
    }

    private void assertApproveRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can approve or archive optimization scenarios."
            );
        }
    }
}
