package com.procureiq.categorymanagement;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class CategoryManagementService {

    private final CategoryManagementRepository repository;

    private final CategoryOpportunityService opportunityService;

    private final AppUserRepository appUserRepository;

    public CategoryManagementService(
            CategoryManagementRepository repository,
            CategoryOpportunityService opportunityService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.opportunityService =
                opportunityService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public CategoryManagementDashboardResponse dashboard(
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

        List<CategoryInsightResponse> insights =
                categoryInsights(
                        normalizedCurrency
                );

        List<CategoryStrategySummaryResponse> strategies =
                repository
                        .strategies(
                                normalizedCurrency
                        )
                        .stream()
                        .map(
                                this::strategySummary
                        )
                        .toList();

        BigDecimal totalSpend =
                insights.stream()
                        .map(
                                CategoryInsightResponse::
                                        totalSpend
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal opportunity =
                insights.stream()
                        .map(
                                CategoryInsightResponse::
                                        modeledOpportunityAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal strategyTarget =
                strategies.stream()
                        .filter(
                                strategy ->
                                        strategy.status()
                                                != CategoryStrategyStatus.ARCHIVED
                        )
                        .map(
                                CategoryStrategySummaryResponse::
                                        savingsTargetAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal realized =
                strategies.stream()
                        .map(
                                CategoryStrategySummaryResponse::
                                        realizedSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        long activeInitiatives =
                strategies.stream()
                        .mapToLong(
                                CategoryStrategySummaryResponse::
                                        activeInitiatives
                        )
                        .sum();

        return new CategoryManagementDashboardResponse(
                new CategoryManagementSummaryResponse(
                        normalizedCurrency,
                        insights.size(),
                        strategies.stream()
                                .filter(
                                        strategy ->
                                                strategy.status()
                                                        == CategoryStrategyStatus.ACTIVE
                                )
                                .count(),
                        activeInitiatives,
                        insights.stream()
                                .filter(
                                        insight ->
                                                insight.weightedSupplierRiskScore()
                                                        .compareTo(
                                                                new BigDecimal(
                                                                        "50.00"
                                                                )
                                                        ) >= 0
                                )
                                .count(),
                        money(
                                totalSpend
                        ),
                        money(
                                opportunity
                        ),
                        money(
                                strategyTarget
                        ),
                        money(
                                realized
                        )
                ),
                insights,
                strategies
        );
    }

    @Transactional(readOnly = true)
    public CategoryStrategyDetailResponse strategy(
            UUID currentUserId,
            UUID strategyId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.StrategyRow strategy =
                requireStrategy(
                        strategyId
                );

        CategoryManagementRepository.CategoryInsightRow current =
                repository
                        .categoryInsight(
                                strategy.categoryName(),
                                strategy.currency()
                        );

        CategoryInsightResponse currentInsight =
                current == null
                        ? zeroInsight(
                                strategy.categoryName(),
                                strategy.currency()
                        )
                        : insightResponse(
                                current,
                                strategy.currency()
                        );

        return new CategoryStrategyDetailResponse(
                strategySummary(
                        strategy
                ),
                strategy.objectives(),
                currentInsight,
                repository
                        .supplierLandscape(
                                strategy.categoryName(),
                                strategy.currency()
                        )
                        .stream()
                        .map(
                                row ->
                                        new CategorySupplierLandscapeResponse(
                                                row.supplierId(),
                                                row.supplierCode(),
                                                row.supplierName(),
                                                row.country(),
                                                money(
                                                        row.spend()
                                                ),
                                                decimal(
                                                        row.spendShare()
                                                ),
                                                decimalNullable(
                                                        row.riskScore()
                                                ),
                                                row.riskBand()
                                        )
                        )
                        .toList(),
                repository
                        .initiatives(
                                strategy.id()
                        )
                        .stream()
                        .map(
                                this::initiativeResponse
                        )
                        .toList()
        );
    }

    public CategoryStrategyDetailResponse createStrategy(
            UUID currentUserId,
            CategoryStrategyInput input
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

        String category =
                normalizeCategory(
                        input.categoryName()
                );

        CategoryManagementRepository.CategoryInsightRow insight =
                repository
                        .categoryInsight(
                                category,
                                currency
                        );

        if (insight == null) {
            throw new IllegalArgumentException(
                    "Category does not currently exist in the active supplier landscape."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireCategoryUser(
                                input.ownerUserId()
                        )
                                .getId();

        BigDecimal strategicValue =
                opportunityService
                        .strategicValueScore(
                                insight.totalSpend(),
                                insight.supplierCount()
                        );

        BigDecimal riskScore =
                decimal(
                        insight.weightedRiskScore()
                );

        BigDecimal modeledOpportunity =
                opportunityService
                        .modeledOpportunityAmount(
                                insight.totalSpend(),
                                insight.supplierCount(),
                                insight.topSupplierShare()
                        );

        BigDecimal targetAmount =
                insight
                        .totalSpend()
                        .multiply(
                                input.savingsTargetPct()
                        )
                        .divide(
                                new BigDecimal(
                                        "100.00"
                                ),
                                2,
                                RoundingMode.HALF_UP
                        );

        UUID strategyId =
                UUID.randomUUID();

        try {
            repository.createStrategy(
                    strategyId,
                    nextStrategyCode(),
                    input,
                    category,
                    currency,
                    ownerId,
                    money(
                            insight.totalSpend()
                    ),
                    money(
                            modeledOpportunity
                    ),
                    money(
                            targetAmount
                    ),
                    strategicValue,
                    riskScore,
                    opportunityService
                            .matrixPosition(
                                    strategicValue,
                                    riskScore
                            )
            );
        } catch (
                DataIntegrityViolationException exception
        ) {
            throw new IllegalArgumentException(
                    "A strategy already exists for this category, currency and fiscal year.",
                    exception
            );
        }

        return strategy(
                currentUserId,
                strategyId
        );
    }

    public CategoryStrategySummaryResponse updateStrategyStatus(
            UUID currentUserId,
            UUID strategyId,
            CategoryStrategyStatusInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.StrategyRow strategy =
                requireStrategy(
                        strategyId
                );

        validateStrategyTransition(
                strategy.status(),
                input.status()
        );

        repository.updateStrategyStatus(
                strategyId,
                input.status()
        );

        return strategySummary(
                requireStrategy(
                        strategyId
                )
        );
    }

    public CategoryInitiativeResponse createInitiative(
            UUID currentUserId,
            UUID strategyId,
            CategoryInitiativeInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        CategoryManagementRepository.StrategyRow strategy =
                requireStrategy(
                        strategyId
                );

        if (
                strategy.status()
                        == CategoryStrategyStatus.CLOSED
                ||
                strategy.status()
                        == CategoryStrategyStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Closed or archived category strategies cannot receive new initiatives."
            );
        }

        if (
                input.plannedStartDate()
                        != null
                &&
                input.plannedEndDate()
                        != null
                &&
                input.plannedEndDate()
                        .isBefore(
                                input.plannedStartDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Initiative end date cannot precede its start date."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireCategoryUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID initiativeId =
                UUID.randomUUID();

        repository.createInitiative(
                initiativeId,
                nextInitiativeNumber(),
                strategyId,
                input,
                ownerId
        );

        return initiativeResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public CategoryInitiativeResponse readyInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != CategoryInitiativeStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned category initiatives can move to ready."
            );
        }

        repository.updateInitiativeStatus(
                initiativeId,
                CategoryInitiativeStatus.READY
        );

        return initiativeResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public CategoryInitiativeResponse startInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != CategoryInitiativeStatus.READY
                &&
                initiative.status()
                        != CategoryInitiativeStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned or ready initiatives can be started."
            );
        }

        repository.updateInitiativeStatus(
                initiativeId,
                CategoryInitiativeStatus.IN_PROGRESS
        );

        return initiativeResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public CategoryInitiativeResponse completeInitiative(
            UUID currentUserId,
            UUID initiativeId,
            CategoryInitiativeCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != CategoryInitiativeStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only in-progress initiatives can be completed."
            );
        }

        repository.completeInitiative(
                initiativeId,
                input.realizedSavings()
        );

        return initiativeResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public CategoryInitiativeResponse cancelInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertCloseRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        == CategoryInitiativeStatus.COMPLETED
        ) {
            throw new IllegalArgumentException(
                    "Completed category initiatives cannot be cancelled."
            );
        }

        repository.updateInitiativeStatus(
                initiativeId,
                CategoryInitiativeStatus.CANCELLED
        );

        return initiativeResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public CategoryMilestoneResponse createMilestone(
            UUID currentUserId,
            UUID initiativeId,
            CategoryMilestoneInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        == CategoryInitiativeStatus.COMPLETED
                ||
                initiative.status()
                        == CategoryInitiativeStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Completed or cancelled initiatives cannot receive new milestones."
            );
        }

        UUID milestoneId =
                UUID.randomUUID();

        repository.createMilestone(
                milestoneId,
                initiativeId,
                input
        );

        return milestoneResponse(
                requireMilestone(
                        milestoneId
                )
        );
    }

    public CategoryMilestoneResponse completeMilestone(
            UUID currentUserId,
            UUID milestoneId,
            CategoryMilestoneCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.MilestoneRow milestone =
                requireMilestone(
                        milestoneId
                );

        if (
                milestone.status()
                        != CategoryMilestoneStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open category milestones can be completed."
            );
        }

        repository.completeMilestone(
                milestoneId,
                input.note()
        );

        return milestoneResponse(
                requireMilestone(
                        milestoneId
                )
        );
    }

    public CategoryMilestoneResponse cancelMilestone(
            UUID currentUserId,
            UUID milestoneId
    ) {
        assertCloseRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CategoryManagementRepository.MilestoneRow milestone =
                requireMilestone(
                        milestoneId
                );

        if (
                milestone.status()
                        != CategoryMilestoneStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open category milestones can be cancelled."
            );
        }

        repository.cancelMilestone(
                milestoneId
        );

        return milestoneResponse(
                requireMilestone(
                        milestoneId
                )
        );
    }

    @Transactional(readOnly = true)
    public CategoryContextResponse contextOptions(
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

        return new CategoryContextResponse(
                categoryInsights(
                        normalizedCurrency
                ),
                repository.users()
        );
    }

    private List<CategoryInsightResponse> categoryInsights(
            String currency
    ) {
        return repository
                .categoryInsights(
                        currency
                )
                .stream()
                .map(
                        row ->
                                insightResponse(
                                        row,
                                        currency
                                )
                )
                .toList();
    }

    private CategoryInsightResponse insightResponse(
            CategoryManagementRepository.CategoryInsightRow row,
            String currency
    ) {
        BigDecimal strategicValue =
                opportunityService
                        .strategicValueScore(
                                row.totalSpend(),
                                row.supplierCount()
                        );

        BigDecimal risk =
                decimal(
                        row.weightedRiskScore()
                );

        BigDecimal opportunityPct =
                opportunityService
                        .modeledOpportunityPct(
                                row.supplierCount(),
                                row.topSupplierShare()
                        );

        BigDecimal opportunityAmount =
                opportunityService
                        .modeledOpportunityAmount(
                                row.totalSpend(),
                                row.supplierCount(),
                                row.topSupplierShare()
                        );

        return new CategoryInsightResponse(
                row.categoryName(),
                currency,
                row.supplierCount(),
                money(
                        row.totalSpend()
                ),
                decimal(
                        row.topSupplierShare()
                ),
                row.highRiskSuppliers(),
                risk,
                strategicValue,
                opportunityPct,
                money(
                        opportunityAmount
                ),
                opportunityService
                        .matrixPosition(
                                strategicValue,
                                risk
                        )
        );
    }

    private CategoryInsightResponse zeroInsight(
            String categoryName,
            String currency
    ) {
        return new CategoryInsightResponse(
                categoryName,
                currency,
                0,
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                0,
                new BigDecimal(
                        "60.00"
                ),
                new BigDecimal(
                        "10.00"
                ),
                new BigDecimal(
                        "1.00"
                ),
                BigDecimal.ZERO
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        ),
                CategoryMatrixPosition.RISK_MITIGATION
        );
    }

    private CategoryStrategySummaryResponse strategySummary(
            CategoryManagementRepository.StrategyRow row
    ) {
        BigDecimal denominator =
                row.savingsTargetAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        ) <= 0
                        ? BigDecimal.ZERO
                        : row.savingsTargetAmount();

        BigDecimal realizationPct =
                denominator.compareTo(
                        BigDecimal.ZERO
                ) == 0
                        ? BigDecimal.ZERO
                        : row
                                .realizedSavings()
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

        return new CategoryStrategySummaryResponse(
                row.id(),
                row.strategyCode(),
                row.categoryName(),
                row.currency(),
                row.fiscalYear(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                money(
                        row.spendBaseline()
                ),
                money(
                        row.currentSpend()
                ),
                money(
                        row.modeledOpportunityAmount()
                ),
                decimal(
                        row.savingsTargetPct()
                ),
                money(
                        row.savingsTargetAmount()
                ),
                money(
                        row.initiativeTargetSavings()
                ),
                money(
                        row.realizedSavings()
                ),
                decimal(
                        realizationPct
                ),
                decimal(
                        row.strategicValueScore()
                ),
                decimal(
                        row.supplyRiskScore()
                ),
                row.matrixPosition(),
                row.activeInitiatives(),
                row.overdueInitiatives(),
                row.openMilestones(),
                row.overdueMilestones(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private CategoryInitiativeResponse initiativeResponse(
            CategoryManagementRepository.InitiativeRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == CategoryInitiativeStatus.PLANNED
                        ||
                        row.status()
                                == CategoryInitiativeStatus.READY
                        ||
                        row.status()
                                == CategoryInitiativeStatus.IN_PROGRESS
                )
                &&
                row.plannedEndDate()
                        != null
                &&
                row.plannedEndDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        BigDecimal realizationPct =
                row.targetSavings()
                                .compareTo(
                                        BigDecimal.ZERO
                                ) <= 0
                        ? BigDecimal.ZERO
                        : row
                                .realizedSavings()
                                .multiply(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                                .divide(
                                        row.targetSavings(),
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new CategoryInitiativeResponse(
                row.id(),
                row.strategyId(),
                row.initiativeNumber(),
                row.initiativeType(),
                row.title(),
                row.description(),
                row.priority(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                row.plannedStartDate(),
                row.plannedEndDate(),
                overdue,
                money(
                        row.estimatedValue()
                ),
                money(
                        row.targetSavings()
                ),
                money(
                        row.realizedSavings()
                ),
                decimal(
                        realizationPct
                ),
                repository
                        .milestones(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::milestoneResponse
                        )
                        .toList(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private CategoryMilestoneResponse milestoneResponse(
            CategoryManagementRepository.MilestoneRow row
    ) {
        boolean overdue =
                row.status()
                                == CategoryMilestoneStatus.OPEN
                        &&
                        row.dueDate()
                                .isBefore(
                                        LocalDate.now(
                                                ZoneOffset.UTC
                                        )
                                );

        return new CategoryMilestoneResponse(
                row.id(),
                row.initiativeId(),
                row.title(),
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

    private void validateStrategyTransition(
            CategoryStrategyStatus current,
            CategoryStrategyStatus target
    ) {
        if (current == target) {
            return;
        }

        boolean allowed =
                switch (
                        current
                ) {
                    case DRAFT ->
                            target
                                    == CategoryStrategyStatus.ACTIVE
                            ||
                            target
                                    == CategoryStrategyStatus.ARCHIVED;

                    case ACTIVE ->
                            target
                                    == CategoryStrategyStatus.ON_HOLD
                            ||
                            target
                                    == CategoryStrategyStatus.CLOSED;

                    case ON_HOLD ->
                            target
                                    == CategoryStrategyStatus.ACTIVE
                            ||
                            target
                                    == CategoryStrategyStatus.CLOSED;

                    case CLOSED ->
                            target
                                    == CategoryStrategyStatus.ARCHIVED;

                    case ARCHIVED ->
                            false;
                };

        if (!allowed) {
            throw new IllegalArgumentException(
                    "Invalid category-strategy status transition from "
                            + current
                            + " to "
                            + target
                            + "."
            );
        }
    }

    private CategoryManagementRepository.StrategyRow requireStrategy(
            UUID strategyId
    ) {
        CategoryManagementRepository.StrategyRow strategy =
                repository
                        .findStrategy(
                                strategyId
                        );

        if (strategy == null) {
            throw new ResourceNotFoundException(
                    "Category strategy not found: "
                            + strategyId
            );
        }

        return strategy;
    }

    private CategoryManagementRepository.InitiativeRow requireInitiative(
            UUID initiativeId
    ) {
        CategoryManagementRepository.InitiativeRow initiative =
                repository
                        .findInitiative(
                                initiativeId
                        );

        if (initiative == null) {
            throw new ResourceNotFoundException(
                    "Category initiative not found: "
                            + initiativeId
            );
        }

        return initiative;
    }

    private CategoryManagementRepository.MilestoneRow requireMilestone(
            UUID milestoneId
    ) {
        CategoryManagementRepository.MilestoneRow milestone =
                repository
                        .findMilestone(
                                milestoneId
                        );

        if (milestone == null) {
            throw new ResourceNotFoundException(
                    "Category milestone not found: "
                            + milestoneId
            );
        }

        return milestone;
    }

    private String nextStrategyCode() {
        Long sequence =
                repository
                        .nextStrategySequence();

        return String.format(
                "CAT-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private String nextInitiativeNumber() {
        Long sequence =
                repository
                        .nextInitiativeSequence();

        return String.format(
                "CATI-%d-%05d",
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
                    "Category currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private String normalizeCategory(
            String category
    ) {
        String value =
                category == null
                        ? ""
                        : category.trim();

        if (value.isEmpty()) {
            throw new IllegalArgumentException(
                    "Category name is required."
            );
        }

        return value;
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

    private BigDecimal decimalNullable(
            BigDecimal value
    ) {
        return value == null
                ? null
                : decimal(
                        value
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

    private AppUserEntity requireCategoryUser(
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
                    "Category-management ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access strategic category management."
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
                    "Your ProcureIQ role cannot manage category strategies."
            );
        }
    }

    private void assertCloseRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can cancel governed category work."
            );
        }
    }
}
