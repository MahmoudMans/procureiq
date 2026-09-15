package com.procureiq.reinvestmentperformance;

import com.procureiq.capitalredeployment.CapitalRedeploymentCaseResponse;
import com.procureiq.capitalredeployment.CapitalRedeploymentDashboardResponse;
import com.procureiq.capitalredeployment.CapitalRedeploymentService;
import com.procureiq.capitalredeployment.CapitalRedeploymentStatus;
import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.strategicvalue.StrategicValueCaseResponse;
import com.procureiq.strategicvalue.StrategicValueCaseStatus;
import com.procureiq.strategicvalue.StrategicValueHealth;
import com.procureiq.strategicvalue.StrategicValueService;
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
import java.util.UUID;

@Service
@Transactional
public class ReinvestmentPerformanceService {

    private final ReinvestmentPerformanceRepository repository;

    private final ReinvestmentPerformanceMathService mathService;

    private final CapitalRedeploymentService capitalRedeploymentService;

    private final StrategicValueService strategicValueService;

    private final AppUserRepository appUserRepository;

    public ReinvestmentPerformanceService(
            ReinvestmentPerformanceRepository repository,
            ReinvestmentPerformanceMathService mathService,
            CapitalRedeploymentService capitalRedeploymentService,
            StrategicValueService strategicValueService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.capitalRedeploymentService =
                capitalRedeploymentService;

        this.strategicValueService =
                strategicValueService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public ReinvestmentPerformanceDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<ReinvestmentPerformanceCandidateResponse> candidates =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        repository
                                                .activeCaseForRedeployment(
                                                        candidate.redeploymentCaseId()
                                                )
                                        == null
                        )
                        .toList();

        List<ReinvestmentPerformanceCaseResponse> cases =
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

        return new ReinvestmentPerformanceDashboardResponse(
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

    public ReinvestmentPerformanceCaseDetailResponse createCase(
            UUID currentUserId,
            UUID redeploymentCaseId,
            ReinvestmentPerformanceCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .activeCaseForRedeployment(
                                redeploymentCaseId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "An active reinvestment-performance case already exists for this redeployment."
            );
        }

        ReinvestmentPerformanceCandidateResponse candidate =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                source ->
                                        source
                                                .redeploymentCaseId()
                                                .equals(
                                                        redeploymentCaseId
                                                )
                        )
                        .findFirst()
                        .orElseThrow(
                                () ->
                                        new IllegalArgumentException(
                                                "Step 63 redeployment is not currently eligible for post-redeployment performance governance."
                                        )
                        );

        validateTargetAuthority(
                currentUserId,
                candidate.targetValueCaseId(),
                candidate.currency(),
                candidate.fiscalYear()
        );

        AppUserEntity owner =
                requirePerformanceUser(
                        input.performanceOwnerUserId()
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

        return performanceCase(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public ReinvestmentPerformanceCaseDetailResponse performanceCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        return new ReinvestmentPerformanceCaseDetailResponse(
                caseResponse(
                        currentUserId,
                        performanceCase
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

    public ReinvestmentPerformanceCaseDetailResponse recordObservation(
            UUID currentUserId,
            UUID caseId,
            ReinvestmentPerformanceObservationInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        requireObservationMutable(
                performanceCase
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
                    "Post-redeployment value observations cannot be recorded for a future date."
            );
        }

        validateRedeploymentAuthority(
                currentUserId,
                performanceCase
        );

        repository.createObservation(
                UUID.randomUUID(),
                caseId,
                input,
                currentUserId
        );

        return performanceCase(
                currentUserId,
                caseId
        );
    }

    public ReinvestmentPerformanceCaseDetailResponse validateObservation(
            UUID currentUserId,
            UUID observationId,
            ReinvestmentPerformanceValidationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPerformanceRepository.ObservationRow observation =
                repository
                        .findObservation(
                                observationId
                        );

        if (observation == null) {
            throw new ResourceNotFoundException(
                    "Reinvestment-performance observation not found: "
                            + observationId
            );
        }

        ReinvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        observation.performanceCaseId()
                );

        requireObservationMutable(
                performanceCase
        );

        if (
                repository
                        .validation(
                                observationId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Observation already has an immutable validation decision."
            );
        }

        if (
                input.decision()
                        == ReinvestmentPerformanceValidationDecision.VALIDATED
        ) {
            if (
                    input.validatedRealizedAnnualizedValueAmount()
                            == null
            ) {
                throw new IllegalArgumentException(
                        "Validated realized annualized value is required."
                );
            }

            if (
                    input.validatedRealizedAnnualizedValueAmount()
                            .compareTo(
                                    observation.reportedRealizedAnnualizedValueAmount()
                            )
                    > 0
            ) {
                throw new IllegalArgumentException(
                        "Validated realized annualized value cannot exceed the reported amount."
                );
            }
        } else if (
                input.validatedRealizedAnnualizedValueAmount()
                        != null
        ) {
            throw new IllegalArgumentException(
                    "Rejected observations cannot contain validated realized value."
            );
        }

        repository.createValidation(
                UUID.randomUUID(),
                observationId,
                input,
                currentUserId
        );

        return performanceCase(
                currentUserId,
                performanceCase.id()
        );
    }

    public ReinvestmentPerformanceCaseDetailResponse submitForReview(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        if (
                performanceCase.status()
                        != ReinvestmentPerformanceStatus.ACTIVE
                &&
                performanceCase.status()
                        != ReinvestmentPerformanceStatus.REMEDIATION_REQUIRED
        ) {
            throw new IllegalArgumentException(
                    "Only ACTIVE or REMEDIATION_REQUIRED performance cases can be submitted for review."
            );
        }

        if (
                repository
                        .latestValidatedObservation(
                                caseId
                        )
                == null
        ) {
            throw new IllegalArgumentException(
                    "A validated post-redeployment value observation is required before review."
            );
        }

        validateRedeploymentAuthority(
                currentUserId,
                performanceCase
        );

        repository.markReadyForReview(
                caseId
        );

        return performanceCase(
                currentUserId,
                caseId
        );
    }

    public ReinvestmentPerformanceCaseDetailResponse reviewCase(
            UUID currentUserId,
            UUID caseId,
            ReinvestmentPerformanceReviewInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        if (
                performanceCase.status()
                        != ReinvestmentPerformanceStatus.READY_FOR_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Performance case is not READY_FOR_REVIEW."
            );
        }

        ReinvestmentPerformanceRepository.AssessedObservationRow assessed =
                repository
                        .latestValidatedObservation(
                                caseId
                        );

        if (assessed == null) {
            throw new IllegalArgumentException(
                    "Performance review requires validated realized-value evidence."
            );
        }

        ReinvestmentPerformanceMetricResult metric =
                metric(
                        performanceCase,
                        assessed
                );

        if (
                input.decision()
                        == ReinvestmentPerformanceReviewDecision.CONFIRMED
                &&
                metric.health()
                        == ReinvestmentPerformanceHealth.UNDERPERFORMING
        ) {
            throw new IllegalArgumentException(
                    "An underperforming post-redeployment investment cannot be confirmed without remediation."
            );
        }

        if (
                input.decision()
                        == ReinvestmentPerformanceReviewDecision.CONFIRMED
        ) {
            validateRedeploymentAuthority(
                    currentUserId,
                    performanceCase
            );

            validateTargetAuthority(
                    currentUserId,
                    performanceCase.targetValueCaseId(),
                    performanceCase.currency(),
                    performanceCase.fiscalYear()
            );
        }

        repository.createReview(
                UUID.randomUUID(),
                caseId,
                assessed.observationId(),
                input,
                metric,
                assessed.validatedRealizedAnnualizedValueAmount(),
                performanceCase.baselineTargetRoiPct(),
                currentUserId
        );

        if (
                input.decision()
                        == ReinvestmentPerformanceReviewDecision.CONFIRMED
        ) {
            repository.markVerified(
                    caseId
            );
        } else {
            repository.markRemediationRequired(
                    caseId
            );
        }

        ReinvestmentPerformanceCaseDetailResponse result =
                performanceCase(
                        currentUserId,
                        caseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public ReinvestmentPerformanceCaseDetailResponse closeCase(
            UUID currentUserId,
            UUID caseId,
            ReinvestmentPerformanceNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        if (
                performanceCase.status()
                        != ReinvestmentPerformanceStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only a VERIFIED reinvestment-performance case can be closed."
            );
        }

        repository.closeCase(
                caseId,
                input.note(),
                currentUserId
        );

        ReinvestmentPerformanceCaseDetailResponse result =
                performanceCase(
                        currentUserId,
                        caseId
                );

        captureSnapshotInternal(
                currentUserId
        );

        return result;
    }

    public ReinvestmentPerformanceSnapshotDetailResponse captureSnapshot(
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
    public ReinvestmentPerformanceSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        ReinvestmentPerformanceRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Reinvestment-performance snapshot not found: "
                            + snapshotId
            );
        }

        return new ReinvestmentPerformanceSnapshotDetailResponse(
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

    private ReinvestmentPerformanceSnapshotDetailResponse captureSnapshotInternal(
            UUID currentUserId
    ) {
        List<ReinvestmentPerformanceCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .filter(
                                performanceCase ->
                                        performanceCase.status()
                                                != ReinvestmentPerformanceStatus.CLOSED
                        )
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        ReinvestmentPerformanceSummaryResponse summary =
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
                ReinvestmentPerformanceCaseResponse performanceCase
                : cases
        ) {
            repository.createSnapshotItem(
                    snapshotId,
                    performanceCase
            );
        }

        return snapshot(
                currentUserId,
                snapshotId
        );
    }

    private List<ReinvestmentPerformanceCandidateResponse> sourceCandidates(
            UUID currentUserId
    ) {
        CapitalRedeploymentDashboardResponse dashboard =
                capitalRedeploymentService
                        .dashboard(
                                currentUserId
                        );

        return dashboard
                .cases()
                .stream()
                .filter(
                        redeployment ->
                                redeployment.status()
                                        == CapitalRedeploymentStatus.VERIFIED
                                ||
                                redeployment.status()
                                        == CapitalRedeploymentStatus.CLOSED
                )
                .filter(
                        redeployment ->
                                redeployment.redeploymentPct()
                                        .compareTo(
                                                new BigDecimal(
                                                        "100.00"
                                                )
                                        )
                                == 0
                )
                .filter(
                        redeployment ->
                                redeployment.releasedRedeploymentAmount()
                                        .compareTo(
                                                BigDecimal.ZERO
                                        )
                                > 0
                )
                .filter(
                        redeployment ->
                                targetAuthorityEligible(
                                        currentUserId,
                                        redeployment.targetValueCaseId(),
                                        redeployment.currency(),
                                        redeployment.fiscalYear()
                                )
                )
                .map(
                        this::candidateResponse
                )
                .toList();
    }

    private ReinvestmentPerformanceCandidateResponse candidateResponse(
            CapitalRedeploymentCaseResponse redeployment
    ) {
        return new ReinvestmentPerformanceCandidateResponse(
                redeployment.id(),
                redeployment.redeploymentNumber(),
                redeployment.status(),

                redeployment.recyclingSourceId(),
                redeployment.recyclingSourceNumber(),

                redeployment.targetValueCaseId(),
                redeployment.targetValueCaseNumber(),
                redeployment.targetInitiativeNumber(),
                redeployment.targetInitiativeTitle(),

                redeployment.currency(),
                redeployment.fiscalYear(),

                mathService.money(
                        redeployment.releasedRedeploymentAmount()
                ),

                mathService.decimal(
                        redeployment.targetRoiPctSnapshot()
                ),

                mathService.decimal(
                        redeployment.targetPersistencePctSnapshot()
                ),

                mathService.money(
                        redeployment.targetNetValueSnapshot()
                ),

                redeployment.targetValueHealthSnapshot()
        );
    }

    private ReinvestmentPerformanceCaseResponse caseResponse(
            UUID currentUserId,
            ReinvestmentPerformanceRepository.CaseRow row
    ) {
        CapitalRedeploymentCaseResponse redeployment =
                currentRedeployment(
                        currentUserId,
                        row.redeploymentCaseId()
                );

        StrategicValueCaseResponse target =
                currentTarget(
                        currentUserId,
                        row.targetValueCaseId()
                );

        ReinvestmentPerformanceRepository.AssessedObservationRow assessed =
                repository
                        .latestValidatedObservation(
                                row.id()
                        );

        boolean isAssessed =
                assessed != null;

        ReinvestmentPerformanceMetricResult metric =
                isAssessed
                        ? metric(
                                row,
                                assessed
                        )
                        : mathService.metrics(
                                row.redeployedCapitalAmount(),
                                row.baselineTargetRoiPct(),
                                row.measurementHorizonMonths(),
                                row.annualOperatingCostAmount(),
                                BigDecimal.ZERO,
                                false
                        );

        BigDecimal validatedAnnualized =
                isAssessed
                        ? mathService.money(
                                assessed.validatedRealizedAnnualizedValueAmount()
                        )
                        : BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                );

        return new ReinvestmentPerformanceCaseResponse(
                row.id(),
                row.performanceCaseNumber(),

                row.redeploymentCaseId(),
                row.redeploymentNumber(),
                redeployment.status(),

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

                mathService.decimal(
                        row.baselineTargetRoiPct()
                ),

                mathService.decimal(
                        row.baselineTargetPersistencePct()
                ),

                mathService.money(
                        row.baselineTargetNetValueAmount()
                ),

                target.valueHealth(),

                row.measurementHorizonMonths(),

                mathService.money(
                        row.annualOperatingCostAmount()
                ),

                row.performanceOwnerUserId(),
                row.performanceOwnerName(),
                row.performanceObjective(),

                isAssessed,

                validatedAnnualized,

                metric.operatingCostHorizonAmount(),
                metric.totalCostAmount(),
                metric.expectedHorizonValueAmount(),
                metric.realizedHorizonValueAmount(),
                metric.realizedNetValueAmount(),
                metric.realizedRoiPct(),
                metric.roiVariancePct(),
                metric.valueVarianceAmount(),
                metric.realizationPct(),
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

    private ReinvestmentPerformanceMetricResult metric(
            ReinvestmentPerformanceRepository.CaseRow performanceCase,
            ReinvestmentPerformanceRepository.AssessedObservationRow assessed
    ) {
        return mathService
                .metrics(
                        performanceCase.redeployedCapitalAmount(),
                        performanceCase.baselineTargetRoiPct(),
                        performanceCase.measurementHorizonMonths(),
                        performanceCase.annualOperatingCostAmount(),
                        assessed.validatedRealizedAnnualizedValueAmount(),
                        true
                );
    }

    private ReinvestmentPerformanceObservationResponse observationResponse(
            ReinvestmentPerformanceRepository.ObservationRow row
    ) {
        ReinvestmentPerformanceRepository.ValidationRow validation =
                repository
                        .validation(
                                row.id()
                        );

        return new ReinvestmentPerformanceObservationResponse(
                row.id(),
                row.performanceCaseId(),
                row.observedOn(),

                mathService.money(
                        row.reportedRealizedAnnualizedValueAmount()
                ),

                row.evidenceNote(),
                row.reportedByName(),
                row.reportedAt(),

                validation == null
                        ? null
                        : validation.decision(),

                validation == null
                        ||
                        validation.validatedRealizedAnnualizedValueAmount()
                                == null
                        ? null
                        : mathService.money(
                                validation.validatedRealizedAnnualizedValueAmount()
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

    private ReinvestmentPerformanceReviewResponse reviewResponse(
            ReinvestmentPerformanceRepository.ReviewRow row
    ) {
        return new ReinvestmentPerformanceReviewResponse(
                row.id(),
                row.performanceCaseId(),
                row.observationId(),

                row.decision(),
                row.health(),

                mathService.money(
                        row.redeployedCapitalAmount()
                ),

                mathService.money(
                        row.operatingCostHorizonAmount()
                ),

                mathService.money(
                        row.totalCostAmount()
                ),

                mathService.money(
                        row.expectedHorizonValueAmount()
                ),

                mathService.money(
                        row.validatedRealizedAnnualizedValueAmount()
                ),

                mathService.money(
                        row.realizedHorizonValueAmount()
                ),

                mathService.money(
                        row.realizedNetValueAmount()
                ),

                mathService.decimal(
                        row.baselineTargetRoiPct()
                ),

                mathService.decimal(
                        row.realizedRoiPct()
                ),

                mathService.decimal(
                        row.roiVariancePct()
                ),

                mathService.money(
                        row.valueVarianceAmount()
                ),

                mathService.decimal(
                        row.realizationPct()
                ),

                row.reviewNote(),
                row.reviewedByName(),
                row.reviewedAt()
        );
    }

    private ReinvestmentPerformanceSummaryResponse summary(
            int candidateCount,
            List<ReinvestmentPerformanceCaseResponse> cases
    ) {
        List<ReinvestmentPerformanceCaseResponse> active =
                cases.stream()
                        .filter(
                                performanceCase ->
                                        performanceCase.status()
                                                != ReinvestmentPerformanceStatus.CLOSED
                        )
                        .toList();

        List<ReinvestmentPerformanceCaseResponse> assessed =
                active.stream()
                        .filter(
                                ReinvestmentPerformanceCaseResponse::
                                        assessed
                        )
                        .toList();

        return new ReinvestmentPerformanceSummaryResponse(
                candidateCount,
                active.size(),
                assessed.size(),

                countHealth(
                        assessed,
                        ReinvestmentPerformanceHealth.OUTPERFORMING
                ),

                countHealth(
                        assessed,
                        ReinvestmentPerformanceHealth.ON_TRACK
                ),

                countHealth(
                        assessed,
                        ReinvestmentPerformanceHealth.WATCH
                ),

                countHealth(
                        assessed,
                        ReinvestmentPerformanceHealth.UNDERPERFORMING
                ),

                countStatus(
                        active,
                        ReinvestmentPerformanceStatus.REMEDIATION_REQUIRED
                ),

                countStatus(
                        active,
                        ReinvestmentPerformanceStatus.VERIFIED
                ),

                mathService.average(
                        assessed.stream()
                                .map(
                                        ReinvestmentPerformanceCaseResponse::
                                                realizedRoiPct
                                )
                                .toList()
                ),

                mathService.average(
                        assessed.stream()
                                .map(
                                        ReinvestmentPerformanceCaseResponse::
                                                roiVariancePct
                                )
                                .toList()
                ),

                mathService.average(
                        assessed.stream()
                                .map(
                                        ReinvestmentPerformanceCaseResponse::
                                                realizationPct
                                )
                                .toList()
                ),

                sum(
                        active.stream()
                                .map(
                                        ReinvestmentPerformanceCaseResponse::
                                                redeployedCapitalAmount
                                )
                                .toList()
                ),

                sum(
                        assessed.stream()
                                .map(
                                        ReinvestmentPerformanceCaseResponse::
                                                realizedNetValueAmount
                                )
                                .toList()
                )
        );
    }

    private ReinvestmentPerformanceSnapshotSummaryResponse snapshotSummary(
            ReinvestmentPerformanceRepository.SnapshotRow row
    ) {
        return new ReinvestmentPerformanceSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),

                row.caseCount(),
                row.assessedCaseCount(),
                row.outperformingCaseCount(),
                row.onTrackCaseCount(),
                row.watchCaseCount(),
                row.underperformingCaseCount(),
                row.remediationCaseCount(),

                mathService.decimal(
                        row.averageRealizedRoiPct()
                ),

                mathService.decimal(
                        row.averageRoiVariancePct()
                ),

                mathService.decimal(
                        row.averageRealizationPct()
                ),

                mathService.money(
                        row.totalRedeployedCapitalAmount()
                ),

                mathService.money(
                        row.totalRealizedNetValueAmount()
                ),

                row.capturedByName(),
                row.capturedAt()
        );
    }

    private ReinvestmentPerformanceSnapshotItemResponse snapshotItemResponse(
            ReinvestmentPerformanceRepository.SnapshotItemRow row
    ) {
        return new ReinvestmentPerformanceSnapshotItemResponse(
                row.performanceCaseId(),
                row.performanceCaseNumber(),
                row.redeploymentNumber(),
                row.targetValueCaseNumber(),
                row.targetInitiativeTitle(),
                row.currency(),

                row.caseStatus(),
                row.assessed(),

                mathService.money(
                        row.redeployedCapitalAmount()
                ),

                mathService.money(
                        row.expectedHorizonValueAmount()
                ),

                mathService.money(
                        row.validatedRealizedAnnualizedValueAmount()
                ),

                mathService.money(
                        row.realizedHorizonValueAmount()
                ),

                mathService.money(
                        row.realizedNetValueAmount()
                ),

                mathService.decimal(
                        row.baselineTargetRoiPct()
                ),

                mathService.decimal(
                        row.realizedRoiPct()
                ),

                mathService.decimal(
                        row.roiVariancePct()
                ),

                mathService.money(
                        row.valueVarianceAmount()
                ),

                mathService.decimal(
                        row.realizationPct()
                ),

                row.health()
        );
    }

    private void validateRedeploymentAuthority(
            UUID currentUserId,
            ReinvestmentPerformanceRepository.CaseRow performanceCase
    ) {
        CapitalRedeploymentCaseResponse redeployment =
                currentRedeployment(
                        currentUserId,
                        performanceCase.redeploymentCaseId()
                );

        if (
                redeployment.status()
                        != CapitalRedeploymentStatus.VERIFIED
                &&
                redeployment.status()
                        != CapitalRedeploymentStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Step 63 redeployment is no longer a verified performance authority."
            );
        }

        if (
                redeployment.redeploymentPct()
                        .compareTo(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Step 63 redeployment must remain fully verified at 100%."
            );
        }

        if (
                mathService.money(
                        redeployment.releasedRedeploymentAmount()
                )
                        .compareTo(
                                mathService.money(
                                        performanceCase.redeployedCapitalAmount()
                                )
                        )
                != 0
        ) {
            throw new IllegalArgumentException(
                    "Current Step 63 released redeployment no longer matches the frozen Step 64 capital baseline."
            );
        }
    }

    private boolean targetAuthorityEligible(
            UUID currentUserId,
            UUID targetValueCaseId,
            String currency,
            int fiscalYear
    ) {
        StrategicValueCaseResponse target =
                currentTarget(
                        currentUserId,
                        targetValueCaseId
                );

        return (
                target.status()
                        == StrategicValueCaseStatus.VERIFIED
                ||
                target.status()
                        == StrategicValueCaseStatus.CLOSED
        )
                &&
                target.currency()
                        .equalsIgnoreCase(
                                currency
                        )
                &&
                target.fiscalYear()
                        == fiscalYear
                &&
                target.valueHealth()
                        != StrategicValueHealth.AT_RISK
                &&
                target.valueHealth()
                        != StrategicValueHealth.UNASSESSED;
    }

    private StrategicValueCaseResponse validateTargetAuthority(
            UUID currentUserId,
            UUID targetValueCaseId,
            String currency,
            int fiscalYear
    ) {
        StrategicValueCaseResponse target =
                currentTarget(
                        currentUserId,
                        targetValueCaseId
                );

        if (
                target.status()
                        != StrategicValueCaseStatus.VERIFIED
                &&
                target.status()
                        != StrategicValueCaseStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Post-redeployment target must remain a verified or closed Step 56 value case."
            );
        }

        if (
                !target.currency()
                        .equalsIgnoreCase(
                                currency
                        )
        ) {
            throw new IllegalArgumentException(
                    "Target value-case currency no longer matches the redeployment currency."
            );
        }

        if (
                target.fiscalYear()
                        != fiscalYear
        ) {
            throw new IllegalArgumentException(
                    "Target value-case fiscal year no longer matches the redeployment fiscal year."
            );
        }

        if (
                target.valueHealth()
                        == StrategicValueHealth.AT_RISK
                ||
                target.valueHealth()
                        == StrategicValueHealth.UNASSESSED
        ) {
            throw new IllegalArgumentException(
                    "Target value case cannot be unassessed or at risk for confirmed post-redeployment performance."
            );
        }

        return target;
    }

    private CapitalRedeploymentCaseResponse currentRedeployment(
            UUID currentUserId,
            UUID redeploymentCaseId
    ) {
        return capitalRedeploymentService
                .redeploymentCase(
                        currentUserId,
                        redeploymentCaseId
                )
                .redeploymentCase();
    }

    private StrategicValueCaseResponse currentTarget(
            UUID currentUserId,
            UUID targetValueCaseId
    ) {
        return strategicValueService
                .valueCase(
                        currentUserId,
                        targetValueCaseId
                )
                .valueCase();
    }

    private void requireObservationMutable(
            ReinvestmentPerformanceRepository.CaseRow performanceCase
    ) {
        if (
                performanceCase.status()
                        != ReinvestmentPerformanceStatus.ACTIVE
                &&
                performanceCase.status()
                        != ReinvestmentPerformanceStatus.REMEDIATION_REQUIRED
        ) {
            throw new IllegalArgumentException(
                    "Realized-value observations can be recorded only while performance is ACTIVE or REMEDIATION_REQUIRED."
            );
        }
    }

    private ReinvestmentPerformanceRepository.CaseRow requireCase(
            UUID caseId
    ) {
        ReinvestmentPerformanceRepository.CaseRow performanceCase =
                repository
                        .findCase(
                                caseId
                        );

        if (performanceCase == null) {
            throw new ResourceNotFoundException(
                    "Reinvestment-performance case not found: "
                            + caseId
            );
        }

        return performanceCase;
    }

    private AppUserEntity requirePerformanceUser(
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
                    "Requester accounts cannot own reinvestment-performance governance."
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
            List<ReinvestmentPerformanceCaseResponse> cases,
            ReinvestmentPerformanceHealth health
    ) {
        return (
                int
        ) cases.stream()
                .filter(
                        performanceCase ->
                                performanceCase.health()
                                        == health
                )
                .count();
    }

    private int countStatus(
            List<ReinvestmentPerformanceCaseResponse> cases,
            ReinvestmentPerformanceStatus status
    ) {
        return (
                int
        ) cases.stream()
                .filter(
                        performanceCase ->
                                performanceCase.status()
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
                "REINVPERF-%d-%05d",
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
                "RPSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access reinvestment-performance governance."
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
                    "Your ProcureIQ role cannot manage reinvestment-performance governance."
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
                    "Only administrators and procurement managers can validate realized value or finalize reinvestment-performance reviews."
            );
        }
    }
}
