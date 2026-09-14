package com.procureiq.benefitgovernance;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
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
public class BenefitsGovernanceService {

    private final BenefitsGovernanceRepository repository;

    private final BenefitValueMathService mathService;

    private final AppUserRepository appUserRepository;

    public BenefitsGovernanceService(
            BenefitsGovernanceRepository repository,
            BenefitValueMathService mathService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public BenefitsGovernanceDashboardResponse dashboard(
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

        List<ExecutionPortfolioSummaryResponse> portfolios =
                repository
                        .portfolios(
                                normalizedCurrency
                        )
                        .stream()
                        .map(
                                this::portfolioSummary
                        )
                        .toList();

        BigDecimal baseline =
                portfolios.stream()
                        .filter(
                                portfolio ->
                                        portfolio.status()
                                                != ExecutionPortfolioStatus.ARCHIVED
                        )
                        .map(
                                ExecutionPortfolioSummaryResponse::
                                        baselineTargetSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal forecast =
                portfolios.stream()
                        .filter(
                                portfolio ->
                                        portfolio.status()
                                                != ExecutionPortfolioStatus.ARCHIVED
                        )
                        .map(
                                ExecutionPortfolioSummaryResponse::
                                        currentForecastSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal operational =
                portfolios.stream()
                        .filter(
                                portfolio ->
                                        portfolio.status()
                                                != ExecutionPortfolioStatus.ARCHIVED
                        )
                        .map(
                                ExecutionPortfolioSummaryResponse::
                                        operationalReportedSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal validated =
                portfolios.stream()
                        .filter(
                                portfolio ->
                                        portfolio.status()
                                                != ExecutionPortfolioStatus.ARCHIVED
                        )
                        .map(
                                ExecutionPortfolioSummaryResponse::
                                        validatedSavings
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal leakage =
                portfolios.stream()
                        .filter(
                                portfolio ->
                                        portfolio.status()
                                                != ExecutionPortfolioStatus.ARCHIVED
                        )
                        .map(
                                ExecutionPortfolioSummaryResponse::
                                        activeLeakageAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        BigDecimal atRisk =
                portfolios.stream()
                        .filter(
                                portfolio ->
                                        portfolio.status()
                                                != ExecutionPortfolioStatus.ARCHIVED
                        )
                        .map(
                                ExecutionPortfolioSummaryResponse::
                                        atRiskAmount
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        return new BenefitsGovernanceDashboardResponse(
                new BenefitsGovernanceSummaryResponse(
                        normalizedCurrency,
                        portfolios.size(),
                        portfolios.stream()
                                .filter(
                                        portfolio ->
                                                portfolio.status()
                                                        == ExecutionPortfolioStatus.AUTHORIZED
                                        ||
                                        portfolio.status()
                                                == ExecutionPortfolioStatus.IN_EXECUTION
                                )
                                .count(),
                        portfolios.stream()
                                .mapToLong(
                                        ExecutionPortfolioSummaryResponse::
                                                validationPendingItems
                                )
                                .sum(),
                        portfolios.stream()
                                .filter(
                                        portfolio ->
                                                portfolio.activeLeakageCases()
                                                        > 0
                                )
                                .count(),
                        money(
                                baseline
                        ),
                        money(
                                forecast
                        ),
                        money(
                                operational
                        ),
                        money(
                                validated
                        ),
                        money(
                                leakage
                        ),
                        money(
                                atRisk
                        ),
                        mathService
                                .coveragePct(
                                        forecast,
                                        baseline
                                ),
                        mathService
                                .coveragePct(
                                        validated,
                                        baseline
                                )
                ),
                portfolios
        );
    }

    @Transactional(readOnly = true)
    public ExecutionPortfolioDetailResponse portfolio(
            UUID currentUserId,
            UUID portfolioId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return portfolioDetail(
                requirePortfolio(
                        portfolioId
                )
        );
    }

    public ExecutionPortfolioDetailResponse authorizeScenario(
            UUID currentUserId,
            UUID scenarioId,
            ExecutionPortfolioAuthorizationInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertAuthorizeRole(
                currentUser.getRole()
        );

        BenefitsGovernanceRepository.ApprovedScenarioRow scenario =
                repository
                        .approvedScenario(
                                scenarioId
                        );

        if (scenario == null) {
            throw new IllegalArgumentException(
                    "Only an approved procurement portfolio scenario can become an execution portfolio."
            );
        }

        if (
                repository
                        .portfolioExistsForScenario(
                                scenarioId
                        )
        ) {
            throw new IllegalArgumentException(
                    "This approved scenario already has an authorized execution portfolio."
            );
        }

        List<BenefitsGovernanceRepository.ScenarioSelectedItemRow> selected =
                repository
                        .selectedScenarioItems(
                                scenarioId
                        );

        if (selected.isEmpty()) {
            throw new IllegalArgumentException(
                    "Approved scenario contains no selected initiatives."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireBenefitUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID portfolioId =
                UUID.randomUUID();

        repository.createPortfolio(
                portfolioId,
                nextPortfolioNumber(),
                scenario,
                ownerId,
                currentUserId,
                input.notes()
        );

        for (
                BenefitsGovernanceRepository.ScenarioSelectedItemRow source
                : selected
        ) {
            repository.createBenefitItem(
                    UUID.randomUUID(),
                    portfolioId,
                    source
            );
        }

        return portfolioDetail(
                requirePortfolio(
                        portfolioId
                )
        );
    }

    public ExecutionPortfolioSummaryResponse startPortfolio(
            UUID currentUserId,
            UUID portfolioId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        if (
                portfolio.status()
                        != ExecutionPortfolioStatus.AUTHORIZED
        ) {
            throw new IllegalArgumentException(
                    "Only authorized portfolios can enter execution."
            );
        }

        repository.startPortfolio(
                portfolioId
        );

        return portfolioSummary(
                requirePortfolio(
                        portfolioId
                )
        );
    }

    public ExecutionPortfolioSummaryResponse closePortfolio(
            UUID currentUserId,
            UUID portfolioId
    ) {
        assertAuthorizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        if (
                portfolio.status()
                        != ExecutionPortfolioStatus.AUTHORIZED
                &&
                portfolio.status()
                        != ExecutionPortfolioStatus.IN_EXECUTION
        ) {
            throw new IllegalArgumentException(
                    "Only active execution portfolios can be closed."
            );
        }

        long activeItems =
                repository
                        .benefitItems(
                                portfolioId
                        )
                        .stream()
                        .filter(
                                item ->
                                        item.status()
                                                == BenefitItemStatus.PLANNED
                                        ||
                                        item.status()
                                                == BenefitItemStatus.IN_PROGRESS
                                        ||
                                        item.status()
                                                == BenefitItemStatus.VALIDATION_PENDING
                        )
                        .count();

        if (activeItems > 0) {
            throw new IllegalArgumentException(
                    "Execution portfolio cannot close while benefit items remain active."
            );
        }

        repository.closePortfolio(
                portfolioId
        );

        return portfolioSummary(
                requirePortfolio(
                        portfolioId
                )
        );
    }

    public ExecutionPortfolioSummaryResponse archivePortfolio(
            UUID currentUserId,
            UUID portfolioId
    ) {
        assertAuthorizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        if (
                portfolio.status()
                        != ExecutionPortfolioStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Only closed execution portfolios can be archived."
            );
        }

        repository.archivePortfolio(
                portfolioId
        );

        return portfolioSummary(
                requirePortfolio(
                        portfolioId
                )
        );
    }

    public BenefitItemResponse reassignBenefitOwner(
            UUID currentUserId,
            UUID itemId,
            BenefitOwnerInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.ItemRow item =
                requireItem(
                        itemId
                );

        requireMutablePortfolio(
                item.portfolioId()
        );

        UUID ownerId =
                requireBenefitUser(
                        input.ownerUserId()
                )
                        .getId();

        repository.updateBenefitOwner(
                itemId,
                ownerId
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public BenefitItemResponse startBenefitItem(
            UUID currentUserId,
            UUID itemId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.ItemRow item =
                requireItem(
                        itemId
                );

        requireMutablePortfolio(
                item.portfolioId()
        );

        if (
                item.status()
                        != BenefitItemStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned benefit items can be started."
            );
        }

        repository.startBenefitItem(
                itemId
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public BenefitItemResponse updateForecast(
            UUID currentUserId,
            UUID itemId,
            BenefitForecastInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.ItemRow item =
                requireItem(
                        itemId
                );

        requireMutablePortfolio(
                item.portfolioId()
        );

        if (
                item.status()
                        != BenefitItemStatus.PLANNED
                &&
                item.status()
                        != BenefitItemStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Forecast can only be updated for planned or in-progress benefit items."
            );
        }

        repository.updateForecast(
                itemId,
                input.forecastSavings(),
                input.expectedRealizationDate()
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public BenefitItemResponse requestValidation(
            UUID currentUserId,
            UUID itemId,
            BenefitValidationRequestInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.ItemRow item =
                requireItem(
                        itemId
                );

        requireMutablePortfolio(
                item.portfolioId()
        );

        if (
                item.status()
                        != BenefitItemStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only in-progress benefit items can be submitted for validation."
            );
        }

        repository.requestValidation(
                itemId,
                input.proposedValidatedSavings(),
                currentUserId,
                input.note()
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public BenefitItemResponse validateBenefit(
            UUID currentUserId,
            UUID itemId,
            BenefitValidationDecisionInput input
    ) {
        assertValidateRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.ItemRow item =
                requireItem(
                        itemId
                );

        requireMutablePortfolio(
                item.portfolioId()
        );

        if (
                item.status()
                        != BenefitItemStatus.VALIDATION_PENDING
        ) {
            throw new IllegalArgumentException(
                    "Only validation-pending benefits can receive a formal validation decision."
            );
        }

        repository.validateBenefit(
                itemId,
                input.validatedSavings(),
                currentUserId,
                input.note()
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public BenefitItemResponse cancelBenefitItem(
            UUID currentUserId,
            UUID itemId
    ) {
        assertAuthorizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.ItemRow item =
                requireItem(
                        itemId
                );

        requireMutablePortfolio(
                item.portfolioId()
        );

        if (
                item.status()
                        == BenefitItemStatus.VALIDATED
                ||
                item.status()
                        == BenefitItemStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Validated or already-cancelled benefit items cannot be cancelled."
            );
        }

        repository.cancelBenefitItem(
                itemId
        );

        return itemResponse(
                requireItem(
                        itemId
                )
        );
    }

    public BenefitAssumptionResponse createAssumption(
            UUID currentUserId,
            UUID portfolioId,
            BenefitAssumptionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireMutablePortfolio(
                portfolioId
        );

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireBenefitUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID assumptionId =
                UUID.randomUUID();

        repository.createAssumption(
                assumptionId,
                portfolioId,
                input,
                ownerId
        );

        return assumptionResponse(
                requireAssumption(
                        assumptionId
                )
        );
    }

    public BenefitAssumptionResponse confirmAssumption(
            UUID currentUserId,
            UUID assumptionId,
            BenefitResolutionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.AssumptionRow assumption =
                requireAssumption(
                        assumptionId
                );

        requireMutablePortfolio(
                assumption.portfolioId()
        );

        if (
                assumption.status()
                        != BenefitAssumptionStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only active benefit assumptions can be confirmed."
            );
        }

        repository.resolveAssumption(
                assumptionId,
                BenefitAssumptionStatus.CONFIRMED,
                currentUserId,
                input.note()
        );

        return assumptionResponse(
                requireAssumption(
                        assumptionId
                )
        );
    }

    public BenefitAssumptionResponse invalidateAssumption(
            UUID currentUserId,
            UUID assumptionId,
            BenefitResolutionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.AssumptionRow assumption =
                requireAssumption(
                        assumptionId
                );

        requireMutablePortfolio(
                assumption.portfolioId()
        );

        if (
                assumption.status()
                        != BenefitAssumptionStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only active benefit assumptions can be invalidated."
            );
        }

        repository.resolveAssumption(
                assumptionId,
                BenefitAssumptionStatus.INVALIDATED,
                currentUserId,
                input.note()
        );

        return assumptionResponse(
                requireAssumption(
                        assumptionId
                )
        );
    }

    public BenefitLeakageResponse createLeakage(
            UUID currentUserId,
            UUID itemId,
            BenefitLeakageInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.ItemRow item =
                requireItem(
                        itemId
                );

        requireMutablePortfolio(
                item.portfolioId()
        );

        if (
                item.status()
                        == BenefitItemStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Benefit leakage cannot be opened against a cancelled benefit item."
            );
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireBenefitUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID leakageId =
                UUID.randomUUID();

        repository.createLeakage(
                leakageId,
                itemId,
                input,
                ownerId
        );

        return leakageResponse(
                requireLeakage(
                        leakageId
                )
        );
    }

    public BenefitLeakageResponse resolveLeakage(
            UUID currentUserId,
            UUID leakageId,
            BenefitLeakageResolutionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        BenefitsGovernanceRepository.LeakageRow leakage =
                requireLeakage(
                        leakageId
                );

        BenefitsGovernanceRepository.ItemRow item =
                requireItem(
                        leakage.benefitItemId()
                );

        requireMutablePortfolio(
                item.portfolioId()
        );

        if (
                input.status()
                        == BenefitLeakageStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Leakage resolution must move the finding away from OPEN."
            );
        }

        if (
                leakage.status()
                        != BenefitLeakageStatus.OPEN
                &&
                leakage.status()
                        != BenefitLeakageStatus.ACCEPTED
        ) {
            throw new IllegalArgumentException(
                    "Only open or accepted leakage can receive a new resolution."
            );
        }

        repository.resolveLeakage(
                leakageId,
                input.status(),
                currentUserId,
                input.note()
        );

        return leakageResponse(
                requireLeakage(
                        leakageId
                )
        );
    }

    @Transactional(readOnly = true)
    public BenefitsGovernanceContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new BenefitsGovernanceContextResponse(
                repository
                        .approvedScenariosAvailable()
                        .stream()
                        .map(
                                row ->
                                        new ApprovedScenarioOptionResponse(
                                                row.id(),
                                                row.scenarioCode(),
                                                row.name(),
                                                row.currency(),
                                                row.ownerName(),
                                                row.selectedInitiatives(),
                                                money(
                                                        row.selectedBudget()
                                                ),
                                                money(
                                                        row.targetSavings()
                                                ),
                                                decimal(
                                                        row.averageRisk()
                                                ),
                                                row.approvedAt()
                                        )
                        )
                        .toList(),
                repository.users()
        );
    }

    private ExecutionPortfolioDetailResponse portfolioDetail(
            BenefitsGovernanceRepository.PortfolioRow portfolio
    ) {
        return new ExecutionPortfolioDetailResponse(
                portfolioSummary(
                        portfolio
                ),
                portfolio.notes(),
                repository
                        .benefitItems(
                                portfolio.id()
                        )
                        .stream()
                        .map(
                                this::itemResponse
                        )
                        .toList(),
                repository
                        .assumptions(
                                portfolio.id()
                        )
                        .stream()
                        .map(
                                this::assumptionResponse
                        )
                        .toList(),
                repository
                        .leakage(
                                portfolio.id()
                        )
                        .stream()
                        .map(
                                this::leakageResponse
                        )
                        .toList()
        );
    }

    private ExecutionPortfolioSummaryResponse portfolioSummary(
            BenefitsGovernanceRepository.PortfolioRow row
    ) {
        BigDecimal atRisk =
                mathService
                        .atRiskAmount(
                                row.baselineTargetSavings(),
                                row.currentForecastSavings(),
                                row.activeLeakageAmount()
                        );

        return new ExecutionPortfolioSummaryResponse(
                row.id(),
                row.portfolioNumber(),
                row.sourceScenarioId(),
                row.sourceScenarioCode(),
                row.sourceScenarioName(),
                row.currency(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                row.authorizedByName(),
                row.authorizedAt(),
                money(
                        row.baselineSelectedBudget()
                ),
                money(
                        row.baselineTargetSavings()
                ),
                decimal(
                        row.baselineAverageRisk()
                ),
                row.selectedInitiativeCount(),
                money(
                        row.currentForecastSavings()
                ),
                money(
                        row.operationalReportedSavings()
                ),
                money(
                        row.validatedSavings()
                ),
                money(
                        row.activeLeakageAmount()
                ),
                atRisk,
                mathService
                        .coveragePct(
                                row.currentForecastSavings(),
                                row.baselineTargetSavings()
                        ),
                mathService
                        .coveragePct(
                                row.validatedSavings(),
                                row.baselineTargetSavings()
                        ),
                row.activeBenefitItems(),
                row.validationPendingItems(),
                row.validatedItems(),
                row.activeAssumptions(),
                row.invalidatedAssumptions(),
                row.activeLeakageCases(),
                row.overdueLeakageCases(),
                row.closedAt(),
                row.archivedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private BenefitItemResponse itemResponse(
            BenefitsGovernanceRepository.ItemRow row
    ) {
        return new BenefitItemResponse(
                row.id(),
                row.portfolioId(),
                row.scenarioItemId(),
                row.initiativeId(),
                row.strategyId(),
                row.categoryName(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.benefitOwnerUserId(),
                row.benefitOwnerName(),
                row.status(),
                money(
                        row.baselineTargetSavings()
                ),
                money(
                        row.forecastSavings()
                ),
                money(
                        row.operationalReportedSavings()
                ),
                moneyNullable(
                        row.validationRequestedAmount()
                ),
                money(
                        row.validatedSavings()
                ),
                mathService
                        .gap(
                                row.baselineTargetSavings(),
                                row.forecastSavings()
                        ),
                mathService
                        .gap(
                                row.baselineTargetSavings(),
                                row.validatedSavings()
                        ),
                money(
                        row.activeLeakageAmount()
                ),
                mathService
                        .atRiskAmount(
                                row.baselineTargetSavings(),
                                row.forecastSavings(),
                                row.activeLeakageAmount()
                        ),
                row.expectedRealizationDate(),
                row.validationRequestNote(),
                row.validationRequestedByName(),
                row.validationRequestedAt(),
                row.validatedByName(),
                row.validationNote(),
                row.validatedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private BenefitAssumptionResponse assumptionResponse(
            BenefitsGovernanceRepository.AssumptionRow row
    ) {
        boolean overdue =
                row.status()
                                == BenefitAssumptionStatus.ACTIVE
                        &&
                        row.reviewDate()
                                != null
                        &&
                        row.reviewDate()
                                .isBefore(
                                        LocalDate.now(
                                                ZoneOffset.UTC
                                        )
                                );

        return new BenefitAssumptionResponse(
                row.id(),
                row.portfolioId(),
                row.assumptionType(),
                row.description(),
                money(
                        row.financialImpact()
                ),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                row.reviewDate(),
                overdue,
                row.resolutionNote(),
                row.resolvedByName(),
                row.resolvedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private BenefitLeakageResponse leakageResponse(
            BenefitsGovernanceRepository.LeakageRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == BenefitLeakageStatus.OPEN
                        ||
                        row.status()
                                == BenefitLeakageStatus.ACCEPTED
                )
                &&
                row.dueDate()
                        != null
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new BenefitLeakageResponse(
                row.id(),
                row.benefitItemId(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.leakageType(),
                money(
                        row.amount()
                ),
                row.status(),
                row.description(),
                row.ownerUserId(),
                row.ownerName(),
                row.dueDate(),
                overdue,
                row.resolutionNote(),
                row.resolvedByName(),
                row.resolvedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private BenefitsGovernanceRepository.PortfolioRow requirePortfolio(
            UUID portfolioId
    ) {
        BenefitsGovernanceRepository.PortfolioRow portfolio =
                repository
                        .findPortfolio(
                                portfolioId
                        );

        if (portfolio == null) {
            throw new ResourceNotFoundException(
                    "Execution portfolio not found: "
                            + portfolioId
            );
        }

        return portfolio;
    }

    private BenefitsGovernanceRepository.PortfolioRow requireMutablePortfolio(
            UUID portfolioId
    ) {
        BenefitsGovernanceRepository.PortfolioRow portfolio =
                requirePortfolio(
                        portfolioId
                );

        if (
                portfolio.status()
                        == ExecutionPortfolioStatus.CLOSED
                ||
                portfolio.status()
                        == ExecutionPortfolioStatus.ARCHIVED
        ) {
            throw new IllegalArgumentException(
                    "Closed or archived execution portfolios cannot be changed."
            );
        }

        return portfolio;
    }

    private BenefitsGovernanceRepository.ItemRow requireItem(
            UUID itemId
    ) {
        BenefitsGovernanceRepository.ItemRow item =
                repository
                        .findBenefitItem(
                                itemId
                        );

        if (item == null) {
            throw new ResourceNotFoundException(
                    "Benefit item not found: "
                            + itemId
            );
        }

        return item;
    }

    private BenefitsGovernanceRepository.AssumptionRow requireAssumption(
            UUID assumptionId
    ) {
        BenefitsGovernanceRepository.AssumptionRow assumption =
                repository
                        .findAssumption(
                                assumptionId
                        );

        if (assumption == null) {
            throw new ResourceNotFoundException(
                    "Benefit assumption not found: "
                            + assumptionId
            );
        }

        return assumption;
    }

    private BenefitsGovernanceRepository.LeakageRow requireLeakage(
            UUID leakageId
    ) {
        BenefitsGovernanceRepository.LeakageRow leakage =
                repository
                        .findLeakage(
                                leakageId
                        );

        if (leakage == null) {
            throw new ResourceNotFoundException(
                    "Benefit leakage finding not found: "
                            + leakageId
            );
        }

        return leakage;
    }

    private String nextPortfolioNumber() {
        Long sequence =
                repository
                        .nextPortfolioSequence();

        return String.format(
                "EXEC-%d-%05d",
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
                    "Benefits-governance currency must contain exactly three characters."
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
                : money(
                        value
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

    private AppUserEntity requireBenefitUser(
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
                    "Benefit ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access benefits governance."
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
                    "Your ProcureIQ role cannot manage benefit execution."
            );
        }
    }

    private void assertValidateRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can formally validate procurement benefits."
            );
        }
    }

    private void assertAuthorizeRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can authorize or close execution portfolios."
            );
        }
    }
}
