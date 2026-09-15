package com.procureiq.capitalflywheel;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceCaseResponse;
import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceDashboardResponse;
import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceHealth;
import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceService;
import com.procureiq.reinvestmentpersistence.ReinvestmentPersistenceStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Year;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class CapitalFlywheelService {

    private final CapitalFlywheelRepository repository;

    private final CapitalFlywheelMathService mathService;

    private final ReinvestmentPersistenceService reinvestmentPersistenceService;

    private final AppUserRepository appUserRepository;

    public CapitalFlywheelService(
            CapitalFlywheelRepository repository,
            CapitalFlywheelMathService mathService,
            ReinvestmentPersistenceService reinvestmentPersistenceService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.reinvestmentPersistenceService =
                reinvestmentPersistenceService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public CapitalFlywheelDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<CapitalFlywheelCandidateResponse> candidates =
                eligibleCandidates(
                        currentUserId
                );

        List<CapitalFlywheelLineageResponse> lineages =
                repository
                        .lineages()
                        .stream()
                        .map(
                                row ->
                                        lineageResponse(
                                                row
                                        )
                        )
                        .toList();

        return new CapitalFlywheelDashboardResponse(
                summary(
                        candidates.size(),
                        lineages
                ),

                repository.users(),

                candidates,

                lineages,

                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public CapitalFlywheelLineageDetailResponse createLineage(
            UUID currentUserId,
            UUID persistenceCaseId,
            CapitalFlywheelLineageInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .persistenceCaseAlreadyUsed(
                                persistenceCaseId
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 65 persistence case is already part of a capital-flywheel lineage."
            );
        }

        CapitalFlywheelCandidateResponse candidate =
                eligibleCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .persistenceCaseId()
                                                .equals(
                                                        persistenceCaseId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Step 65 persistence case is not eligible to start a capital lineage."
                                        )
                        );

        AppUserEntity owner =
                requireFlywheelUser(
                        input.lineageOwnerUserId()
                );

        UUID lineageId =
                UUID.randomUUID();

        repository.createLineage(
                lineageId,
                nextLineageNumber(),
                candidate,
                input,
                owner.getFullName(),
                currentUserId
        );

        repository.createCycle(
                UUID.randomUUID(),
                lineageId,
                1,
                candidate,
                "Root cycle establishing the original governed capital lineage.",
                currentUserId
        );

        return lineage(
                currentUserId,
                lineageId
        );
    }

    @Transactional(readOnly = true)
    public CapitalFlywheelLineageDetailResponse lineage(
            UUID currentUserId,
            UUID lineageId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalFlywheelRepository.LineageRow lineage =
                requireLineage(
                        lineageId
                );

        List<CapitalFlywheelCandidateResponse> available =
                eligibleCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        candidate.currency()
                                                .equalsIgnoreCase(
                                                        lineage.currency()
                                                )
                        )
                        .filter(
                                candidate ->
                                        candidate.fiscalYear()
                                                >= lineage.rootFiscalYear()
                        )
                        .toList();

        return new CapitalFlywheelLineageDetailResponse(
                lineageResponse(
                        lineage
                ),

                repository.users(),

                available,

                repository
                        .cycles(
                                lineageId
                        )
                        .stream()
                        .map(
                                this::cycleResponse
                        )
                        .toList(),

                repository
                        .reviews(
                                lineageId
                        )
                        .stream()
                        .map(
                                this::reviewResponse
                        )
                        .toList()
        );
    }

    public CapitalFlywheelLineageDetailResponse appendCycle(
            UUID currentUserId,
            UUID lineageId,
            CapitalFlywheelCycleInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalFlywheelRepository.LineageRow lineage =
                requireLineage(
                        lineageId
                );

        if (
                lineage.status()
                        != CapitalFlywheelStatus.APPROVED_FOR_NEXT_CYCLE
        ) {
            throw new IllegalArgumentException(
                    "Another recycling cycle requires explicit manager approval from the previous flywheel review."
            );
        }

        List<CapitalFlywheelRepository.CycleRow> existingCycles =
                repository
                        .cycles(
                                lineageId
                        );

        if (
                existingCycles.size()
                        >= lineage.maximumCycleCount()
        ) {
            throw new IllegalArgumentException(
                    "Capital lineage has reached its governed maximum cycle count."
            );
        }

        if (
                repository
                        .persistenceCaseAlreadyUsed(
                                input.persistenceCaseId()
                        )
        ) {
            throw new IllegalArgumentException(
                    "Step 65 persistence case already belongs to a capital-flywheel lineage."
            );
        }

        CapitalFlywheelCandidateResponse candidate =
                eligibleCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .persistenceCaseId()
                                                .equals(
                                                        input.persistenceCaseId()
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Selected Step 65 case is not currently eligible for another flywheel cycle."
                                        )
                        );

        if (
                !candidate
                        .currency()
                        .equalsIgnoreCase(
                                lineage.currency()
                        )
        ) {
            throw new IllegalArgumentException(
                    "All capital-lineage cycles must use the same currency."
            );
        }

        if (
                candidate.fiscalYear()
                        < lineage.rootFiscalYear()
        ) {
            throw new IllegalArgumentException(
                    "A later flywheel cycle cannot precede the lineage root fiscal year."
            );
        }

        validateCandidateAuthority(
                currentUserId,
                candidate
        );

        repository.createCycle(
                UUID.randomUUID(),
                lineageId,
                existingCycles.size() + 1,
                candidate,
                input.relationshipRationale(),
                currentUserId
        );

        repository.markReadyForReview(
                lineageId
        );

        return lineage(
                currentUserId,
                lineageId
        );
    }

    public CapitalFlywheelLineageDetailResponse reviewLineage(
            UUID currentUserId,
            UUID lineageId,
            CapitalFlywheelReviewInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalFlywheelRepository.LineageRow lineage =
                requireLineage(
                        lineageId
                );

        if (
                lineage.status()
                        != CapitalFlywheelStatus.READY_FOR_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Capital lineage is not READY_FOR_REVIEW."
            );
        }

        List<CapitalFlywheelRepository.CycleRow> cycles =
                repository
                        .cycles(
                                lineageId
                        );

        if (cycles.isEmpty()) {
            throw new IllegalArgumentException(
                    "Capital lineage contains no immutable cycle evidence."
            );
        }

        for (
                CapitalFlywheelRepository.CycleRow cycle
                : cycles
        ) {
            validateCycleAuthority(
                    currentUserId,
                    cycle
            );
        }

        CapitalFlywheelMetricResult metric =
                metrics(
                        lineage,
                        cycles
                );

        if (
                input.decision()
                        == CapitalFlywheelReviewDecision.CONTINUE_APPROVED
                &&
                cycles.size()
                        >= lineage.maximumCycleCount()
        ) {
            throw new IllegalArgumentException(
                    "Another cycle cannot be approved because the governed maximum cycle count has been reached."
            );
        }

        if (
                input.decision()
                        == CapitalFlywheelReviewDecision.CONTINUE_APPROVED
                &&
                metric.recommendation()
                        == CapitalFlywheelRecommendation.STOP
        ) {
            throw new IllegalArgumentException(
                    "A deterministic STOP recommendation cannot be overridden with another capital cycle."
            );
        }

        boolean overrideFlag =
                input.decision()
                        == CapitalFlywheelReviewDecision.CONTINUE_APPROVED
                &&
                metric.recommendation()
                        == CapitalFlywheelRecommendation.HOLD;

        CapitalFlywheelRepository.CycleRow latest =
                cycles.get(
                        cycles.size() - 1
                );

        repository.createReview(
                UUID.randomUUID(),
                lineageId,
                latest.id(),
                metric,
                input,
                overrideFlag,
                currentUserId
        );

        if (
                input.decision()
                        == CapitalFlywheelReviewDecision.CONTINUE_APPROVED
        ) {
            repository.markApprovedForNextCycle(
                    lineageId
            );
        } else {
            repository.markStopped(
                    lineageId
            );
        }

        CapitalFlywheelLineageDetailResponse result =
                lineage(
                        currentUserId,
                        lineageId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public CapitalFlywheelLineageDetailResponse closeLineage(
            UUID currentUserId,
            UUID lineageId,
            CapitalFlywheelNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalFlywheelRepository.LineageRow lineage =
                requireLineage(
                        lineageId
                );

        if (
                lineage.status()
                        != CapitalFlywheelStatus.STOPPED
        ) {
            throw new IllegalArgumentException(
                    "Only a STOPPED capital lineage can be closed."
            );
        }

        repository.closeLineage(
                lineageId,
                input.note(),
                currentUserId
        );

        CapitalFlywheelLineageDetailResponse result =
                lineage(
                        currentUserId,
                        lineageId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public CapitalFlywheelSnapshotDetailResponse captureSnapshot(
            UUID currentUserId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return captureSnapshotInternal(
                currentUserId
        );
    }

    @Transactional(readOnly = true)
    public CapitalFlywheelSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        CapitalFlywheelRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Capital-flywheel snapshot not found: "
                            + snapshotId
            );
        }

        return new CapitalFlywheelSnapshotDetailResponse(
                snapshotSummary(
                        snapshot
                ),

                repository
                        .snapshotItems(
                                snapshotId
                        )
                        .stream()
                        .map(
                                this::snapshotItemResponse
                        )
                        .toList()
        );
    }

    private CapitalFlywheelSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId
    ) {
        List<CapitalFlywheelLineageResponse> lineages =
                repository
                        .lineages()
                        .stream()
                        .filter(
                                lineage ->
                                        lineage.status()
                                                != CapitalFlywheelStatus.CLOSED
                        )
                        .map(
                                this::lineageResponse
                        )
                        .toList();

        CapitalFlywheelSummaryResponse summary =
                summary(
                        0,
                        lineages
                );

        UUID snapshotId =
                UUID.randomUUID();

        repository.createSnapshot(
                snapshotId,
                nextSnapshotNumber(),
                summary,
                currentUserId
        );

        for (
                CapitalFlywheelLineageResponse lineage
                : lineages
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    lineage
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<CapitalFlywheelCandidateResponse> eligibleCandidates(
            UUID currentUserId
    ) {
        ReinvestmentPersistenceDashboardResponse dashboard =
                reinvestmentPersistenceService
                        .dashboard(
                                currentUserId
                        );

        return dashboard
                .cases()
                .stream()
                .filter(
                        persistence ->
                                persistence.status()
                                        == ReinvestmentPersistenceStatus.SUSTAINED
                                ||
                                persistence.status()
                                        == ReinvestmentPersistenceStatus.CLOSED
                )
                .filter(
                        ReinvestmentPersistenceCaseResponse::
                                assessed
                )
                .filter(
                        persistence ->
                                persistence.health()
                                        == ReinvestmentPersistenceHealth.COMPOUNDING
                                ||
                                persistence.health()
                                        == ReinvestmentPersistenceHealth.SUSTAINED
                )
                .filter(
                        persistence ->
                                persistence.currentProjectedNetValueAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        )
                                > 0
                )
                .filter(
                        persistence ->
                                !repository
                                        .persistenceCaseAlreadyUsed(
                                                persistence.id()
                                        )
                )
                .map(
                        this::candidateResponse
                )
                .toList();
    }

    private CapitalFlywheelCandidateResponse candidateResponse(
            ReinvestmentPersistenceCaseResponse persistence
    ) {
        return new CapitalFlywheelCandidateResponse(
                persistence.id(),
                persistence.persistenceCaseNumber(),
                persistence.status(),

                persistence.sourcePerformanceCaseId(),
                persistence.sourcePerformanceCaseNumber(),

                persistence.redeploymentCaseId(),
                persistence.redeploymentNumber(),

                persistence.recyclingSourceId(),
                persistence.recyclingSourceNumber(),

                persistence.targetValueCaseId(),
                persistence.targetValueCaseNumber(),
                persistence.targetInitiativeTitle(),

                persistence.currency(),
                persistence.fiscalYear(),

                mathService.money(
                        persistence.redeployedCapitalAmount()
                ),

                mathService.money(
                        persistence.baselineRealizedNetValueAmount()
                ),

                mathService.money(
                        persistence.currentProjectedNetValueAmount()
                ),

                mathService.money(
                        persistence.currentProjectedHorizonValueAmount()
                ),

                mathService.decimal(
                        persistence.currentProjectedRoiPct()
                ),

                mathService.percent(
                        persistence.valuePersistencePct()
                ),

                mathService.percent(
                        persistence.efficiencyRetentionPct()
                ),

                mathService.multiple(
                        persistence.currentCapitalEfficiencyMultiple()
                ),

                mathService.money(
                        persistence.compoundingValueAmount()
                ),

                mathService.money(
                        persistence.decayedValueAmount()
                ),

                persistence.health()
        );
    }

    private CapitalFlywheelLineageResponse lineageResponse(
            CapitalFlywheelRepository.LineageRow row
    ) {
        List<CapitalFlywheelRepository.CycleRow> cycles =
                repository
                        .cycles(
                                row.id()
                        );

        CapitalFlywheelMetricResult metric =
                metrics(
                        row,
                        cycles
                );

        return new CapitalFlywheelLineageResponse(
                row.id(),
                row.lineageNumber(),

                row.rootPersistenceCaseId(),
                row.rootPersistenceCaseNumber(),

                row.rootTargetValueCaseId(),
                row.rootTargetValueCaseNumber(),
                row.rootTargetInitiativeTitle(),

                mathService.money(
                        row.originalCapitalAmount()
                ),

                row.currency(),
                row.rootFiscalYear(),

                row.maximumCycleCount(),

                mathService.multiple(
                        row.minimumMarginalValueMultiple()
                ),

                mathService.percent(
                        row.minimumCycleEfficiencyRetentionPct()
                ),

                mathService.percent(
                        row.diminishingReturnTolerancePct()
                ),

                row.lineageOwnerUserId(),
                row.lineageOwnerName(),
                row.lineageObjective(),

                row.status(),

                metric.cycleCount(),

                metric.cumulativeProjectedNetValueAmount(),
                metric.cumulativeCompoundingValueAmount(),
                metric.cumulativeDecayedValueAmount(),

                metric.cumulativeValueMultiple(),
                metric.latestMarginalValueMultiple(),
                metric.latestMarginalNetValueRetentionPct(),

                metric.diminishingReturns(),

                metric.health(),
                metric.recommendation(),

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),

                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private CapitalFlywheelMetricResult metrics(
            CapitalFlywheelRepository.LineageRow lineage,
            List<CapitalFlywheelRepository.CycleRow> cycles
    ) {
        return mathService.metrics(
                lineage.originalCapitalAmount(),

                cycles.stream()
                        .map(
                                cycle ->
                                        new CapitalFlywheelCycleMetricInput(
                                                cycle.projectedNetValueAmount(),
                                                cycle.capitalEfficiencyMultiple(),
                                                cycle.valuePersistencePct(),
                                                cycle.efficiencyRetentionPct(),
                                                cycle.compoundingValueAmount(),
                                                cycle.decayedValueAmount(),
                                                cycle.projectedRoiPct(),
                                                cycle.persistenceHealth()
                                        )
                        )
                        .toList(),

                lineage.minimumMarginalValueMultiple(),
                lineage.minimumCycleEfficiencyRetentionPct(),
                lineage.diminishingReturnTolerancePct()
        );
    }

    private CapitalFlywheelCycleResponse cycleResponse(
            CapitalFlywheelRepository.CycleRow row
    ) {
        return new CapitalFlywheelCycleResponse(
                row.id(),
                row.lineageId(),
                row.cycleIndex(),

                row.persistenceCaseId(),
                row.persistenceCaseNumber(),

                row.sourcePerformanceCaseNumber(),
                row.redeploymentNumber(),
                row.recyclingSourceNumber(),

                row.targetValueCaseId(),
                row.targetValueCaseNumber(),
                row.targetInitiativeTitle(),

                row.fiscalYear(),

                mathService.money(
                        row.redeployedCapitalAmount()
                ),

                mathService.money(
                        row.baselineNetValueAmount()
                ),

                mathService.money(
                        row.projectedNetValueAmount()
                ),

                mathService.money(
                        row.projectedHorizonValueAmount()
                ),

                mathService.decimal(
                        row.projectedRoiPct()
                ),

                mathService.percent(
                        row.valuePersistencePct()
                ),

                mathService.percent(
                        row.efficiencyRetentionPct()
                ),

                mathService.multiple(
                        row.capitalEfficiencyMultiple()
                ),

                mathService.money(
                        row.compoundingValueAmount()
                ),

                mathService.money(
                        row.decayedValueAmount()
                ),

                row.persistenceHealth(),

                row.relationshipRationale(),
                row.addedByName(),
                row.addedAt()
        );
    }

    private CapitalFlywheelReviewResponse reviewResponse(
            CapitalFlywheelRepository.ReviewRow row
    ) {
        return new CapitalFlywheelReviewResponse(
                row.id(),
                row.lineageId(),
                row.latestCycleId(),

                row.cycleCount(),

                row.recommendation(),
                row.decision(),

                row.overrideFlag(),
                row.diminishingReturns(),

                mathService.money(
                        row.cumulativeProjectedNetValueAmount()
                ),

                mathService.money(
                        row.cumulativeCompoundingValueAmount()
                ),

                mathService.money(
                        row.cumulativeDecayedValueAmount()
                ),

                mathService.multiple(
                        row.cumulativeValueMultiple()
                ),

                mathService.multiple(
                        row.latestMarginalValueMultiple()
                ),

                mathService.percent(
                        row.latestMarginalNetValueRetentionPct()
                ),

                mathService.percent(
                        row.latestCycleEfficiencyRetentionPct()
                ),

                mathService.percent(
                        row.latestCycleValuePersistencePct()
                ),

                mathService.decimal(
                        row.latestCycleProjectedRoiPct()
                ),

                row.flywheelHealth(),

                row.decisionNote(),
                row.reviewedByName(),
                row.reviewedAt()
        );
    }

    private void validateCandidateAuthority(
            UUID currentUserId,
            CapitalFlywheelCandidateResponse candidate
    ) {
        ReinvestmentPersistenceCaseResponse current =
                currentPersistence(
                        currentUserId,
                        candidate.persistenceCaseId()
                );

        if (
                current.status()
                        != ReinvestmentPersistenceStatus.SUSTAINED
                &&
                current.status()
                        != ReinvestmentPersistenceStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Step 65 cycle authority is no longer sustained."
            );
        }

        if (
                current.health()
                        != ReinvestmentPersistenceHealth.SUSTAINED
                &&
                current.health()
                        != ReinvestmentPersistenceHealth.COMPOUNDING
        ) {
            throw new IllegalArgumentException(
                    "Step 65 cycle authority is no longer economically eligible for the capital flywheel."
            );
        }

        if (
                mathService.money(
                        current.currentProjectedNetValueAmount()
                )
                        .compareTo(
                                mathService.money(
                                        candidate.projectedNetValueAmount()
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Current Step 65 projected net value no longer matches the cycle candidate."
            );
        }
    }

    private void validateCycleAuthority(
            UUID currentUserId,
            CapitalFlywheelRepository.CycleRow cycle
    ) {
        ReinvestmentPersistenceCaseResponse current =
                currentPersistence(
                        currentUserId,
                        cycle.persistenceCaseId()
                );

        if (
                current.status()
                        != ReinvestmentPersistenceStatus.SUSTAINED
                &&
                current.status()
                        != ReinvestmentPersistenceStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "An existing Step 65 cycle is no longer a sustained flywheel authority."
            );
        }

        if (
                mathService.money(
                        current.currentProjectedNetValueAmount()
                )
                        .compareTo(
                                mathService.money(
                                        cycle.projectedNetValueAmount()
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 65 projected net value no longer matches the immutable flywheel-cycle snapshot."
            );
        }

        if (
                mathService.money(
                        current.redeployedCapitalAmount()
                )
                        .compareTo(
                                mathService.money(
                                        cycle.redeployedCapitalAmount()
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 65 redeployed capital no longer matches the immutable flywheel-cycle snapshot."
            );
        }
    }

    private ReinvestmentPersistenceCaseResponse currentPersistence(
            UUID currentUserId,
            UUID persistenceCaseId
    ) {
        return reinvestmentPersistenceService
                .persistenceCase(
                        currentUserId,
                        persistenceCaseId
                )
                .persistenceCase();
    }

    private CapitalFlywheelSummaryResponse summary(
            int candidateCount,
            List<CapitalFlywheelLineageResponse> lineages
    ) {
        List<CapitalFlywheelLineageResponse> active =
                lineages.stream()
                        .filter(
                                lineage ->
                                        lineage.status()
                                                != CapitalFlywheelStatus.CLOSED
                        )
                        .toList();

        return new CapitalFlywheelSummaryResponse(
                candidateCount,
                active.size(),

                countStatus(
                        active,
                        CapitalFlywheelStatus.READY_FOR_REVIEW
                ),

                countStatus(
                        active,
                        CapitalFlywheelStatus.APPROVED_FOR_NEXT_CYCLE
                ),

                countStatus(
                        active,
                        CapitalFlywheelStatus.STOPPED
                ),

                active.stream()
                        .mapToInt(
                                CapitalFlywheelLineageResponse::
                                        cycleCount
                        )
                        .sum(),

                sum(
                        active.stream()
                                .map(
                                        CapitalFlywheelLineageResponse::
                                                originalCapitalAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalFlywheelLineageResponse::
                                                cumulativeProjectedNetValueAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalFlywheelLineageResponse::
                                                cumulativeCompoundingValueAmount
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        CapitalFlywheelLineageResponse::
                                                cumulativeDecayedValueAmount
                                )
                                .toList()
                ),

                mathService.averageMultiple(
                        active.stream()
                                .map(
                                        CapitalFlywheelLineageResponse::
                                                cumulativeValueMultiple
                                )
                                .toList()
                ),

                mathService.averageMultiple(
                        active.stream()
                                .map(
                                        CapitalFlywheelLineageResponse::
                                                latestMarginalValueMultiple
                                )
                                .toList()
                ),

                (
                        int
                ) active.stream()
                        .filter(
                                CapitalFlywheelLineageResponse::
                                        diminishingReturns
                        )
                        .count()
        );
    }

    private CapitalFlywheelSnapshotSummaryResponse snapshotSummary(
            CapitalFlywheelRepository.SnapshotRow row
    ) {
        return new CapitalFlywheelSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.lineageCount(),

                row.reviewPendingLineageCount(),
                row.approvedNextCycleLineageCount(),
                row.stoppedLineageCount(),

                row.totalCycleCount(),

                mathService.money(
                        row.totalOriginalCapitalAmount()
                ),

                mathService.money(
                        row.totalCumulativeProjectedNetValueAmount()
                ),

                mathService.money(
                        row.totalCompoundingValueAmount()
                ),

                mathService.money(
                        row.totalDecayedValueAmount()
                ),

                mathService.multiple(
                        row.averageCumulativeValueMultiple()
                ),

                mathService.multiple(
                        row.averageLatestMarginalValueMultiple()
                ),

                row.diminishingReturnLineageCount(),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private CapitalFlywheelSnapshotItemResponse snapshotItemResponse(
            CapitalFlywheelRepository.SnapshotItemRow row
    ) {
        return new CapitalFlywheelSnapshotItemResponse(
                row.lineageId(),
                row.lineageNumber(),
                row.rootTargetInitiativeTitle(),
                row.currency(),

                row.lineageStatus(),

                row.cycleCount(),

                mathService.money(
                        row.originalCapitalAmount()
                ),

                mathService.money(
                        row.cumulativeProjectedNetValueAmount()
                ),

                mathService.money(
                        row.cumulativeCompoundingValueAmount()
                ),

                mathService.money(
                        row.cumulativeDecayedValueAmount()
                ),

                mathService.multiple(
                        row.cumulativeValueMultiple()
                ),

                mathService.multiple(
                        row.latestMarginalValueMultiple()
                ),

                mathService.percent(
                        row.latestMarginalNetValueRetentionPct()
                ),

                row.diminishingReturns(),

                row.flywheelHealth(),
                row.recommendation()
        );
    }

    private CapitalFlywheelRepository.LineageRow requireLineage(
            UUID lineageId
    ) {
        CapitalFlywheelRepository.LineageRow lineage =
                repository
                        .findLineage(
                                lineageId
                        );

        if (lineage == null) {
            throw new ResourceNotFoundException(
                    "Capital-flywheel lineage not found: "
                            + lineageId
            );
        }

        return lineage;
    }

    private AppUserEntity requireFlywheelUser(
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
                    "Requester accounts cannot own capital-flywheel governance."
            );
        }

        return user;
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
                                                "ProcureIQ user not found: "
                                                        + userId
                                        )
                        );

        if (!user.isActive()) {
            throw new IllegalArgumentException(
                    "ProcureIQ account is inactive."
            );
        }

        return user;
    }

    private int countStatus(
            List<CapitalFlywheelLineageResponse> lineages,
            CapitalFlywheelStatus status
    ) {
        return (
                int
        ) lineages.stream()
                .filter(
                        lineage ->
                                lineage.status()
                                        == status
                )
                .count();
    }

    private BigDecimal sum(
            List<BigDecimal> values
    ) {
        return values.stream()
                .map(
                        mathService::money
                )
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private String nextLineageNumber() {
        return String.format(
                "FLYWHEEL-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextLineageSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "FWSNAP-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextSnapshotSequence()
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
                    "Your ProcureIQ role cannot access capital-flywheel governance."
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
                    "Your ProcureIQ role cannot manage capital-flywheel planning."
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
                    "Only administrators and procurement managers can approve another recycling cycle or stop a capital lineage."
            );
        }
    }
}
