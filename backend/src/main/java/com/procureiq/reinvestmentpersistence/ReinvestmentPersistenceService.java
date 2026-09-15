package com.procureiq.reinvestmentpersistence;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceCaseResponse;
import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceDashboardResponse;
import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceHealth;
import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceService;
import com.procureiq.reinvestmentperformance.ReinvestmentPerformanceStatus;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.ProcurementRole;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.Year;
import java.util.List;
import java.util.UUID;

@Service
@Transactional
public class ReinvestmentPersistenceService {

    private final ReinvestmentPersistenceRepository repository;

    private final ReinvestmentPersistenceMathService mathService;

    private final ReinvestmentPerformanceService reinvestmentPerformanceService;

    private final AppUserRepository appUserRepository;

    public ReinvestmentPersistenceService(
            ReinvestmentPersistenceRepository repository,
            ReinvestmentPersistenceMathService mathService,
            ReinvestmentPerformanceService reinvestmentPerformanceService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.reinvestmentPerformanceService =
                reinvestmentPerformanceService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public ReinvestmentPersistenceDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<ReinvestmentPersistenceCandidateResponse> candidates =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        repository
                                                .activeCaseForPerformance(
                                                        candidate.sourcePerformanceCaseId()
                                                )
                                        == null
                        )
                        .toList();

        List<ReinvestmentPersistenceCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        return new ReinvestmentPersistenceDashboardResponse(
                summary(
                        candidates.size(),
                        cases
                ),

                repository.users(),

                candidates,

                cases,

                repository
                        .snapshots()
                        .stream()
                        .map(
                                this::snapshotSummary
                        )
                        .toList()
        );
    }

    public ReinvestmentPersistenceCaseDetailResponse createCase(
            UUID currentUserId,
            UUID sourcePerformanceCaseId,
            ReinvestmentPersistenceCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .activeCaseForPerformance(
                                sourcePerformanceCaseId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "An active persistence case already exists for this Step 64 performance case."
            );
        }

        ReinvestmentPersistenceCandidateResponse candidate =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .sourcePerformanceCaseId()
                                                .equals(
                                                        sourcePerformanceCaseId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Step 64 performance case is not currently eligible for persistence governance."
                                        )
                        );

        AppUserEntity owner =
                requirePersistenceUser(
                        input.persistenceOwnerUserId()
                );

        UUID caseId =
                UUID.randomUUID();

        repository.createCase(
                caseId,
                nextCaseNumber(),
                candidate,
                input,
                owner.getFullName(),
                currentUserId
        );

        return persistenceCase(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public ReinvestmentPersistenceCaseDetailResponse persistenceCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPersistenceRepository.CaseRow persistenceCase =
                requireCase(
                        caseId
                );

        return new ReinvestmentPersistenceCaseDetailResponse(
                caseResponse(
                        currentUserId,
                        persistenceCase
                ),

                repository.users(),

                repository
                        .observations(
                                caseId
                        )
                        .stream()
                        .map(
                                this::observationResponse
                        )
                        .toList(),

                repository
                        .reviews(
                                caseId
                        )
                        .stream()
                        .map(
                                this::reviewResponse
                        )
                        .toList()
        );
    }

    public ReinvestmentPersistenceCaseDetailResponse recordObservation(
            UUID currentUserId,
            UUID caseId,
            ReinvestmentPersistenceObservationInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPersistenceRepository.CaseRow persistenceCase =
                requireCase(
                        caseId
                );

        requireObservationMutable(
                persistenceCase
        );

        if (
                input.observedOn()
                        .isAfter(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        )
        ) {
            throw new IllegalArgumentException(
                    "Persistence observations cannot use a future date."
            );
        }

        LocalDate caseStart =
                persistenceCase
                        .createdAt()
                        .atZone(
                                ZoneOffset.UTC
                        )
                        .toLocalDate();

        if (
                input.observedOn()
                        .isBefore(
                                caseStart
                        )
        ) {
            throw new IllegalArgumentException(
                    "Persistence observation cannot predate the persistence case."
            );
        }

        validateSourceAuthority(
                currentUserId,
                persistenceCase
        );

        repository.createObservation(
                UUID.randomUUID(),
                caseId,
                input,
                currentUserId
        );

        return persistenceCase(
                currentUserId,
                caseId
        );
    }

    public ReinvestmentPersistenceCaseDetailResponse validateObservation(
            UUID currentUserId,
            UUID observationId,
            ReinvestmentPersistenceValidationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPersistenceRepository.ObservationRow observation =
                repository
                        .findObservation(
                                observationId
                        );

        if (observation == null) {
            throw new ResourceNotFoundException(
                    "Reinvestment-persistence observation not found: "
                            + observationId
            );
        }

        ReinvestmentPersistenceRepository.CaseRow persistenceCase =
                requireCase(
                        observation.persistenceCaseId()
                );

        requireObservationMutable(
                persistenceCase
        );

        if (
                repository
                        .validation(
                                observationId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Persistence observation already has an immutable validation."
            );
        }

        if (
                input.decision()
                        == ReinvestmentPersistenceValidationDecision.VALIDATED
        ) {
            if (
                    input.validatedCurrentAnnualizedValueAmount()
                            == null
            ) {
                throw new IllegalArgumentException(
                    "Validated current annualized value is required."
                );
            }

            if (
                    input.validatedCurrentAnnualizedValueAmount()
                            .compareTo(
                                    observation.reportedCurrentAnnualizedValueAmount()
                            )
                    > 0
            ) {
                throw new IllegalArgumentException(
                    "Validated current annualized value cannot exceed the reported amount."
                );
            }
        } else if (
                input.validatedCurrentAnnualizedValueAmount()
                        != null
        ) {
            throw new IllegalArgumentException(
                    "Rejected persistence observations cannot contain validated value."
            );
        }

        repository.createValidation(
                UUID.randomUUID(),
                observationId,
                input,
                currentUserId
        );

        return persistenceCase(
                currentUserId,
                persistenceCase.id()
        );
    }

    public ReinvestmentPersistenceCaseDetailResponse submitForReview(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPersistenceRepository.CaseRow persistenceCase =
                requireCase(
                        caseId
                );

        if (
                persistenceCase.status()
                        != ReinvestmentPersistenceStatus.ACTIVE
                &&
                persistenceCase.status()
                        != ReinvestmentPersistenceStatus.REMEDIATION_REQUIRED
        ) {
            throw new IllegalArgumentException(
                    "Only ACTIVE or REMEDIATION_REQUIRED persistence cases can be submitted for review."
            );
        }

        ReinvestmentPersistenceRepository.AssessedObservationRow assessed =
                repository
                        .latestValidatedObservation(
                                caseId
                        );

        if (assessed == null) {
            throw new IllegalArgumentException(
                    "A validated persistence observation is required before review."
            );
        }

        LocalDate eligibleDate =
                persistenceCase
                        .createdAt()
                        .atZone(
                                ZoneOffset.UTC
                        )
                        .toLocalDate()
                        .plusMonths(
                                persistenceCase
                                        .persistenceObservationWindowMonths()
                        );

        if (
                assessed
                        .observedOn()
                        .isBefore(
                                eligibleDate
                        )
        ) {
            throw new IllegalArgumentException(
                    "Latest validated persistence observation does not yet satisfy the configured observation window."
            );
        }

        validateSourceAuthority(
                currentUserId,
                persistenceCase
        );

        repository.markReadyForReview(
                caseId
        );

        return persistenceCase(
                currentUserId,
                caseId
        );
    }

    public ReinvestmentPersistenceCaseDetailResponse reviewCase(
            UUID currentUserId,
            UUID caseId,
            ReinvestmentPersistenceReviewInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPersistenceRepository.CaseRow persistenceCase =
                requireCase(
                        caseId
                );

        if (
                persistenceCase.status()
                        != ReinvestmentPersistenceStatus.READY_FOR_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Persistence case is not READY_FOR_REVIEW."
            );
        }

        ReinvestmentPersistenceRepository.AssessedObservationRow assessed =
                repository
                        .latestValidatedObservation(
                                caseId
                        );

        if (assessed == null) {
            throw new IllegalArgumentException(
                    "Persistence review requires validated longitudinal evidence."
            );
        }

        ReinvestmentPersistenceMetricResult metric =
                metric(
                        persistenceCase,
                        assessed
                );

        if (
                input.decision()
                        == ReinvestmentPersistenceReviewDecision.SUSTAINED
                &&
                metric.health()
                        != ReinvestmentPersistenceHealth.SUSTAINED
                &&
                metric.health()
                        != ReinvestmentPersistenceHealth.COMPOUNDING
        ) {
            throw new IllegalArgumentException(
                    "Persistence cannot be marked sustained while deterministic health is below SUSTAINED."
            );
        }

        validateSourceAuthority(
                currentUserId,
                persistenceCase
        );

        repository.createReview(
                UUID.randomUUID(),
                caseId,
                assessed.observationId(),
                input,
                metric,
                currentUserId
        );

        if (
                input.decision()
                        == ReinvestmentPersistenceReviewDecision.SUSTAINED
        ) {
            repository.markSustained(
                    caseId
            );
        } else {
            repository.markRemediationRequired(
                    caseId
            );
        }

        ReinvestmentPersistenceCaseDetailResponse result =
                persistenceCase(
                        currentUserId,
                        caseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public ReinvestmentPersistenceCaseDetailResponse closeCase(
            UUID currentUserId,
            UUID caseId,
            ReinvestmentPersistenceNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPersistenceRepository.CaseRow persistenceCase =
                requireCase(
                        caseId
                );

        if (
                persistenceCase.status()
                        != ReinvestmentPersistenceStatus.SUSTAINED
        ) {
            throw new IllegalArgumentException(
                    "Only a SUSTAINED reinvestment-persistence case can be closed."
            );
        }

        repository.closeCase(
                caseId,
                input.note(),
                currentUserId
        );

        ReinvestmentPersistenceCaseDetailResponse result =
                persistenceCase(
                        currentUserId,
                        caseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public ReinvestmentPersistenceSnapshotDetailResponse captureSnapshot(
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
    public ReinvestmentPersistenceSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPersistenceRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Reinvestment-persistence snapshot not found: "
                            + snapshotId
            );
        }

        return new ReinvestmentPersistenceSnapshotDetailResponse(
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

    private ReinvestmentPersistenceSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId
    ) {
        List<ReinvestmentPersistenceCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .filter(
                                persistenceCase ->
                                        persistenceCase.status()
                                                != ReinvestmentPersistenceStatus.CLOSED
                        )
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        ReinvestmentPersistenceSummaryResponse summary =
                summary(
                        0,
                        cases
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
                ReinvestmentPersistenceCaseResponse persistenceCase
                : cases
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    persistenceCase
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<ReinvestmentPersistenceCandidateResponse> sourceCandidates(
            UUID currentUserId
    ) {
        ReinvestmentPerformanceDashboardResponse dashboard =
                reinvestmentPerformanceService
                        .dashboard(
                                currentUserId
                        );

        return dashboard
                .cases()
                .stream()
                .filter(
                        performance ->
                                performance.status()
                                        == ReinvestmentPerformanceStatus.VERIFIED
                                ||
                                performance.status()
                                        == ReinvestmentPerformanceStatus.CLOSED
                )
                .filter(
                        ReinvestmentPerformanceCaseResponse::
                                assessed
                )
                .filter(
                        performance ->
                                performance.validatedRealizedAnnualizedValueAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        )
                                > 0
                )
                .filter(
                        performance ->
                                performance.health()
                                        != ReinvestmentPerformanceHealth.UNASSESSED
                                &&
                                performance.health()
                                        != ReinvestmentPerformanceHealth.UNDERPERFORMING
                )
                .map(
                        this::candidateResponse
                )
                .toList();
    }

    private ReinvestmentPersistenceCandidateResponse candidateResponse(
            ReinvestmentPerformanceCaseResponse performance
    ) {
        return new ReinvestmentPersistenceCandidateResponse(
                performance.id(),
                performance.performanceCaseNumber(),
                performance.status(),

                performance.redeploymentCaseId(),
                performance.redeploymentNumber(),

                performance.recyclingSourceId(),
                performance.recyclingSourceNumber(),

                performance.targetValueCaseId(),
                performance.targetValueCaseNumber(),
                performance.targetInitiativeNumber(),
                performance.targetInitiativeTitle(),

                performance.currency(),
                performance.fiscalYear(),

                mathService.money(
                        performance.redeployedCapitalAmount()
                ),

                mathService.money(
                        performance.validatedRealizedAnnualizedValueAmount()
                ),

                mathService.money(
                        performance.realizedHorizonValueAmount()
                ),

                mathService.money(
                        performance.realizedNetValueAmount()
                ),

                mathService.money(
                        performance.totalCostAmount()
                ),

                mathService.decimal(
                        performance.realizedRoiPct()
                ),

                mathService.decimal(
                        performance.realizationPct()
                ),

                performance.health(),

                performance.measurementHorizonMonths()
        );
    }

    private ReinvestmentPersistenceCaseResponse caseResponse(
            UUID currentUserId,
            ReinvestmentPersistenceRepository.CaseRow row
    ) {
        ReinvestmentPerformanceCaseResponse source =
                currentPerformance(
                        currentUserId,
                        row.sourcePerformanceCaseId()
                );

        ReinvestmentPersistenceRepository.AssessedObservationRow assessed =
                repository
                        .latestValidatedObservation(
                                row.id()
                        );

        boolean isAssessed =
                assessed != null;

        ReinvestmentPersistenceMetricResult metric =
                isAssessed
                        ? metric(
                                row,
                                assessed
                        )
                        : mathService.metrics(
                                row.redeployedCapitalAmount(),
                                row.baselineValidatedAnnualizedValueAmount(),
                                row.baselineRealizedHorizonValueAmount(),
                                row.baselineRealizedNetValueAmount(),
                                row.baselineTotalCostAmount(),
                                row.baselineRealizedRoiPct(),
                                row.measurementHorizonMonths(),
                                BigDecimal.ZERO,
                                row.minimumValuePersistencePct(),
                                row.minimumEfficiencyRetentionPct(),
                                false
                        );

        BigDecimal currentAnnual =
                isAssessed
                        ? mathService.money(
                                assessed.validatedCurrentAnnualizedValueAmount()
                        )
                        : BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new ReinvestmentPersistenceCaseResponse(
                row.id(),
                row.persistenceCaseNumber(),

                row.sourcePerformanceCaseId(),
                row.sourcePerformanceCaseNumber(),
                source.status(),

                row.redeploymentCaseId(),
                row.redeploymentNumber(),

                row.recyclingSourceId(),
                row.recyclingSourceNumber(),

                row.targetValueCaseId(),
                row.targetValueCaseNumber(),
                row.targetInitiativeNumber(),
                row.targetInitiativeTitle(),

                row.currency(),
                row.fiscalYear(),

                mathService.money(
                        row.redeployedCapitalAmount()
                ),

                mathService.money(
                        row.baselineValidatedAnnualizedValueAmount()
                ),

                mathService.money(
                        row.baselineRealizedHorizonValueAmount()
                ),

                mathService.money(
                        row.baselineRealizedNetValueAmount()
                ),

                mathService.money(
                        row.baselineTotalCostAmount()
                ),

                mathService.decimal(
                        row.baselineRealizedRoiPct()
                ),

                mathService.decimal(
                        row.baselineRealizationPct()
                ),

                row.baselinePerformanceHealth(),
                source.health(),

                row.measurementHorizonMonths(),
                row.persistenceObservationWindowMonths(),

                mathService.decimal(
                        row.minimumValuePersistencePct()
                ),

                mathService.decimal(
                        row.minimumEfficiencyRetentionPct()
                ),

                row.persistenceOwnerUserId(),
                row.persistenceOwnerName(),
                row.persistenceObjective(),

                isAssessed,

                currentAnnual,

                metric.currentProjectedHorizonValueAmount(),
                metric.currentProjectedNetValueAmount(),
                metric.currentProjectedRoiPct(),
                metric.roiVariancePct(),

                metric.valuePersistencePct(),
                metric.compoundingValueAmount(),
                metric.decayedValueAmount(),

                metric.baselineCapitalEfficiencyMultiple(),
                metric.currentCapitalEfficiencyMultiple(),
                metric.capitalEfficiencyDelta(),
                metric.efficiencyRetentionPct(),

                metric.health(),
                row.status(),

                repository
                        .observations(
                                row.id()
                        )
                        .size(),

                repository
                        .reviews(
                                row.id()
                        )
                        .size(),

                row.closeNote(),
                row.closedByName(),
                row.closedAt(),

                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private ReinvestmentPersistenceMetricResult metric(
            ReinvestmentPersistenceRepository.CaseRow persistenceCase,
            ReinvestmentPersistenceRepository.AssessedObservationRow assessed
    ) {
        return mathService
                .metrics(
                        persistenceCase.redeployedCapitalAmount(),

                        persistenceCase.baselineValidatedAnnualizedValueAmount(),
                        persistenceCase.baselineRealizedHorizonValueAmount(),
                        persistenceCase.baselineRealizedNetValueAmount(),
                        persistenceCase.baselineTotalCostAmount(),

                        persistenceCase.baselineRealizedRoiPct(),

                        persistenceCase.measurementHorizonMonths(),

                        assessed.validatedCurrentAnnualizedValueAmount(),

                        persistenceCase.minimumValuePersistencePct(),
                        persistenceCase.minimumEfficiencyRetentionPct(),

                        true
                );
    }

    private ReinvestmentPersistenceObservationResponse observationResponse(
            ReinvestmentPersistenceRepository.ObservationRow row
    ) {
        ReinvestmentPersistenceRepository.ValidationRow validation =
                repository
                        .validation(
                                row.id()
                        );

        return new ReinvestmentPersistenceObservationResponse(
                row.id(),
                row.persistenceCaseId(),
                row.observedOn(),

                mathService.money(
                        row.reportedCurrentAnnualizedValueAmount()
                ),

                row.evidenceNote(),
                row.reportedByName(),
                row.reportedAt(),

                validation == null
                        ? null
                        : validation.decision(),

                validation == null
                        ||
                        validation.validatedCurrentAnnualizedValueAmount()
                                == null
                        ? null
                        : mathService.money(
                                validation.validatedCurrentAnnualizedValueAmount()
                        ),

                validation == null
                        ? null
                        : validation.validationNote(),

                validation == null
                        ? null
                        : validation.validatedByName(),

                validation == null
                        ? null
                        : validation.validatedAt()
        );
    }

    private ReinvestmentPersistenceReviewResponse reviewResponse(
            ReinvestmentPersistenceRepository.ReviewRow row
    ) {
        return new ReinvestmentPersistenceReviewResponse(
                row.id(),
                row.persistenceCaseId(),
                row.observationId(),

                row.decision(),
                row.health(),

                mathService.money(
                        row.baselineAnnualizedValueAmount()
                ),

                mathService.money(
                        row.currentAnnualizedValueAmount()
                ),

                mathService.money(
                        row.baselineHorizonValueAmount()
                ),

                mathService.money(
                        row.currentProjectedHorizonValueAmount()
                ),

                mathService.money(
                        row.baselineNetValueAmount()
                ),

                mathService.money(
                        row.currentProjectedNetValueAmount()
                ),

                mathService.decimal(
                        row.baselineRoiPct()
                ),

                mathService.decimal(
                        row.currentProjectedRoiPct()
                ),

                mathService.decimal(
                        row.roiVariancePct()
                ),

                mathService.decimal(
                        row.valuePersistencePct()
                ),

                mathService.money(
                        row.compoundingValueAmount()
                ),

                mathService.money(
                        row.decayedValueAmount()
                ),

                row.baselineCapitalEfficiencyMultiple(),
                row.currentCapitalEfficiencyMultiple(),
                row.capitalEfficiencyDelta(),

                mathService.decimal(
                        row.efficiencyRetentionPct()
                ),

                row.reviewNote(),
                row.reviewedByName(),
                row.reviewedAt()
        );
    }

    private ReinvestmentPersistenceSummaryResponse summary(
            int candidateCount,
            List<ReinvestmentPersistenceCaseResponse> cases
    ) {
        List<ReinvestmentPersistenceCaseResponse> active =
                cases.stream()
                        .filter(
                                persistenceCase ->
                                        persistenceCase.status()
                                                != ReinvestmentPersistenceStatus.CLOSED
                        )
                        .toList();

        List<ReinvestmentPersistenceCaseResponse> assessed =
                active.stream()
                        .filter(
                                ReinvestmentPersistenceCaseResponse::
                                        assessed
                        )
                        .toList();

        return new ReinvestmentPersistenceSummaryResponse(
                candidateCount,
                active.size(),
                assessed.size(),

                countHealth(
                        assessed,
                        ReinvestmentPersistenceHealth.COMPOUNDING
                ),

                countHealth(
                        assessed,
                        ReinvestmentPersistenceHealth.SUSTAINED
                ),

                countHealth(
                        assessed,
                        ReinvestmentPersistenceHealth.WATCH
                ),

                countHealth(
                        assessed,
                        ReinvestmentPersistenceHealth.DECAYING
                ),

                countHealth(
                        assessed,
                        ReinvestmentPersistenceHealth.REGRESSED
                ),

                countStatus(
                        active,
                        ReinvestmentPersistenceStatus.REMEDIATION_REQUIRED
                ),

                mathService.average(
                        assessed.stream()
                                .map(
                                        ReinvestmentPersistenceCaseResponse::
                                                valuePersistencePct
                                )
                                .toList()
                ),

                mathService.average(
                        assessed.stream()
                                .map(
                                        ReinvestmentPersistenceCaseResponse::
                                                efficiencyRetentionPct
                                )
                                .toList()
                ),

                mathService.average(
                        assessed.stream()
                                .map(
                                        ReinvestmentPersistenceCaseResponse::
                                                currentProjectedRoiPct
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        ReinvestmentPersistenceCaseResponse::
                                                baselineRealizedNetValueAmount
                                )
                                .toList()
                ),

                sum(
                        assessed.stream()
                                .map(
                                        ReinvestmentPersistenceCaseResponse::
                                                currentProjectedNetValueAmount
                                )
                                .toList()
                ),

                sum(
                        assessed.stream()
                                .map(
                                        ReinvestmentPersistenceCaseResponse::
                                                compoundingValueAmount
                                )
                                .toList()
                ),

                sum(
                        assessed.stream()
                                .map(
                                        ReinvestmentPersistenceCaseResponse::
                                                decayedValueAmount
                                )
                                .toList()
                )
        );
    }

    private ReinvestmentPersistenceSnapshotSummaryResponse snapshotSummary(
            ReinvestmentPersistenceRepository.SnapshotRow row
    ) {
        return new ReinvestmentPersistenceSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.caseCount(),
                row.assessedCaseCount(),

                row.compoundingCaseCount(),
                row.sustainedCaseCount(),
                row.watchCaseCount(),
                row.decayingCaseCount(),
                row.regressedCaseCount(),
                row.remediationCaseCount(),

                mathService.decimal(
                        row.averageValuePersistencePct()
                ),

                mathService.decimal(
                        row.averageEfficiencyRetentionPct()
                ),

                mathService.decimal(
                        row.averageProjectedRoiPct()
                ),

                mathService.money(
                        row.totalBaselineRealizedNetValueAmount()
                ),

                mathService.money(
                        row.totalCurrentProjectedNetValueAmount()
                ),

                mathService.money(
                        row.totalCompoundingValueAmount()
                ),

                mathService.money(
                        row.totalDecayedValueAmount()
                ),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private ReinvestmentPersistenceSnapshotItemResponse snapshotItemResponse(
            ReinvestmentPersistenceRepository.SnapshotItemRow row
    ) {
        return new ReinvestmentPersistenceSnapshotItemResponse(
                row.persistenceCaseId(),
                row.persistenceCaseNumber(),
                row.sourcePerformanceCaseNumber(),
                row.redeploymentNumber(),
                row.targetValueCaseNumber(),
                row.targetInitiativeTitle(),
                row.currency(),

                row.caseStatus(),
                row.assessed(),

                mathService.money(
                        row.baselineAnnualizedValueAmount()
                ),

                mathService.money(
                        row.currentAnnualizedValueAmount()
                ),

                mathService.money(
                        row.baselineHorizonValueAmount()
                ),

                mathService.money(
                        row.currentProjectedHorizonValueAmount()
                ),

                mathService.money(
                        row.baselineNetValueAmount()
                ),

                mathService.money(
                        row.currentProjectedNetValueAmount()
                ),

                mathService.decimal(
                        row.baselineRoiPct()
                ),

                mathService.decimal(
                        row.currentProjectedRoiPct()
                ),

                mathService.decimal(
                        row.roiVariancePct()
                ),

                mathService.decimal(
                        row.valuePersistencePct()
                ),

                mathService.decimal(
                        row.efficiencyRetentionPct()
                ),

                mathService.money(
                        row.compoundingValueAmount()
                ),

                mathService.money(
                        row.decayedValueAmount()
                ),

                row.health()
        );
    }

    private void validateSourceAuthority(
            UUID currentUserId,
            ReinvestmentPersistenceRepository.CaseRow persistenceCase
    ) {
        ReinvestmentPerformanceCaseResponse source =
                currentPerformance(
                        currentUserId,
                        persistenceCase.sourcePerformanceCaseId()
                );

        if (
                source.status()
                        != ReinvestmentPerformanceStatus.VERIFIED
                &&
                source.status()
                        != ReinvestmentPerformanceStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Step 64 performance is no longer a verified persistence authority."
            );
        }

        if (!source.assessed()) {
            throw new IllegalArgumentException(
                    "Step 64 performance source is no longer assessed."
            );
        }

        if (
                mathService.money(
                        source.validatedRealizedAnnualizedValueAmount()
                )
                        .compareTo(
                                mathService.money(
                                        persistenceCase.baselineValidatedAnnualizedValueAmount()
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Current Step 64 validated annualized value no longer matches the frozen persistence baseline."
            );
        }

        if (
                mathService.money(
                        source.realizedHorizonValueAmount()
                )
                        .compareTo(
                                mathService.money(
                                        persistenceCase.baselineRealizedHorizonValueAmount()
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Current Step 64 realized horizon value no longer matches the frozen persistence baseline."
            );
        }

        if (
                mathService.money(
                        source.redeployedCapitalAmount()
                )
                        .compareTo(
                                mathService.money(
                                        persistenceCase.redeployedCapitalAmount()
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Current Step 64 redeployed capital no longer matches the frozen recycling-effectiveness baseline."
            );
        }
    }

    private ReinvestmentPerformanceCaseResponse currentPerformance(
            UUID currentUserId,
            UUID sourcePerformanceCaseId
    ) {
        return reinvestmentPerformanceService
                .performanceCase(
                        currentUserId,
                        sourcePerformanceCaseId
                )
                .performanceCase();
    }

    private void requireObservationMutable(
            ReinvestmentPersistenceRepository.CaseRow persistenceCase
    ) {
        if (
                persistenceCase.status()
                        != ReinvestmentPersistenceStatus.ACTIVE
                &&
                persistenceCase.status()
                        != ReinvestmentPersistenceStatus.REMEDIATION_REQUIRED
        ) {
            throw new IllegalArgumentException(
                    "Persistence observations can be recorded only while the case is ACTIVE or REMEDIATION_REQUIRED."
            );
        }
    }

    private ReinvestmentPersistenceRepository.CaseRow requireCase(
            UUID caseId
    ) {
        ReinvestmentPersistenceRepository.CaseRow persistenceCase =
                repository
                        .findCase(
                                caseId
                        );

        if (persistenceCase == null) {
            throw new ResourceNotFoundException(
                    "Reinvestment-persistence case not found: "
                            + caseId
            );
        }

        return persistenceCase;
    }

    private AppUserEntity requirePersistenceUser(
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
                    "Requester accounts cannot own reinvestment-persistence governance."
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

    private int countHealth(
            List<ReinvestmentPersistenceCaseResponse> cases,
            ReinvestmentPersistenceHealth health
    ) {
        return (
                int
        ) cases.stream()
                .filter(
                        persistenceCase ->
                                persistenceCase.health()
                                        == health
                )
                .count();
    }

    private int countStatus(
            List<ReinvestmentPersistenceCaseResponse> cases,
            ReinvestmentPersistenceStatus status
    ) {
        return (
                int
        ) cases.stream()
                .filter(
                        persistenceCase ->
                                persistenceCase.status()
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

    private String nextCaseNumber() {
        return String.format(
                "REINVPERSIST-%d-%05d",
                Year.now(
                        ZoneOffset.UTC
                )
                        .getValue(),
                repository
                        .nextCaseSequence()
        );
    }

    private String nextSnapshotNumber() {
        return String.format(
                "RPSUST-%d-%05d",
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
                    "Your ProcureIQ role cannot access reinvestment-persistence governance."
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
                    "Your ProcureIQ role cannot manage reinvestment-persistence governance."
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
                    "Only administrators and procurement managers can validate or finalize reinvestment persistence."
            );
        }
    }
}
