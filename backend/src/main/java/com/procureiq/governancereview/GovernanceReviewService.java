package com.procureiq.governancereview;

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
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class GovernanceReviewService {

    private final GovernanceReviewRepository repository;

    private final GovernanceSnapshotPolicyService policyService;

    private final AppUserRepository appUserRepository;

    public GovernanceReviewService(
            GovernanceReviewRepository repository,
            GovernanceSnapshotPolicyService policyService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.policyService =
                policyService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public GovernanceReviewDashboardResponse dashboard(
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

        List<GovernanceReviewSummaryResponse> reviews =
                repository
                        .reviews(
                                normalizedCurrency
                        )
                        .stream()
                        .map(
                                this::summaryResponse
                        )
                        .toList();

        GovernanceReviewSummaryResponse latestFrozen =
                reviews.stream()
                        .filter(
                                review ->
                                        review.frozenAt()
                                                != null
                        )
                        .findFirst()
                        .orElse(null);

        return new GovernanceReviewDashboardResponse(
                new GovernanceReviewDashboardSummaryResponse(
                        normalizedCurrency,
                        reviews.size(),
                        reviews.stream()
                                .filter(
                                        review ->
                                                review.status()
                                                        == GovernanceReviewStatus.FROZEN
                                        ||
                                        review.status()
                                                == GovernanceReviewStatus.IN_REVIEW
                                )
                                .count(),
                        reviews.stream()
                                .mapToLong(
                                        GovernanceReviewSummaryResponse::
                                                openDecisions
                                )
                                .sum(),
                        reviews.stream()
                                .mapToLong(
                                        GovernanceReviewSummaryResponse::
                                                openActions
                                )
                                .sum(),
                        reviews.stream()
                                .mapToLong(
                                        GovernanceReviewSummaryResponse::
                                                overdueActions
                                )
                                .sum(),
                        latestFrozen == null
                                ? zero()
                                : latestFrozen.snapshotTargetSavings(),
                        latestFrozen == null
                                ? zero()
                                : latestFrozen.snapshotValidatedSavings(),
                        latestFrozen == null
                                ? zero()
                                : latestFrozen.snapshotAtRiskAmount(),
                        latestFrozen == null
                                ? 0
                                : latestFrozen.snapshotCriticalSuppliers()
                ),
                reviews
        );
    }

    @Transactional(readOnly = true)
    public GovernanceReviewDetailResponse review(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return detail(
                requireReview(
                        reviewId
                )
        );
    }

    public GovernanceReviewDetailResponse createReview(
            UUID currentUserId,
            GovernanceReviewInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        if (
                input.periodEnd()
                        .isBefore(
                                input.periodStart()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Governance review end date cannot precede its start date."
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

        UUID chairId =
                input.chairUserId()
                        == null
                        ? currentUserId
                        : requireGovernanceUser(
                                input.chairUserId()
                        )
                                .getId();

        UUID reviewId =
                UUID.randomUUID();

        repository.createReview(
                reviewId,
                nextReviewNumber(),
                input,
                normalizeCurrency(
                        input.currency()
                ),
                ownerId,
                chairId
        );

        return detail(
                requireReview(
                        reviewId
                )
        );
    }

    public GovernanceReviewDetailResponse freezeReview(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != GovernanceReviewStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft governance reviews can be frozen."
            );
        }

        if (
                repository
                        .snapshot(
                                reviewId
                        )
                        != null
        ) {
            throw new IllegalArgumentException(
                    "Governance review already has a frozen snapshot."
            );
        }

        GovernanceReviewRepository.SnapshotMetricsRow metrics =
                repository
                        .currentMetrics(
                                review.currency()
                        );

        repository.insertSnapshot(
                reviewId,
                metrics
        );

        int rank =
                1;

        for (
                GovernanceReviewRepository.SupplierRiskSnapshotRow supplier
                : repository.supplierRiskSnapshot(
                        review.currency()
                )
        ) {
            repository.insertSnapshotItem(
                    reviewId,
                    GovernanceSnapshotItemType.SUPPLIER_RISK,
                    supplier.supplierId()
                            .toString(),
                    rank++,
                    policyService
                            .supplierRiskSeverity(
                                    supplier.riskBand()
                            ),
                    supplier.supplierName(),
                    supplier.supplierCode()
                            + " · "
                            + value(
                                    supplier.category(),
                                    "Uncategorized"
                            )
                            + " · "
                            + value(
                                    supplier.country(),
                                    "Unknown country"
                            ),
                    "Risk score",
                    decimal(
                            supplier.score()
                    ),
                    null,
                    "Risk band "
                            + supplier.riskBand()
                            + ", recommendation "
                            + supplier.recommendation()
                            + ", monitored spend exposure "
                            + money(
                                    supplier.spendExposure()
                            )
                            + " "
                            + review.currency()
                            + "."
            );
        }

        rank =
                1;

        for (
                GovernanceReviewRepository.CategorySnapshotRow category
                : repository.categorySnapshot(
                        review.currency()
                )
        ) {
            repository.insertSnapshotItem(
                    reviewId,
                    GovernanceSnapshotItemType.CATEGORY_STRATEGY,
                    category.strategyId()
                            .toString(),
                    rank++,
                    policyService
                            .categorySeverity(
                                    category.matrixPosition()
                            ),
                    category.categoryName(),
                    category.strategyCode()
                            + " · "
                            + category.matrixPosition(),
                    "Target savings",
                    money(
                            category.targetSavings()
                    ),
                    review.currency(),
                    "Strategic value "
                            + decimal(
                                    category.strategicValueScore()
                            )
                            + ", supply risk "
                            + decimal(
                                    category.supplyRiskScore()
                            )
                            + ", realized savings "
                            + money(
                                    category.realizedSavings()
                            )
                            + " "
                            + review.currency()
                            + "."
            );
        }

        rank =
                1;

        for (
                GovernanceReviewRepository.BenefitPortfolioSnapshotRow portfolio
                : repository.benefitPortfolioSnapshot(
                        review.currency()
                )
        ) {
            repository.insertSnapshotItem(
                    reviewId,
                    GovernanceSnapshotItemType.BENEFIT_PORTFOLIO,
                    portfolio.portfolioId()
                            .toString(),
                    rank++,
                    policyService
                            .portfolioSeverity(
                                    portfolio.targetSavings(),
                                    portfolio.forecastSavings(),
                                    portfolio.leakageAmount()
                            ),
                    portfolio.scenarioName(),
                    portfolio.portfolioNumber()
                            + " · "
                            + portfolio.status(),
                    "Value at risk",
                    money(
                            portfolio.atRiskAmount()
                    ),
                    review.currency(),
                    "Target "
                            + money(
                                    portfolio.targetSavings()
                            )
                            + ", forecast "
                            + money(
                                    portfolio.forecastSavings()
                            )
                            + ", validated "
                            + money(
                                    portfolio.validatedSavings()
                            )
                            + ", active leakage "
                            + money(
                                    portfolio.leakageAmount()
                            )
                            + " "
                            + review.currency()
                            + "."
            );
        }

        repository.freezeReview(
                reviewId
        );

        return detail(
                requireReview(
                        reviewId
                )
        );
    }

    public GovernanceReviewSummaryResponse openReview(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != GovernanceReviewStatus.FROZEN
        ) {
            throw new IllegalArgumentException(
                    "Only frozen governance reviews can enter formal review."
            );
        }

        repository.openReview(
                reviewId
        );

        return summaryResponse(
                requireReview(
                        reviewId
                )
        );
    }

    public GovernanceReviewSummaryResponse closeReview(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertChairRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != GovernanceReviewStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Only in-review governance reviews can be closed."
            );
        }

        long openDecisions =
                repository
                        .decisions(
                                reviewId
                        )
                        .stream()
                        .filter(
                                decision ->
                                        decision.status()
                                                == GovernanceDecisionStatus.OPEN
                        )
                        .count();

        if (openDecisions > 0) {
            throw new IllegalArgumentException(
                    "Governance review cannot close while formal decisions remain open."
            );
        }

        repository.closeReview(
                reviewId
        );

        return summaryResponse(
                requireReview(
                        reviewId
                )
        );
    }

    public GovernanceReviewSummaryResponse archiveReview(
            UUID currentUserId,
            UUID reviewId
    ) {
        assertChairRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != GovernanceReviewStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Only closed governance reviews can be archived."
            );
        }

        long activeActions =
                repository
                        .actions(
                                reviewId
                        )
                        .stream()
                        .filter(
                                action ->
                                        action.status()
                                                == GovernanceActionStatus.OPEN
                                        ||
                                        action.status()
                                                == GovernanceActionStatus.IN_PROGRESS
                        )
                        .count();

        if (activeActions > 0) {
            throw new IllegalArgumentException(
                    "Governance review cannot be archived while management actions remain active."
            );
        }

        repository.archiveReview(
                reviewId
        );

        return summaryResponse(
                requireReview(
                        reviewId
                )
        );
    }

    public GovernanceDecisionResponse createDecision(
            UUID currentUserId,
            UUID reviewId,
            GovernanceDecisionInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        GovernanceReviewRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != GovernanceReviewStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Formal decision requests can only be created while the governance review is in progress."
            );
        }

        UUID ownerId =
                input.decisionOwnerUserId()
                        == null
                        ? review.chairUserId()
                        : requireGovernanceUser(
                                input.decisionOwnerUserId()
                        )
                                .getId();

        UUID decisionId =
                UUID.randomUUID();

        repository.createDecision(
                decisionId,
                nextDecisionNumber(),
                reviewId,
                input,
                currentUserId,
                ownerId
        );

        return decisionResponse(
                requireDecision(
                        decisionId
                )
        );
    }

    public GovernanceDecisionResponse resolveDecision(
            UUID currentUserId,
            UUID decisionId,
            GovernanceDecisionResolutionInput input
    ) {
        assertChairRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.DecisionRow decision =
                requireDecision(
                        decisionId
                );

        GovernanceReviewRepository.ReviewRow review =
                requireReview(
                        decision.reviewId()
                );

        if (
                review.status()
                        != GovernanceReviewStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Formal decisions can only be resolved during an active governance review."
            );
        }

        if (
                decision.status()
                        != GovernanceDecisionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open governance decisions can be resolved."
            );
        }

        if (
                input.status()
                        == GovernanceDecisionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Decision outcome cannot remain OPEN."
            );
        }

        repository.resolveDecision(
                decisionId,
                input.status(),
                currentUserId,
                input.note()
        );

        return decisionResponse(
                requireDecision(
                        decisionId
                )
        );
    }

    public GovernanceActionResponse createAction(
            UUID currentUserId,
            UUID reviewId,
            GovernanceActionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != GovernanceReviewStatus.IN_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Management actions can only be created during an active governance review."
            );
        }

        if (
                input.decisionId()
                        != null
        ) {
            GovernanceReviewRepository.DecisionRow decision =
                    requireDecision(
                            input.decisionId()
                    );

            if (
                    !decision.reviewId()
                            .equals(
                                    reviewId
                            )
            ) {
                throw new IllegalArgumentException(
                        "Selected decision belongs to another governance review."
                );
            }
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
                nextActionNumber(),
                reviewId,
                input,
                ownerId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public GovernanceActionResponse startAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.ActionRow action =
                requireAction(
                        actionId
                );

        assertActionMutableReview(
                action.reviewId()
        );

        if (
                action.status()
                        != GovernanceActionStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open management actions can be started."
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

    public GovernanceActionResponse completeAction(
            UUID currentUserId,
            UUID actionId,
            GovernanceActionCompletionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.ActionRow action =
                requireAction(
                        actionId
                );

        assertActionMutableReview(
                action.reviewId()
        );

        if (
                action.status()
                        != GovernanceActionStatus.OPEN
                &&
                action.status()
                        != GovernanceActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active management actions can be completed."
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

    public GovernanceActionResponse cancelAction(
            UUID currentUserId,
            UUID actionId,
            GovernanceActionCompletionInput input
    ) {
        assertChairRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        GovernanceReviewRepository.ActionRow action =
                requireAction(
                        actionId
                );

        assertActionMutableReview(
                action.reviewId()
        );

        if (
                action.status()
                        != GovernanceActionStatus.OPEN
                &&
                action.status()
                        != GovernanceActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active management actions can be cancelled."
            );
        }

        repository.cancelAction(
                actionId,
                input.note()
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    @Transactional(readOnly = true)
    public GovernanceReviewContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new GovernanceReviewContextResponse(
                repository.users()
        );
    }

    private GovernanceReviewDetailResponse detail(
            GovernanceReviewRepository.ReviewRow review
    ) {
        GovernanceReviewRepository.SnapshotMetricsPersistedRow snapshot =
                repository
                        .snapshot(
                                review.id()
                        );

        return new GovernanceReviewDetailResponse(
                summaryResponse(
                        review
                ),
                review.executiveSummary(),
                snapshot == null
                        ? null
                        : snapshotResponse(
                                snapshot
                        ),
                repository
                        .snapshotItems(
                                review.id()
                        )
                        .stream()
                        .map(
                                this::snapshotItemResponse
                        )
                        .toList(),
                repository
                        .decisions(
                                review.id()
                        )
                        .stream()
                        .map(
                                this::decisionResponse
                        )
                        .toList(),
                repository
                        .actions(
                                review.id()
                        )
                        .stream()
                        .map(
                                this::actionResponse
                        )
                        .toList()
        );
    }

    private GovernanceReviewSummaryResponse summaryResponse(
            GovernanceReviewRepository.ReviewRow row
    ) {
        return new GovernanceReviewSummaryResponse(
                row.id(),
                row.reviewNumber(),
                row.title(),
                row.periodStart(),
                row.periodEnd(),
                row.currency(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                row.chairUserId(),
                row.chairName(),
                money(
                        row.snapshotTargetSavings()
                ),
                money(
                        row.snapshotValidatedSavings()
                ),
                money(
                        row.snapshotAtRiskAmount()
                ),
                row.snapshotCriticalSuppliers(),
                row.openDecisions(),
                row.openActions(),
                row.overdueActions(),
                row.frozenAt(),
                row.openedAt(),
                row.closedAt(),
                row.archivedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private GovernanceSnapshotMetricsResponse snapshotResponse(
            GovernanceReviewRepository.SnapshotMetricsPersistedRow row
    ) {
        return new GovernanceSnapshotMetricsResponse(
                row.evaluatedSuppliers(),
                row.highRiskSuppliers(),
                row.criticalRiskSuppliers(),
                money(
                        row.spendAtHighRisk()
                ),
                row.activeRiskAlerts(),
                row.openRiskEscalations(),
                row.activeCategoryStrategies(),
                row.activeCategoryInitiatives(),
                row.overdueCategoryInitiatives(),
                row.approvedScenarios(),
                row.activeExecutionPortfolios(),
                money(
                        row.baselineTargetSavings()
                ),
                money(
                        row.forecastSavings()
                ),
                money(
                        row.operationalReportedSavings()
                ),
                money(
                        row.validatedSavings()
                ),
                row.validationPendingItems(),
                row.activeLeakageCases(),
                money(
                        row.activeLeakageAmount()
                ),
                money(
                        row.atRiskAmount()
                ),
                row.activeAssumptions(),
                row.invalidatedAssumptions(),
                row.capturedAt()
        );
    }

    private GovernanceSnapshotItemResponse snapshotItemResponse(
            GovernanceReviewRepository.SnapshotItemRow row
    ) {
        return new GovernanceSnapshotItemResponse(
                row.id(),
                row.itemType(),
                row.itemKey(),
                row.rankPosition(),
                row.severity(),
                row.title(),
                row.subtitle(),
                row.metricLabel(),
                row.metricValue(),
                row.currency(),
                row.details()
        );
    }

    private GovernanceDecisionResponse decisionResponse(
            GovernanceReviewRepository.DecisionRow row
    ) {
        boolean overdue =
                row.status()
                                == GovernanceDecisionStatus.OPEN
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

        return new GovernanceDecisionResponse(
                row.id(),
                row.decisionNumber(),
                row.reviewId(),
                row.decisionType(),
                row.title(),
                row.description(),
                row.status(),
                row.requestedByName(),
                row.decisionOwnerUserId(),
                row.decisionOwnerName(),
                row.dueDate(),
                overdue,
                row.decisionNote(),
                row.decidedByName(),
                row.decidedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private GovernanceActionResponse actionResponse(
            GovernanceReviewRepository.ActionRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == GovernanceActionStatus.OPEN
                        ||
                        row.status()
                                == GovernanceActionStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new GovernanceActionResponse(
                row.id(),
                row.actionNumber(),
                row.reviewId(),
                row.decisionId(),
                row.title(),
                row.description(),
                row.ownerUserId(),
                row.ownerName(),
                row.priority(),
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

    private GovernanceReviewRepository.ReviewRow requireReview(
            UUID reviewId
    ) {
        GovernanceReviewRepository.ReviewRow review =
                repository
                        .findReview(
                                reviewId
                        );

        if (review == null) {
            throw new ResourceNotFoundException(
                    "Governance review not found: "
                            + reviewId
            );
        }

        return review;
    }

    private GovernanceReviewRepository.DecisionRow requireDecision(
            UUID decisionId
    ) {
        GovernanceReviewRepository.DecisionRow decision =
                repository
                        .findDecision(
                                decisionId
                        );

        if (decision == null) {
            throw new ResourceNotFoundException(
                    "Governance decision not found: "
                            + decisionId
            );
        }

        return decision;
    }

    private GovernanceReviewRepository.ActionRow requireAction(
            UUID actionId
    ) {
        GovernanceReviewRepository.ActionRow action =
                repository
                        .findAction(
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Governance action not found: "
                            + actionId
            );
        }

        return action;
    }

    private void assertActionMutableReview(
            UUID reviewId
    ) {
        GovernanceReviewRepository.ReviewRow review =
                requireReview(
                        reviewId
                );

        if (
                review.status()
                        != GovernanceReviewStatus.IN_REVIEW
                &&
                review.status()
                        != GovernanceReviewStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Management actions can only progress while the review is active or closed."
            );
        }
    }

    private String nextReviewNumber() {
        Long sequence =
                repository
                        .nextReviewSequence();

        return String.format(
                "GOV-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private String nextDecisionNumber() {
        Long sequence =
                repository
                        .nextDecisionSequence();

        return String.format(
                "GOVD-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                sequence
        );
    }

    private String nextActionNumber() {
        Long sequence =
                repository
                        .nextActionSequence();

        return String.format(
                "GOVA-%d-%05d",
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
                    "Governance-review currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
                );
    }

    private String value(
            String value,
            String fallback
    ) {
        return value == null
                        ||
                        value.isBlank()
                ? fallback
                : value;
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

    private BigDecimal zero() {
        return BigDecimal.ZERO
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
                    "Executive governance ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access governance reviews."
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
                    "Your ProcureIQ role cannot manage governance reviews."
            );
        }
    }

    private void assertChairRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can finalize executive governance decisions and reviews."
            );
        }
    }
}
