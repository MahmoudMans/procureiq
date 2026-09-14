package com.procureiq.strategicokr;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
@Transactional
public class StrategicOkrService {

    private final StrategicOkrRepository repository;

    private final StrategicOkrMathService mathService;

    private final AppUserRepository appUserRepository;

    public StrategicOkrService(
            StrategicOkrRepository repository,
            StrategicOkrMathService mathService,
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
    public StrategicOkrDashboardResponse dashboard(
            UUID currentUserId,
            String currency,
            int fiscalYear
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

        List<StrategicObjectiveSummaryResponse> objectives =
                repository
                        .objectives(
                                normalizedCurrency,
                                fiscalYear
                        )
                        .stream()
                        .map(
                                this::summaryResponse
                        )
                        .toList();

        BigDecimal averageProgress =
                average(
                        objectives.stream()
                                .map(
                                        StrategicObjectiveSummaryResponse::
                                                progressPct
                                )
                                .toList()
                );

        BigDecimal averageConfidence =
                average(
                        objectives.stream()
                                .map(
                                        StrategicObjectiveSummaryResponse::
                                                confidencePct
                                )
                                .toList()
                );

        return new StrategicOkrDashboardResponse(
                normalizedCurrency,
                fiscalYear,
                objectives.size(),
                objectives.stream()
                        .filter(
                                objective ->
                                        objective.status()
                                                == StrategicObjectiveStatus.ACTIVE
                                        ||
                                        objective.status()
                                                == StrategicObjectiveStatus.ON_HOLD
                        )
                        .count(),
                objectives.stream()
                        .filter(
                                objective ->
                                        objective.status()
                                                == StrategicObjectiveStatus.ACHIEVED
                                        ||
                                        objective.status()
                                                == StrategicObjectiveStatus.CLOSED
                        )
                        .count(),
                objectives.stream()
                        .filter(
                                objective ->
                                        objective.health()
                                                == StrategicHealth.AT_RISK
                                        ||
                                        objective.health()
                                                == StrategicHealth.OFF_TRACK
                        )
                        .count(),
                averageProgress,
                averageConfidence,
                objectives
        );
    }

    @Transactional(readOnly = true)
    public OkrContextResponse contextOptions(
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

        return new OkrContextResponse(
                repository.users(),
                repository.operatingScopes(
                        normalizedCurrency
                ),
                repository.improvementOptions(
                        normalizedCurrency
                )
        );
    }

    @Transactional(readOnly = true)
    public StrategicObjectiveDetailResponse objective(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return detailResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public StrategicObjectiveDetailResponse createObjective(
            UUID currentUserId,
            StrategicObjectiveInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        validateObjectivePeriod(
                input
        );

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireOkrUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID objectiveId =
                UUID.randomUUID();

        repository.createObjective(
                objectiveId,
                nextObjectiveNumber(),
                input,
                normalizeCurrency(
                        input.currency()
                ),
                ownerId
        );

        return detailResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public KeyResultResponse createKeyResult(
            UUID currentUserId,
            UUID objectiveId,
            KeyResultInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireEditableObjective(
                        objectiveId
                );

        validateKeyResultDefinition(
                input
        );

        List<StrategicOkrRepository.KeyResultRow> existing =
                repository
                        .keyResults(
                                objectiveId
                        );

        BigDecimal weightTotal =
                existing.stream()
                        .map(
                                StrategicOkrRepository.KeyResultRow::
                                        weightPct
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .add(
                                input.weightPct()
                        );

        if (
                weightTotal.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) > 0
        ) {
            throw new IllegalArgumentException(
                    "Key-result weights cannot exceed 100%."
            );
        }

        SourceSelection source =
                initialSource(
                        objective,
                        input
                );

        BigDecimal progress =
                mathService.progress(
                        input.direction(),
                        input.baselineValue(),
                        input.targetValue(),
                        source.actualValue()
                );

        String status =
                progress.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) >= 0
                        ? "ACHIEVED"
                        : "ACTIVE";

        UUID keyResultId =
                UUID.randomUUID();

        repository.createKeyResult(
                keyResultId,
                objectiveId,
                input,
                source.scopeType(),
                source.scopeKey(),
                source.actualValue(),
                source.observedAt(),
                status
        );

        return keyResultResponse(
                requireKeyResult(
                        keyResultId
                )
        );
    }

    public StrategicObjectiveDetailResponse refreshObjective(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        == StrategicObjectiveStatus.CANCELLED
                ||
                objective.status()
                        == StrategicObjectiveStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Closed or cancelled objectives cannot refresh live key-result actuals."
            );
        }

        refreshAuthorityActuals(
                objective
        );

        return detailResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public KeyResultResponse updateManualActual(
            UUID currentUserId,
            UUID keyResultId,
            KeyResultManualActualInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.KeyResultRow keyResult =
                requireKeyResult(
                        keyResultId
                );

        requireEditableObjective(
                keyResult.objectiveId()
        );

        if (
                keyResult.sourceType()
                        != KeyResultSourceType.MANUAL
        ) {
            throw new IllegalArgumentException(
                    "Only MANUAL key results can receive manually entered actual values."
            );
        }

        BigDecimal progress =
                mathService.progress(
                        keyResult.direction(),
                        keyResult.baselineValue(),
                        keyResult.targetValue(),
                        input.actualValue()
                );

        repository.updateActual(
                keyResultId,
                input.actualValue(),
                Instant.now(),
                input.note()
                        .trim(),
                progress.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) >= 0
                        ? "ACHIEVED"
                        : "ACTIVE"
        );

        return keyResultResponse(
                requireKeyResult(
                        keyResultId
                )
        );
    }

    public OkrContributionResponse createContribution(
            UUID currentUserId,
            UUID keyResultId,
            OkrContributionInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.KeyResultRow keyResult =
                requireKeyResult(
                        keyResultId
                );

        StrategicOkrRepository.ObjectiveRow objective =
                requireEditableObjective(
                        keyResult.objectiveId()
                );

        StrategicOkrRepository.ImprovementOptionRow improvement =
                repository
                        .findImprovement(
                                input.improvementInitiativeId()
                        );

        if (improvement == null) {
            throw new ResourceNotFoundException(
                    "Continuous-improvement initiative not found: "
                            + input.improvementInitiativeId()
            );
        }

        if (
                !improvement.currency()
                        .equals(
                                objective.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Contribution initiative belongs to another currency."
            );
        }

        if (
                "CANCELLED".equals(
                        improvement.status()
                )
        ) {
            throw new IllegalArgumentException(
                    "Cancelled improvement initiatives cannot contribute to a key result."
            );
        }

        repository.createContribution(
                UUID.randomUUID(),
                keyResultId,
                input
        );

        return repository
                .contributions(
                        keyResultId
                )
                .stream()
                .filter(
                        contribution ->
                                contribution.improvementInitiativeId()
                                        .equals(
                                                input.improvementInitiativeId()
                                        )
                )
                .findFirst()
                .map(
                        this::contributionResponse
                )
                .orElseThrow();
    }

    public StrategicObjectiveSummaryResponse startObjective(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        != StrategicObjectiveStatus.DRAFT
        ) {
            throw new IllegalArgumentException(
                    "Only draft strategic objectives can be started."
            );
        }

        List<StrategicOkrRepository.KeyResultRow> keyResults =
                repository
                        .keyResults(
                                objectiveId
                        );

        if (keyResults.isEmpty()) {
            throw new IllegalArgumentException(
                    "Strategic objective requires at least one key result."
            );
        }

        BigDecimal coverage =
                keyResults.stream()
                        .map(
                                StrategicOkrRepository.KeyResultRow::
                                        weightPct
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        );

        if (
                coverage.compareTo(
                        new BigDecimal(
                                "100.00"
                        )
                ) != 0
        ) {
            throw new IllegalArgumentException(
                    "Strategic objective key-result weights must equal exactly 100% before activation."
            );
        }

        repository.startObjective(
                objectiveId
        );

        return summaryResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public StrategicObjectiveSummaryResponse holdObjective(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        != StrategicObjectiveStatus.ACTIVE
        ) {
            throw new IllegalArgumentException(
                    "Only active objectives can be put on hold."
            );
        }

        repository.holdObjective(
                objectiveId
        );

        return summaryResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public StrategicObjectiveSummaryResponse resumeObjective(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        != StrategicObjectiveStatus.ON_HOLD
        ) {
            throw new IllegalArgumentException(
                    "Only on-hold objectives can be resumed."
            );
        }

        repository.resumeObjective(
                objectiveId
        );

        return summaryResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public StrategicObjectiveSummaryResponse achieveObjective(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        != StrategicObjectiveStatus.ACTIVE
                &&
                objective.status()
                        != StrategicObjectiveStatus.ON_HOLD
        ) {
            throw new IllegalArgumentException(
                    "Only active or on-hold objectives can be marked achieved."
            );
        }

        refreshAuthorityActuals(
                objective
        );

        ObjectiveEvaluation evaluation =
                objectiveEvaluation(
                        requireObjective(
                                objectiveId
                        )
                );

        if (
                evaluation.progress()
                        .compareTo(
                                new BigDecimal(
                                        "100.00"
                                )
                        ) < 0
        ) {
            throw new IllegalArgumentException(
                    "Strategic objective cannot be marked achieved until weighted progress reaches 100%."
            );
        }

        repository.achieveObjective(
                objectiveId
        );

        return summaryResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public StrategicObjectiveSummaryResponse closeObjective(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        != StrategicObjectiveStatus.ACHIEVED
        ) {
            throw new IllegalArgumentException(
                    "Only achieved objectives can be closed."
            );
        }

        repository.closeObjective(
                objectiveId
        );

        return summaryResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public StrategicObjectiveSummaryResponse cancelObjective(
            UUID currentUserId,
            UUID objectiveId,
            OkrCancellationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        == StrategicObjectiveStatus.ACHIEVED
                ||
                objective.status()
                        == StrategicObjectiveStatus.CLOSED
                ||
                objective.status()
                        == StrategicObjectiveStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Achieved, closed or cancelled objectives cannot be cancelled."
            );
        }

        repository.cancelObjective(
                objectiveId,
                input.note()
        );

        return summaryResponse(
                requireObjective(
                        objectiveId
                )
        );
    }

    public OkrSnapshotDetailResponse captureSnapshot(
            UUID currentUserId,
            UUID objectiveId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        == StrategicObjectiveStatus.DRAFT
                ||
                objective.status()
                        == StrategicObjectiveStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Draft or cancelled objectives cannot produce executive OKR snapshots."
            );
        }

        if (
                objective.status()
                        == StrategicObjectiveStatus.ACTIVE
                ||
                objective.status()
                        == StrategicObjectiveStatus.ON_HOLD
        ) {
            refreshAuthorityActuals(
                    objective
            );
        }

        StrategicOkrRepository.ObjectiveRow refreshedObjective =
                requireObjective(
                        objectiveId
                );

        ObjectiveEvaluation evaluation =
                objectiveEvaluation(
                        refreshedObjective
                );

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                refreshedObjective,
                evaluation.progress(),
                evaluation.health(),
                evaluation.confidence(),
                evaluation.keyResults()
                        .size(),
                (
                        int
                ) evaluation
                        .keyResults()
                        .stream()
                        .filter(
                                value ->
                                        value.health()
                                                == StrategicHealth.ACHIEVED
                        )
                        .count(),
                currentUserId
        );

        for (
                KeyResultEvaluation keyResult
                : evaluation.keyResults()
        ) {
            repository.createSnapshotKeyResult(
                    snapshotId,
                    keyResult.row(),
                    keyResult.progress(),
                    keyResult.health(),
                    keyResult.confidence(),
                    repository
                            .contributions(
                                    keyResult
                                            .row()
                                            .id()
                            )
                            .size()
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    @Transactional(readOnly = true)
    public OkrSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        StrategicOkrRepository.SnapshotRow row =
                repository
                        .findSnapshotRow(
                                snapshotId
                        );

        if (row == null) {
            throw new ResourceNotFoundException(
                    "Procurement OKR snapshot not found: "
                            + snapshotId
            );
        }

        return new OkrSnapshotDetailResponse(
                snapshotSummary(
                        row
                ),
                row.objectiveNumber(),
                row.objectiveTitle(),
                row.currency(),
                row.periodType(),
                row.fiscalYear(),
                row.quarter(),
                row.objectiveStatus(),
                repository
                        .snapshotKeyResults(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotKeyResultResponse
                        )
                        .toList()
        );
    }

    private void refreshAuthorityActuals(
            StrategicOkrRepository.ObjectiveRow objective
    ) {
        for (
                StrategicOkrRepository.KeyResultRow keyResult
                : repository.keyResults(
                        objective.id()
                )
        ) {
            if (
                    keyResult.sourceType()
                            == KeyResultSourceType.MANUAL
            ) {
                continue;
            }

            SourceSelection source =
                    sourceSelection(
                            objective.currency(),
                            keyResult.sourceType(),
                            keyResult.sourceScopeType(),
                            keyResult.sourceScopeKey()
                    );

            BigDecimal progress =
                    mathService.progress(
                            keyResult.direction(),
                            keyResult.baselineValue(),
                            keyResult.targetValue(),
                            source.actualValue()
                    );

            repository.updateActual(
                    keyResult.id(),
                    source.actualValue(),
                    source.observedAt(),
                    null,
                    progress.compareTo(
                            new BigDecimal(
                                    "100.00"
                            )
                    ) >= 0
                            ? "ACHIEVED"
                            : "ACTIVE"
            );
        }
    }

    private SourceSelection initialSource(
            StrategicOkrRepository.ObjectiveRow objective,
            KeyResultInput input
    ) {
        if (
                input.sourceType()
                        == KeyResultSourceType.MANUAL
        ) {
            return new SourceSelection(
                    input.baselineValue(),
                    Instant.now(),
                    null,
                    null
            );
        }

        OkrSourceScopeType scopeType =
                input.sourceScopeType();

        String scopeKey =
                normalizeOptional(
                        input.sourceScopeKey()
                );

        if (
                input.sourceType()
                        .name()
                        .startsWith(
                                "OPERATING_RHYTHM_"
                        )
        ) {
            if (scopeType == null) {
                scopeType =
                        OkrSourceScopeType.OVERALL;
            }

            if (
                    scopeType
                            != OkrSourceScopeType.OVERALL
                    &&
                    scopeKey == null
            ) {
                throw new IllegalArgumentException(
                        "A source scope key is required for dimension-level operating-rhythm key results."
                );
            }
        } else {
            scopeType =
                    null;

            scopeKey =
                    null;
        }

        SourceSelection source =
                sourceSelection(
                        objective.currency(),
                        input.sourceType(),
                        scopeType,
                        scopeKey
                );

        return new SourceSelection(
                source.actualValue(),
                source.observedAt(),
                scopeType,
                scopeKey
        );
    }

    private SourceSelection sourceSelection(
            String currency,
            KeyResultSourceType sourceType,
            OkrSourceScopeType scopeType,
            String scopeKey
    ) {
        if (
                sourceType
                        .name()
                        .startsWith(
                                "OPERATING_RHYTHM_"
                        )
        ) {
            StrategicOkrRepository.OperatingMetricRow operating =
                    repository
                            .latestOperatingMetric(
                                    currency,
                                    scopeType,
                                    scopeKey
                            );

            if (operating == null) {
                throw new IllegalArgumentException(
                        "No operating-rhythm authority exists for the selected OKR source scope."
                );
            }

            BigDecimal value =
                    switch (
                            sourceType
                    ) {
                        case OPERATING_RHYTHM_SLA_ATTAINMENT ->
                                operating.slaAttainmentPct();

                        case OPERATING_RHYTHM_ACTIVE_BACKLOG ->
                                operating.activeCount();

                        case OPERATING_RHYTHM_SLA_OVERDUE ->
                                operating.slaOverdueCount();

                        case OPERATING_RHYTHM_PERSISTENT_BACKLOG ->
                                operating.persistentCount();

                        case OPERATING_RHYTHM_AVG_RESOLUTION_HOURS ->
                                operating.avgResolutionHours();

                        case OPERATING_RHYTHM_ACTIVE_EXPOSURE ->
                                operating.activeExposure();

                        default ->
                                throw new IllegalArgumentException(
                                        "Unsupported operating-rhythm source."
                                );
                    };

            return new SourceSelection(
                    value,
                    operating.observedAt(),
                    scopeType == null
                            ? OkrSourceScopeType.OVERALL
                            : scopeType,
                    scopeKey
            );
        }

        StrategicOkrRepository.ImprovementMetricsRow improvement =
                repository
                        .improvementMetrics(
                                currency
                        );

        BigDecimal value =
                switch (
                        sourceType
                ) {
                    case CONTINUOUS_IMPROVEMENT_ACTIVE_INITIATIVES ->
                            BigDecimal.valueOf(
                                    improvement.activeCount()
                            );

                    case CONTINUOUS_IMPROVEMENT_COMPLETED_INITIATIVES ->
                            BigDecimal.valueOf(
                                    improvement.completedCount()
                            );

                    case CONTINUOUS_IMPROVEMENT_IMPROVED_INITIATIVES ->
                            BigDecimal.valueOf(
                                    improvement.improvedCount()
                            );

                    case CONTINUOUS_IMPROVEMENT_COMPLETION_RATE ->
                            improvement.eligibleCount()
                                            == 0
                                    ? BigDecimal.ZERO
                                    : BigDecimal
                                            .valueOf(
                                                    improvement.completedCount()
                                            )
                                            .multiply(
                                                    new BigDecimal(
                                                            "100.00"
                                                    )
                                            )
                                            .divide(
                                                    BigDecimal.valueOf(
                                                            improvement.eligibleCount()
                                                    ),
                                                    2,
                                                    RoundingMode.HALF_UP
                                            );

                    default ->
                            throw new IllegalArgumentException(
                                    "Unsupported key-result source."
                            );
                };

        return new SourceSelection(
                value,
                improvement.observedAt(),
                null,
                null
        );
    }

    private ObjectiveEvaluation objectiveEvaluation(
            StrategicOkrRepository.ObjectiveRow objective
    ) {
        List<KeyResultEvaluation> keyResults =
                repository
                        .keyResults(
                                objective.id()
                        )
                        .stream()
                        .map(
                                this::evaluateKeyResult
                        )
                        .toList();

        BigDecimal progress =
                mathService.weightedScore(
                        keyResults.stream()
                                .map(
                                        value ->
                                                new StrategicOkrMathService.WeightedValue(
                                                        value.progress(),
                                                        value.row()
                                                                .weightPct()
                                                )
                                )
                                .toList()
                );

        BigDecimal confidence =
                mathService.weightedScore(
                        keyResults.stream()
                                .map(
                                        value ->
                                                new StrategicOkrMathService.WeightedValue(
                                                        value.confidence(),
                                                        value.row()
                                                                .weightPct()
                                                )
                                )
                                .toList()
                );

        return new ObjectiveEvaluation(
                keyResults,
                progress,
                mathService.health(
                        progress
                ),
                confidence
        );
    }

    private KeyResultEvaluation evaluateKeyResult(
            StrategicOkrRepository.KeyResultRow row
    ) {
        BigDecimal progress =
                mathService.progress(
                        row.direction(),
                        row.baselineValue(),
                        row.targetValue(),
                        row.actualValue()
                );

        return new KeyResultEvaluation(
                row,
                progress,
                mathService.health(
                        progress
                ),
                mathService.confidence(
                        row.sourceType(),
                        row.sourceObservedAt(),
                        Instant.now()
                )
        );
    }

    private StrategicObjectiveDetailResponse detailResponse(
            StrategicOkrRepository.ObjectiveRow objective
    ) {
        return new StrategicObjectiveDetailResponse(
                summaryResponse(
                        objective
                ),
                objective.description(),
                repository
                        .keyResults(
                                objective.id()
                        )
                        .stream()
                        .map(
                                this::keyResultResponse
                        )
                        .toList(),
                repository
                        .snapshots(
                                objective.id()
                        )
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    private StrategicObjectiveSummaryResponse summaryResponse(
            StrategicOkrRepository.ObjectiveRow objective
    ) {
        ObjectiveEvaluation evaluation =
                objectiveEvaluation(
                        objective
                );

        BigDecimal weightCoverage =
                evaluation
                        .keyResults()
                        .stream()
                        .map(
                                value ->
                                        value.row()
                                                .weightPct()
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        boolean periodOverdue =
                objective.status()
                                != StrategicObjectiveStatus.ACHIEVED
                        &&
                        objective.status()
                                != StrategicObjectiveStatus.CLOSED
                        &&
                        objective.status()
                                != StrategicObjectiveStatus.CANCELLED
                        &&
                        objective.endDate()
                                .isBefore(
                                        LocalDate.now(
                                                ZoneOffset.UTC
                                        )
                                );

        return new StrategicObjectiveSummaryResponse(
                objective.id(),
                objective.objectiveNumber(),
                objective.title(),
                objective.currency(),
                objective.periodType(),
                objective.fiscalYear(),
                objective.quarter(),
                objective.startDate(),
                objective.endDate(),
                objective.status(),
                objective.ownerUserId(),
                objective.ownerName(),
                evaluation.keyResults()
                        .size(),
                (
                        int
                ) evaluation
                        .keyResults()
                        .stream()
                        .filter(
                                value ->
                                        value.health()
                                                == StrategicHealth.ACHIEVED
                        )
                        .count(),
                weightCoverage,
                evaluation.progress(),
                evaluation.health(),
                evaluation.confidence(),
                repository
                        .snapshots(
                                objective.id()
                        )
                        .size(),
                periodOverdue,
                objective.createdAt(),
                objective.updatedAt(),
                objective.version()
        );
    }

    private KeyResultResponse keyResultResponse(
            StrategicOkrRepository.KeyResultRow row
    ) {
        KeyResultEvaluation evaluation =
                evaluateKeyResult(
                        row
                );

        return new KeyResultResponse(
                row.id(),
                row.objectiveId(),
                row.title(),
                row.description(),
                row.metricType(),
                row.direction(),
                row.sourceType(),
                row.sourceScopeType(),
                row.sourceScopeKey(),
                decimal(
                        row.baselineValue()
                ),
                decimal(
                        row.targetValue()
                ),
                decimal(
                        row.actualValue()
                ),
                decimal(
                        row.weightPct()
                ),
                evaluation.progress(),
                evaluation.health(),
                evaluation.confidence(),
                row.sourceObservedAt(),
                row.actualUpdatedAt(),
                row.manualNote(),
                row.status(),
                repository
                        .contributions(
                                row.id()
                        )
                        .stream()
                        .map(
                                this::contributionResponse
                        )
                        .toList()
        );
    }

    private OkrContributionResponse contributionResponse(
            StrategicOkrRepository.ContributionRow row
    ) {
        return new OkrContributionResponse(
                row.id(),
                row.improvementInitiativeId(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.initiativeStatus(),
                decimal(
                        row.contributionWeightPct()
                ),
                row.rationale()
        );
    }

    private OkrSnapshotSummaryResponse snapshotSummary(
            StrategicOkrRepository.SnapshotRow row
    ) {
        return new OkrSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.objectiveId(),
                decimal(
                        row.overallProgressPct()
                ),
                row.overallHealth(),
                decimal(
                        row.overallConfidencePct()
                ),
                row.keyResultCount(),
                row.achievedKeyResultCount(),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private OkrSnapshotKeyResultResponse snapshotKeyResultResponse(
            StrategicOkrRepository.SnapshotKeyResultRow row
    ) {
        return new OkrSnapshotKeyResultResponse(
                row.id(),
                row.keyResultId(),
                row.title(),
                row.metricType(),
                row.direction(),
                row.sourceType(),
                row.sourceScopeType(),
                row.sourceScopeKey(),
                decimal(
                        row.baselineValue()
                ),
                decimal(
                        row.targetValue()
                ),
                decimal(
                        row.actualValue()
                ),
                decimal(
                        row.weightPct()
                ),
                decimal(
                        row.progressPct()
                ),
                row.health(),
                decimal(
                        row.confidencePct()
                ),
                row.sourceObservedAt(),
                row.contributionCount()
        );
    }

    private void validateObjectivePeriod(
            StrategicObjectiveInput input
    ) {
        if (
                input.endDate()
                        .isBefore(
                                input.startDate()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Strategic objective end date cannot precede start date."
            );
        }

        if (
                input.periodType()
                        == StrategicObjectivePeriodType.ANNUAL
                &&
                input.quarter()
                        != null
        ) {
            throw new IllegalArgumentException(
                    "Annual objectives cannot specify a quarter."
            );
        }

        if (
                input.periodType()
                        == StrategicObjectivePeriodType.QUARTERLY
                &&
                (
                        input.quarter()
                                == null
                        ||
                        input.quarter()
                                < 1
                        ||
                        input.quarter()
                                > 4
                )
        ) {
            throw new IllegalArgumentException(
                    "Quarterly objectives require quarter 1 through 4."
            );
        }
    }

    private void validateKeyResultDefinition(
            KeyResultInput input
    ) {
        int comparison =
                input.targetValue()
                        .compareTo(
                                input.baselineValue()
                        );

        if (
                input.direction()
                        == KeyResultDirection.INCREASE
                &&
                comparison < 0
        ) {
            throw new IllegalArgumentException(
                    "INCREASE key results require target value greater than or equal to baseline."
            );
        }

        if (
                input.direction()
                        == KeyResultDirection.DECREASE
                &&
                comparison > 0
        ) {
            throw new IllegalArgumentException(
                    "DECREASE key results require target value less than or equal to baseline."
            );
        }

        if (
                input.sourceType()
                        == KeyResultSourceType.MANUAL
                &&
                (
                        input.sourceScopeType()
                                != null
                        ||
                        normalizeOptional(
                                input.sourceScopeKey()
                        )
                                != null
                )
        ) {
            throw new IllegalArgumentException(
                    "MANUAL key results cannot define an authority scope."
            );
        }
    }

    private StrategicOkrRepository.ObjectiveRow requireObjective(
            UUID objectiveId
    ) {
        StrategicOkrRepository.ObjectiveRow objective =
                repository
                        .findObjective(
                                objectiveId
                        );

        if (objective == null) {
            throw new ResourceNotFoundException(
                    "Strategic procurement objective not found: "
                            + objectiveId
            );
        }

        return objective;
    }

    private StrategicOkrRepository.ObjectiveRow requireEditableObjective(
            UUID objectiveId
    ) {
        StrategicOkrRepository.ObjectiveRow objective =
                requireObjective(
                        objectiveId
                );

        if (
                objective.status()
                        == StrategicObjectiveStatus.ACHIEVED
                ||
                objective.status()
                        == StrategicObjectiveStatus.CLOSED
                ||
                objective.status()
                        == StrategicObjectiveStatus.CANCELLED
        ) {
            throw new IllegalArgumentException(
                    "Achieved, closed or cancelled strategic objectives cannot be edited."
            );
        }

        return objective;
    }

    private StrategicOkrRepository.KeyResultRow requireKeyResult(
            UUID keyResultId
    ) {
        StrategicOkrRepository.KeyResultRow row =
                repository
                        .findKeyResult(
                                keyResultId
                        );

        if (row == null) {
            throw new ResourceNotFoundException(
                    "Procurement key result not found: "
                            + keyResultId
            );
        }

        return row;
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
                    "Authenticated ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private AppUserEntity requireOkrUser(
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
                    "Strategic objective ownership requires a procurement governance role."
            );
        }

        return user;
    }

    private String nextObjectiveNumber() {
        return String.format(
                "OBJ-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextObjectiveSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "OKR-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextSnapshotSequence()
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
                    "Strategic-objective currency must contain exactly three characters."
            );
        }

        return currency
                .trim()
                .toUpperCase(
                        Locale.ROOT
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

    private BigDecimal average(
            List<BigDecimal> values
    ) {
        if (values.isEmpty()) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return values.stream()
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .divide(
                        BigDecimal.valueOf(
                                values.size()
                        ),
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
                    "Your ProcureIQ role cannot access strategic OKRs."
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
                    "Your ProcureIQ role cannot manage strategic OKRs."
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
                    "Only administrators and procurement managers can finalize strategic objectives."
            );
        }
    }

    private record SourceSelection(
            BigDecimal actualValue,
            Instant observedAt,
            OkrSourceScopeType scopeType,
            String scopeKey
    ) {
    }

    private record KeyResultEvaluation(
            StrategicOkrRepository.KeyResultRow row,
            BigDecimal progress,
            StrategicHealth health,
            BigDecimal confidence
    ) {
    }

    private record ObjectiveEvaluation(
            List<KeyResultEvaluation> keyResults,
            BigDecimal progress,
            StrategicHealth health,
            BigDecimal confidence
    ) {
    }
}
