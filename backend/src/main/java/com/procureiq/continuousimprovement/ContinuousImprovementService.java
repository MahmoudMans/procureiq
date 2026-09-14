package com.procureiq.continuousimprovement;

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
public class ContinuousImprovementService {

    private final ContinuousImprovementRepository repository;

    private final ContinuousImprovementScoringService scoringService;

    private final AppUserRepository appUserRepository;

    public ContinuousImprovementService(
            ContinuousImprovementRepository repository,
            ContinuousImprovementScoringService scoringService,
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
    public ContinuousImprovementDashboardResponse dashboard(
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

        ContinuousImprovementRepository.SnapshotRow latest =
                repository
                        .latestSnapshot(
                                normalizedCurrency
                        );

        List<ImprovementOpportunityResponse> opportunities =
                latest == null
                        ? List.of()
                        : opportunities(
                                latest
                        );

        return new ContinuousImprovementDashboardResponse(
                normalizedCurrency,
                latest == null
                        ? null
                        : snapshotOption(
                                latest
                        ),
                opportunities,
                repository
                        .initiatives(
                                normalizedCurrency
                        )
                        .stream()
                        .map(
                                this::summaryResponse
                        )
                        .toList()
        );
    }

    @Transactional(readOnly = true)
    public ImprovementContextResponse contextOptions(
            UUID currentUserId,
            String currency,
            UUID snapshotId
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

        List<ContinuousImprovementRepository.SnapshotRow> snapshots =
                repository
                        .snapshots(
                                normalizedCurrency
                        );

        ContinuousImprovementRepository.SnapshotRow selected;

        if (snapshotId != null) {
            selected =
                    requireSnapshot(
                            snapshotId
                    );

            if (
                    !selected.currency()
                            .equals(
                                    normalizedCurrency
                            )
            ) {
                throw new IllegalArgumentException(
                        "Selected operating snapshot belongs to another currency."
                );
            }
        } else {
            selected =
                    snapshots
                            .stream()
                            .findFirst()
                            .orElse(null);
        }

        List<ImprovementDimensionOptionResponse> dimensions =
                selected == null
                        ? List.of()
                        : repository
                                .dimensions(
                                        selected.id()
                                )
                                .stream()
                                .map(
                                        this::dimensionOption
                                )
                                .toList();

        return new ImprovementContextResponse(
                snapshots.stream()
                        .map(
                                this::snapshotOption
                        )
                        .toList(),
                selected == null
                        ? null
                        : snapshotOption(
                                selected
                        ),
                dimensions,
                repository.users()
        );
    }

    @Transactional(readOnly = true)
    public ImprovementInitiativeDetailResponse initiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return detailResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public ImprovementInitiativeDetailResponse createInitiative(
            UUID currentUserId,
            ImprovementInitiativeInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        ContinuousImprovementRepository.SnapshotRow snapshot =
                requireSnapshot(
                        input.sourceSnapshotId()
                );

        if (
                input.targetDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Continuous-improvement target date cannot be in the past."
            );
        }

        BaselineSelection baselineSelection =
                baseline(
                        snapshot,
                        input.scopeType(),
                        input.scopeKey()
                );

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireImprovementUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID initiativeId =
                UUID.randomUUID();

        repository.createInitiative(
                initiativeId,
                nextInitiativeNumber(),
                input,
                snapshot,
                baselineSelection.scopeKey(),
                baselineSelection.scopeLabel(),
                ownerId,
                baselineSelection.metric()
        );

        return detailResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public ImprovementInitiativeSummaryResponse startInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != ImprovementInitiativeStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft improvement initiatives can be started."
            );
        }

        repository.startInitiative(
                initiativeId
        );

        return summaryResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public ImprovementInitiativeSummaryResponse holdInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != ImprovementInitiativeStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only active improvement initiatives can be put on hold."
            );
        }

        repository.holdInitiative(
                initiativeId
        );

        return summaryResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public ImprovementInitiativeSummaryResponse resumeInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != ImprovementInitiativeStatus.ON_HOLD
        ) {
            throw new IllegalArgumentException(
                    "Only on-hold improvement initiatives can be resumed."
            );
        }

        repository.resumeInitiative(
                initiativeId
        );

        return summaryResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public ImprovementInitiativeSummaryResponse completeInitiative(
            UUID currentUserId,
            UUID initiativeId
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        != ImprovementInitiativeStatus.ACTIVE
                &&
                initiative.status()
                        != ImprovementInitiativeStatus.ON_HOLD
        ) {
            throw new IllegalArgumentException(
                    "Only active or on-hold improvement initiatives can be completed."
            );
        }

        List<ContinuousImprovementRepository.CheckpointRow> checkpoints =
                repository
                        .checkpoints(
                                initiativeId
                        );

        if (checkpoints.isEmpty()) {
            throw new IllegalArgumentException(
                    "Improvement initiative requires at least one objective checkpoint before completion."
            );
        }

        ImprovementOutcome latest =
                checkpoints
                        .get(0)
                        .outcome();

        if (
                latest != ImprovementOutcome.IMPROVED
                &&
                latest != ImprovementOutcome.MIXED
        ) {
            throw new IllegalArgumentException(
                    "Latest checkpoint must show IMPROVED or MIXED performance before completion."
            );
        }

        long openActions =
                repository
                        .actions(
                                initiativeId
                        )
                        .stream()
                        .filter(
                                action ->
                                        action.status()
                                                == ImprovementActionStatus.PLANNED
                                        ||
                                        action.status()
                                                == ImprovementActionStatus.IN_PROGRESS
                        )
                        .count();

        if (openActions > 0) {
            throw new IllegalArgumentException(
                    "Improvement initiative cannot complete while actions remain open."
            );
        }

        repository.completeInitiative(
                initiativeId
        );

        return summaryResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public ImprovementInitiativeSummaryResponse cancelInitiative(
            UUID currentUserId,
            UUID initiativeId,
            ImprovementNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        == ImprovementInitiativeStatus.COMPLETED
                ||
                initiative.status()
                        == ImprovementInitiativeStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Completed or cancelled improvement initiatives cannot be cancelled."
            );
        }

        repository.cancelInitiative(
                initiativeId,
                input.note()
        );

        return summaryResponse(
                requireInitiative(
                        initiativeId
                )
        );
    }

    public ImprovementActionResponse createAction(
            UUID currentUserId,
            UUID initiativeId,
            ImprovementActionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.InitiativeRow initiative =
                requireMutableInitiative(
                        initiativeId
                );

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? initiative.ownerUserId()
                        : requireImprovementUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID actionId =
                UUID.randomUUID();

        repository.createAction(
                actionId,
                initiativeId,
                input,
                ownerId
        );

        return actionResponse(
                requireAction(
                        actionId
                )
        );
    }

    public ImprovementActionResponse startAction(
            UUID currentUserId,
            UUID actionId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.ActionRow action =
                requireAction(
                        actionId
                );

        requireMutableInitiative(
                action.initiativeId()
        );

        if (
                action.status()
                        != ImprovementActionStatus.PLANNED
        ) {
            throw new IllegalArgumentException(
                    "Only planned improvement actions can be started."
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

    public ImprovementActionResponse completeAction(
            UUID currentUserId,
            UUID actionId,
            ImprovementNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.ActionRow action =
                requireAction(
                        actionId
                );

        requireMutableInitiative(
                action.initiativeId()
        );

        if (
                action.status()
                        != ImprovementActionStatus.PLANNED
                &&
                action.status()
                        != ImprovementActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active improvement actions can be completed."
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

    public ImprovementActionResponse cancelAction(
            UUID currentUserId,
            UUID actionId,
            ImprovementNoteInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.ActionRow action =
                requireAction(
                        actionId
                );

        requireMutableInitiative(
                action.initiativeId()
        );

        if (
                action.status()
                        != ImprovementActionStatus.PLANNED
                &&
                action.status()
                        != ImprovementActionStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active improvement actions can be cancelled."
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

    public ImprovementCheckpointResponse createCheckpoint(
            UUID currentUserId,
            UUID initiativeId,
            ImprovementCheckpointInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ContinuousImprovementRepository.InitiativeRow initiative =
                requireMutableInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        == ImprovementInitiativeStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Improvement initiative must be started before capturing a checkpoint."
            );
        }

        ContinuousImprovementRepository.SnapshotRow baselineSnapshot =
                requireSnapshot(
                        initiative.sourceSnapshotId()
                );

        ContinuousImprovementRepository.SnapshotRow comparisonSnapshot =
                requireSnapshot(
                        input.snapshotId()
                );

        if (
                !comparisonSnapshot.currency()
                        .equals(
                                initiative.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Checkpoint snapshot belongs to another currency."
            );
        }

        if (
                !comparisonSnapshot.capturedAt()
                        .isAfter(
                                baselineSnapshot.capturedAt()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Checkpoint snapshot must be captured after the baseline snapshot."
            );
        }

        if (
                repository
                        .checkpointExists(
                                initiativeId,
                                comparisonSnapshot.id()
                        )
        ) {
            throw new IllegalArgumentException(
                    "This snapshot has already been evaluated for the improvement initiative."
            );
        }

        ImprovementMetricVector baseline =
                baselineMetric(
                        initiative
                );

        ImprovementMetricVector current =
                metricForScope(
                        comparisonSnapshot,
                        initiative.scopeType(),
                        initiative.scopeKey()
                );

        ImprovementEvaluation evaluation =
                scoringService
                        .evaluate(
                                baseline,
                                current,
                                initiative.targetSlaAttainmentPct(),
                                initiative.targetSlaOverdueReductionPct(),
                                initiative.targetPersistentReductionPct(),
                                initiative.targetResolutionHoursReductionPct(),
                                initiative.targetExposureReductionPct()
                        );

        UUID checkpointId =
                UUID.randomUUID();

        repository.createCheckpoint(
                checkpointId,
                initiativeId,
                comparisonSnapshot.id(),
                current,
                evaluation,
                currentUserId
        );

        return checkpointResponse(
                repository
                        .checkpoints(
                                initiativeId
                        )
                        .stream()
                        .filter(
                                checkpoint ->
                                        checkpoint.id()
                                                .equals(
                                                        checkpointId
                                                )
                        )
                        .findFirst()
                        .orElseThrow()
        );
    }

    private List<ImprovementOpportunityResponse> opportunities(
            ContinuousImprovementRepository.SnapshotRow snapshot
    ) {
        List<ContinuousImprovementRepository.DimensionRow> dimensions =
                repository
                        .dimensions(
                                snapshot.id()
                        );

        return dimensions
                .stream()
                .filter(
                        dimension ->
                                dimension.scopeType()
                                        == ImprovementScopeType.DOMAIN
                                ||
                                dimension.scopeType()
                                        == ImprovementScopeType.EXCEPTION_TYPE
                )
                .map(
                        dimension -> {
                            ImprovementMetricVector metric =
                                    metric(
                                            dimension
                                    );

                            ImprovementOpportunityScore score =
                                    scoringService
                                            .opportunityScore(
                                                    metric,
                                                    snapshot.activeMonetaryExposure()
                                            );

                            return new ImprovementOpportunityResponse(
                                    snapshot.id(),
                                    snapshot.snapshotNumber(),
                                    dimension.scopeType(),
                                    dimension.scopeKey(),
                                    dimension.scopeLabel(),
                                    score.score(),
                                    score.priority(),
                                    metric.activeCount(),
                                    metric.slaOverdueCount(),
                                    metric.persistentCount(),
                                    metric.resolvedCount(),
                                    metric.slaAttainmentPct(),
                                    metric.avgResolutionHours(),
                                    metric.avgActiveAgeDays(),
                                    metric.activeExposure(),
                                    metric.workloadSharePct(),
                                    rationale(
                                            metric
                                    )
                            );
                        }
                )
                .filter(
                        opportunity ->
                                opportunity.opportunityScore()
                                        .compareTo(
                                                new BigDecimal(
                                                        "20.00"
                                                )
                                        )
                                >= 0
                                ||
                                opportunity.slaOverdueCount()
                                        > 0
                                ||
                                opportunity.persistentCount()
                                        > 0
                )
                .sorted(
                        java.util.Comparator
                                .comparing(
                                        ImprovementOpportunityResponse::
                                                opportunityScore
                                )
                                .reversed()
                                .thenComparing(
                                        ImprovementOpportunityResponse::
                                                scopeLabel
                                )
                )
                .limit(
                        20
                )
                .toList();
    }

    private String rationale(
            ImprovementMetricVector metric
    ) {
        return "Active "
                + metric.activeCount()
                + ", SLA overdue "
                + metric.slaOverdueCount()
                + ", persistent "
                + metric.persistentCount()
                + ", SLA attainment "
                + decimal(
                        metric.slaAttainmentPct()
                )
                + "%, workload share "
                + decimal(
                        metric.workloadSharePct()
                )
                + "%, active exposure "
                + money(
                        metric.activeExposure()
                )
                + ".";
    }

    private BaselineSelection baseline(
            ContinuousImprovementRepository.SnapshotRow snapshot,
            ImprovementScopeType scopeType,
            String requestedScopeKey
    ) {
        if (
                scopeType
                        == ImprovementScopeType.OVERALL
        ) {
            return new BaselineSelection(
                    "OVERALL",
                    "Overall procurement operations",
                    metric(
                            snapshot
                    )
            );
        }

        if (
                requestedScopeKey == null
                ||
                requestedScopeKey.isBlank()
        ) {
            throw new IllegalArgumentException(
                    "A scope key is required for dimension-level improvement initiatives."
            );
        }

        ContinuousImprovementRepository.DimensionRow dimension =
                repository
                        .findDimension(
                                snapshot.id(),
                                scopeType,
                                requestedScopeKey.trim()
                        );

        if (dimension == null) {
            throw new IllegalArgumentException(
                    "Selected improvement scope is not present in the baseline snapshot."
            );
        }

        return new BaselineSelection(
                dimension.scopeKey(),
                dimension.scopeLabel(),
                metric(
                        dimension
                )
        );
    }

    private ImprovementMetricVector metricForScope(
            ContinuousImprovementRepository.SnapshotRow snapshot,
            ImprovementScopeType scopeType,
            String scopeKey
    ) {
        if (
                scopeType
                        == ImprovementScopeType.OVERALL
        ) {
            return metric(
                    snapshot
            );
        }

        ContinuousImprovementRepository.DimensionRow dimension =
                repository
                        .findDimension(
                                snapshot.id(),
                                scopeType,
                                scopeKey
                        );

        if (dimension == null) {
            throw new IllegalArgumentException(
                    "The selected scope does not exist in the comparison snapshot."
            );
        }

        return metric(
                dimension
        );
    }

    private ImprovementMetricVector metric(
            ContinuousImprovementRepository.SnapshotRow row
    ) {
        return new ImprovementMetricVector(
                row.activeBacklogCount(),
                row.slaOverdueCount(),
                row.persistentExceptionCount(),
                row.resolvedCount(),
                row.slaAttainmentPct(),
                row.avgResolutionHours(),
                row.avgActiveAgeDays(),
                row.activeMonetaryExposure(),
                new BigDecimal(
                        "100.00"
                )
        );
    }

    private ImprovementMetricVector metric(
            ContinuousImprovementRepository.DimensionRow row
    ) {
        return new ImprovementMetricVector(
                row.activeCount(),
                row.slaOverdueCount(),
                row.persistentCount(),
                row.resolvedCount(),
                row.slaAttainmentPct(),
                row.avgResolutionHours(),
                row.avgActiveAgeDays(),
                row.activeExposure(),
                row.workloadSharePct()
        );
    }

    private ImprovementMetricVector baselineMetric(
            ContinuousImprovementRepository.InitiativeRow row
    ) {
        return new ImprovementMetricVector(
                row.baselineActiveCount(),
                row.baselineSlaOverdueCount(),
                row.baselinePersistentCount(),
                row.baselineResolvedCount(),
                row.baselineSlaAttainmentPct(),
                row.baselineAvgResolutionHours(),
                row.baselineAvgActiveAgeDays(),
                row.baselineActiveExposure(),
                row.scopeType()
                                == ImprovementScopeType.OVERALL
                        ? new BigDecimal(
                                "100.00"
                        )
                        : BigDecimal.ZERO
        );
    }

    private ImprovementInitiativeDetailResponse detailResponse(
            ContinuousImprovementRepository.InitiativeRow initiative
    ) {
        return new ImprovementInitiativeDetailResponse(
                summaryResponse(
                        initiative
                ),
                initiative.description(),
                initiative.notes(),
                baselineMetric(
                        initiative
                ),
                decimal(
                        initiative.targetSlaAttainmentPct()
                ),
                decimal(
                        initiative.targetSlaOverdueReductionPct()
                ),
                decimal(
                        initiative.targetPersistentReductionPct()
                ),
                decimal(
                        initiative.targetResolutionHoursReductionPct()
                ),
                decimal(
                        initiative.targetExposureReductionPct()
                ),
                repository
                        .actions(
                                initiative.id()
                        )
                        .stream()
                        .map(
                                this::actionResponse
                        )
                        .toList(),
                repository
                        .checkpoints(
                                initiative.id()
                        )
                        .stream()
                        .map(
                                this::checkpointResponse
                        )
                        .toList()
        );
    }

    private ImprovementInitiativeSummaryResponse summaryResponse(
            ContinuousImprovementRepository.InitiativeRow row
    ) {
        boolean targetOverdue =
                row.status()
                                != ImprovementInitiativeStatus.COMPLETED
                        &&
                        row.status()
                                != ImprovementInitiativeStatus.CANCELLED
                        &&
                        row.targetDate()
                                .isBefore(
                                        LocalDate.now(
                                                ZoneOffset.UTC
                                        )
                                );

        return new ImprovementInitiativeSummaryResponse(
                row.id(),
                row.initiativeNumber(),
                row.title(),
                row.currency(),
                row.priority(),
                row.status(),
                row.ownerUserId(),
                row.ownerName(),
                row.sourceSnapshotId(),
                row.sourceSnapshotNumber(),
                row.scopeType(),
                row.scopeKey(),
                row.scopeLabel(),
                row.targetDate(),
                targetOverdue,
                row.openActions(),
                row.overdueActions(),
                row.checkpointCount(),
                row.latestOutcome(),
                row.latestAchievementScore()
                        == null
                        ? null
                        : decimal(
                                row.latestAchievementScore()
                        ),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private ImprovementActionResponse actionResponse(
            ContinuousImprovementRepository.ActionRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == ImprovementActionStatus.PLANNED
                        ||
                        row.status()
                                == ImprovementActionStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new ImprovementActionResponse(
                row.id(),
                row.initiativeId(),
                row.title(),
                row.description(),
                row.ownerUserId(),
                row.ownerName(),
                row.status(),
                row.dueDate(),
                overdue,
                row.completionNote(),
                row.startedAt(),
                row.completedAt(),
                row.cancelledAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private ImprovementCheckpointResponse checkpointResponse(
            ContinuousImprovementRepository.CheckpointRow row
    ) {
        return new ImprovementCheckpointResponse(
                row.id(),
                row.snapshotId(),
                row.snapshotNumber(),
                row.currentActiveCount(),
                row.currentSlaOverdueCount(),
                row.currentPersistentCount(),
                row.currentResolvedCount(),
                decimal(
                        row.currentSlaAttainmentPct()
                ),
                decimal(
                        row.currentAvgResolutionHours()
                ),
                decimal(
                        row.currentAvgActiveAgeDays()
                ),
                money(
                        row.currentActiveExposure()
                ),
                decimal(
                        row.slaAttainmentDelta()
                ),
                decimal(
                        row.slaOverdueReductionPct()
                ),
                decimal(
                        row.persistentReductionPct()
                ),
                decimal(
                        row.resolutionHoursReductionPct()
                ),
                decimal(
                        row.exposureReductionPct()
                ),
                row.targetsMetCount(),
                decimal(
                        row.achievementScore()
                ),
                row.outcome(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private ImprovementSnapshotOptionResponse snapshotOption(
            ContinuousImprovementRepository.SnapshotRow row
    ) {
        return new ImprovementSnapshotOptionResponse(
                row.id(),
                row.snapshotNumber(),
                row.currency(),
                row.periodStart(),
                row.periodEnd(),
                row.capturedAt()
        );
    }

    private ImprovementDimensionOptionResponse dimensionOption(
            ContinuousImprovementRepository.DimensionRow row
    ) {
        return new ImprovementDimensionOptionResponse(
                row.scopeType(),
                row.scopeKey(),
                row.scopeLabel(),
                row.activeCount(),
                row.slaOverdueCount(),
                row.persistentCount(),
                row.resolvedCount(),
                decimal(
                        row.slaAttainmentPct()
                ),
                decimal(
                        row.avgResolutionHours()
                ),
                decimal(
                        row.avgActiveAgeDays()
                ),
                money(
                        row.activeExposure()
                ),
                decimal(
                        row.workloadSharePct()
                )
        );
    }

    private ContinuousImprovementRepository.SnapshotRow requireSnapshot(
            UUID snapshotId
    ) {
        ContinuousImprovementRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Operating-rhythm snapshot not found: "
                            + snapshotId
            );
        }

        return snapshot;
    }

    private ContinuousImprovementRepository.InitiativeRow requireInitiative(
            UUID initiativeId
    ) {
        ContinuousImprovementRepository.InitiativeRow initiative =
                repository
                        .findInitiative(
                                initiativeId
                        );

        if (initiative == null) {
            throw new ResourceNotFoundException(
                    "Continuous-improvement initiative not found: "
                            + initiativeId
            );
        }

        return initiative;
    }

    private ContinuousImprovementRepository.InitiativeRow requireMutableInitiative(
            UUID initiativeId
    ) {
        ContinuousImprovementRepository.InitiativeRow initiative =
                requireInitiative(
                        initiativeId
                );

        if (
                initiative.status()
                        == ImprovementInitiativeStatus.COMPLETED
                ||
                initiative.status()
                        == ImprovementInitiativeStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Completed or cancelled improvement initiatives cannot be changed."
            );
        }

        return initiative;
    }

    private ContinuousImprovementRepository.ActionRow requireAction(
            UUID actionId
    ) {
        ContinuousImprovementRepository.ActionRow action =
                repository
                        .findAction(
                                actionId
                        );

        if (action == null) {
            throw new ResourceNotFoundException(
                    "Improvement action not found: "
                            + actionId
            );
        }

        return action;
    }

    private String nextInitiativeNumber() {
        Long sequence =
                repository
                        .nextInitiativeSequence();

        return String.format(
                "CIP-%d-%05d",
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
                    "Continuous-improvement currency must contain exactly three characters."
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
        return decimal(
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

    private AppUserEntity requireImprovementUser(
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
                    "Continuous-improvement ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access continuous-improvement intelligence."
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
                    "Your ProcureIQ role cannot manage continuous-improvement initiatives."
            );
        }
    }

    private void assertFinalizeRole(
            ProcurementRole role
    ) {
        if (
                role != ProcurementRole.ADMIN
                &&
                role != ProcurementRole.PROCUREMENT_MANAGER
        ) {
            throw new IllegalArgumentException(
                    "Only administrators and procurement managers can finalize improvement initiatives."
            );
        }
    }

    private record BaselineSelection(
            String scopeKey,
            String scopeLabel,
            ImprovementMetricVector metric
    ) {
    }
}
