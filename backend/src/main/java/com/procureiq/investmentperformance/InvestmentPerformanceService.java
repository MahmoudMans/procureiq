package com.procureiq.investmentperformance;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.fundingexecution.FundingCommitmentResponse;
import com.procureiq.fundingexecution.FundingCommitmentStatus;
import com.procureiq.fundingexecution.FundingExecutionDashboardResponse;
import com.procureiq.fundingexecution.FundingExecutionService;
import com.procureiq.strategicvalue.StrategicValueCaseResponse;
import com.procureiq.strategicvalue.StrategicValueCaseStatus;
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
public class InvestmentPerformanceService {

    private final InvestmentPerformanceRepository repository;

    private final InvestmentPerformanceMathService mathService;

    private final FundingExecutionService fundingExecutionService;

    private final StrategicValueService strategicValueService;

    private final AppUserRepository appUserRepository;

    public InvestmentPerformanceService(
            InvestmentPerformanceRepository repository,
            InvestmentPerformanceMathService mathService,
            FundingExecutionService fundingExecutionService,
            StrategicValueService strategicValueService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.mathService =
                mathService;

        this.fundingExecutionService =
                fundingExecutionService;

        this.strategicValueService =
                strategicValueService;

        this.appUserRepository =
                appUserRepository;
    }

    @Transactional(readOnly = true)
    public InvestmentPerformanceDashboardResponse dashboard(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<InvestmentPerformanceCandidateResponse> candidates =
                sourceCandidates(
                        currentUserId
                )
                        .stream()
                        .filter(
                                candidate ->
                                        repository
                                                .activeCaseForFundingCommitment(
                                                        candidate.fundingCommitmentId()
                                                )
                                        == null
                        )
                        .toList();

        List<InvestmentPerformanceCaseResponse> cases =
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

        return new InvestmentPerformanceDashboardResponse(
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

    public InvestmentPerformanceCaseDetailResponse createCase(
            UUID currentUserId,
            UUID fundingCommitmentId,
            InvestmentPerformanceCaseInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .activeCaseForFundingCommitment(
                                fundingCommitmentId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "An active investment-performance case already exists for this funding commitment."
            );
        }

        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        fundingCommitmentId
                );

        if (
                !eligibleFundingCommitment(
                        funding
                )
        ) {
            throw new IllegalArgumentException(
                    "Investment performance requires a Step 58 commitment with released capital."
            );
        }

        StrategicValueCaseResponse valueCase =
                currentValueCase(
                        currentUserId,
                        funding.valueCaseId()
                );

        if (
                valueCase.status()
                        != StrategicValueCaseStatus.VERIFIED
                &&
                valueCase.status()
                        != StrategicValueCaseStatus.CLOSED
        ) {
            throw new IllegalArgumentException(
                    "Investment performance requires a verified or closed Step 56 value case."
            );
        }

        AppUserEntity owner =
                requirePerformanceUser(
                        input.performanceOwnerUserId()
                );

        UUID caseId =
                UUID.randomUUID();

        repository.createCase(
                caseId,
                nextCaseNumber(),
                funding.id(),
                funding.commitmentNumber(),
                funding.allocationCycleNumber(),
                valueCase.id(),
                valueCase.caseNumber(),
                funding.initiativeNumber(),
                funding.initiativeTitle(),
                funding.currency(),
                funding.fiscalYear(),
                input,
                owner.getFullName(),
                valueCase.investmentCostAmount(),
                valueCase.annualOperatingCostAmount(),
                valueCase.annualizedValueAmount(),
                valueCase.durableAnnualValueAmount(),
                valueCase.durableHorizonValueAmount(),
                valueCase.roiPct(),
                valueCase.targetRoiPct(),
                valueCase.targetPaybackMonths(),
                valueCase.valueHorizonMonths(),
                currentUserId
        );

        return performanceCase(
                currentUserId,
                caseId
        );
    }

    @Transactional(readOnly = true)
    public InvestmentPerformanceCaseDetailResponse performanceCase(
            UUID currentUserId,
            UUID caseId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        return new InvestmentPerformanceCaseDetailResponse(
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
                        .decisions(
                                caseId
                        )
                        .stream()
                        .map(
                                this::decisionResponse
                        )
                        .toList()
        );
    }

    public InvestmentPerformanceCaseDetailResponse recordObservation(
            UUID currentUserId,
            UUID caseId,
            InvestmentPerformanceObservationInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentPerformanceRepository.CaseRow performanceCase =
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
                    "Investment-performance observations cannot be recorded for a future date."
            );
        }

        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        performanceCase.fundingCommitmentId()
                );

        if (
                funding.releasedAmount()
                        .compareTo(
                                BigDecimal.ZERO
                        )
                <= 0
        ) {
            throw new IllegalArgumentException(
                    "Investment-performance observation requires actual released capital."
            );
        }

        repository.createObservation(
                UUID.randomUUID(),
                caseId,
                input,
                funding.releasedAmount(),
                funding.releasePct(),
                currentUserId
        );

        return performanceCase(
                currentUserId,
                caseId
        );
    }

    public InvestmentPerformanceCaseDetailResponse validateObservation(
            UUID currentUserId,
            UUID observationId,
            InvestmentPerformanceValidationInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentPerformanceRepository.ObservationRow observation =
                repository
                        .findObservation(
                                observationId
                        );

        if (observation == null) {
            throw new ResourceNotFoundException(
                    "Investment-performance observation not found: "
                            + observationId
            );
        }

        InvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        observation.performanceCaseId()
                );

        requireObservationMutable(
                performanceCase
        );

        if (
                repository
                        .findValidation(
                                observationId
                        )
                != null
        ) {
            throw new IllegalArgumentException(
                    "Investment-performance observation already has an immutable validation decision."
            );
        }

        if (
                input.decision()
                        == InvestmentPerformanceValidationDecision.VALIDATED
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
                    "Rejected performance observations cannot contain validated realized value."
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

    public InvestmentPerformanceCaseDetailResponse submitForReview(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        if (
                performanceCase.status()
                        != InvestmentPerformanceCaseStatus.ACTIVE
                &&
                performanceCase.status()
                        != InvestmentPerformanceCaseStatus.IN_REMEDIATION
        ) {
            throw new IllegalArgumentException(
                    "Only active or remediation investment-performance cases can be submitted for review."
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
                    "A validated realized-value observation is required before investment-performance review."
            );
        }

        repository.markReadyForReview(
                caseId
        );

        return performanceCase(
                currentUserId,
                caseId
        );
    }

    public InvestmentPerformanceCaseDetailResponse reviewCase(
            UUID currentUserId,
            UUID caseId,
            InvestmentPerformanceReviewInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        if (
                performanceCase.status()
                        != InvestmentPerformanceCaseStatus.READY_FOR_REVIEW
        ) {
            throw new IllegalArgumentException(
                    "Investment-performance case is not ready for review."
            );
        }

        InvestmentPerformanceRepository.AssessedObservationRow assessed =
                repository
                        .latestValidatedObservation(
                                caseId
                        );

        if (assessed == null) {
            throw new IllegalArgumentException(
                    "Investment-performance review requires validated realized-value evidence."
            );
        }

        InvestmentPerformanceMetricResult metric =
                metric(
                        performanceCase,
                        assessed
                );

        if (
                input.decision()
                        == InvestmentPerformanceReviewDecision.CONFIRMED
                &&
                metric.health()
                        == InvestmentPerformanceHealth.UNDERPERFORMING
        ) {
            throw new IllegalArgumentException(
                    "An underperforming investment cannot be confirmed without remediation."
            );
        }

        repository.createDecision(
                UUID.randomUUID(),
                caseId,
                assessed.observationId(),
                input,
                metric,
                assessed.validatedRealizedAnnualizedValueAmount(),
                performanceCase.baselineRoiPct(),
                currentUserId
        );

        if (
                input.decision()
                        == InvestmentPerformanceReviewDecision.CONFIRMED
        ) {
            repository.markVerified(
                    caseId
            );
        } else {
            repository.markRemediation(
                    caseId
            );
        }

        return performanceCase(
                currentUserId,
                caseId
        );
    }

    public InvestmentPerformanceCaseDetailResponse closeCase(
            UUID currentUserId,
            UUID caseId,
            InvestmentPerformanceNoteInput input
    ) {
        assertFinalizeRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentPerformanceRepository.CaseRow performanceCase =
                requireCase(
                        caseId
                );

        if (
                performanceCase.status()
                        != InvestmentPerformanceCaseStatus.VERIFIED
        ) {
            throw new IllegalArgumentException(
                    "Only a verified investment-performance case can be closed."
            );
        }

        repository.closeCase(
                caseId,
                input.note(),
                currentUserId
        );

        return performanceCase(
                currentUserId,
                caseId
        );
    }

    public InvestmentPerformanceSnapshotDetailResponse captureSnapshot(
            UUID currentUserId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        List<InvestmentPerformanceCaseResponse> cases =
                repository
                        .cases()
                        .stream()
                        .filter(
                                performanceCase ->
                                        performanceCase.status()
                                                != InvestmentPerformanceCaseStatus.CLOSED
                        )
                        .map(
                                row ->
                                        caseResponse(
                                                currentUserId,
                                                row
                                        )
                        )
                        .toList();

        InvestmentPerformanceSummaryResponse summary =
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
                InvestmentPerformanceCaseResponse performanceCase
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

    @Transactional(readOnly = true)
    public InvestmentPerformanceSnapshotDetailResponse snapshot(
            UUID currentUserId,
            UUID snapshotId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        InvestmentPerformanceRepository.SnapshotRow snapshot =
                repository
                        .findSnapshot(
                                snapshotId
                        );

        if (snapshot == null) {
            throw new ResourceNotFoundException(
                    "Investment-performance snapshot not found: "
                            + snapshotId
            );
        }

        return new InvestmentPerformanceSnapshotDetailResponse(
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

    private List<InvestmentPerformanceCandidateResponse> sourceCandidates(
            UUID currentUserId
    ) {
        FundingExecutionDashboardResponse fundingDashboard =
                fundingExecutionService
                        .dashboard(
                                currentUserId
                        );

        return fundingDashboard
                .commitments()
                .stream()
                .filter(
                        this::eligibleFundingCommitment
                )
                .map(
                        funding ->
                                candidateResponse(
                                        currentUserId,
                                        funding
                                )
                )
                .toList();
    }

    private InvestmentPerformanceCandidateResponse candidateResponse(
            UUID currentUserId,
            FundingCommitmentResponse funding
    ) {
        StrategicValueCaseResponse valueCase =
                currentValueCase(
                        currentUserId,
                        funding.valueCaseId()
                );

        return new InvestmentPerformanceCandidateResponse(
                funding.id(),
                funding.commitmentNumber(),
                funding.status(),
                funding.allocationCycleId(),
                funding.allocationCycleNumber(),
                valueCase.id(),
                valueCase.caseNumber(),
                funding.initiativeNumber(),
                funding.initiativeTitle(),
                funding.currency(),
                funding.fiscalYear(),
                mathService.money(
                        funding.releasedAmount()
                ),
                mathService.money(
                        funding.committedCapitalAmount()
                ),
                mathService.decimal(
                        funding.releasePct()
                ),
                mathService.money(
                        valueCase.investmentCostAmount()
                ),
                mathService.money(
                        valueCase.durableHorizonValueAmount()
                ),
                mathService.decimal(
                        valueCase.roiPct()
                ),
                mathService.decimal(
                        valueCase.targetRoiPct()
                )
        );
    }

    private InvestmentPerformanceCaseResponse caseResponse(
            UUID currentUserId,
            InvestmentPerformanceRepository.CaseRow row
    ) {
        FundingCommitmentResponse funding =
                currentFundingCommitment(
                        currentUserId,
                        row.fundingCommitmentId()
                );

        InvestmentPerformanceRepository.AssessedObservationRow assessed =
                repository
                        .latestValidatedObservation(
                                row.id()
                        );

        boolean isAssessed =
                assessed != null;

        InvestmentPerformanceMetricResult metric =
                isAssessed
                        ? metric(
                                row,
                                assessed
                        )
                        : mathService.metrics(
                                row.baselineInvestmentCostAmount(),
                                row.baselineAnnualOperatingCostAmount(),
                                row.baselineDurableHorizonValueAmount(),
                                row.baselineRoiPct(),
                                row.valueHorizonMonths(),
                                funding.releasedAmount(),
                                BigDecimal.ZERO,
                                false
                        );

        BigDecimal validatedValue =
                isAssessed
                        ? mathService.money(
                                assessed
                                        .validatedRealizedAnnualizedValueAmount()
                        )
                        : BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal assessedReleased =
                isAssessed
                        ? mathService.money(
                                assessed
                                        .releasedCapitalSnapshot()
                        )
                        : mathService.money(
                                funding.releasedAmount()
                        );

        return new InvestmentPerformanceCaseResponse(
                row.id(),
                row.performanceCaseNumber(),

                row.fundingCommitmentId(),
                row.fundingCommitmentNumber(),
                funding.status(),
                funding.allocationCycleId(),
                row.allocationCycleNumber(),

                row.valueCaseId(),
                row.valueCaseNumber(),

                row.initiativeNumber(),
                row.initiativeTitle(),
                row.currency(),
                row.fiscalYear(),

                row.performanceOwnerUserId(),
                row.performanceOwnerName(),
                row.performanceObjective(),

                mathService.money(
                        row.baselineInvestmentCostAmount()
                ),
                mathService.money(
                        row.baselineAnnualOperatingCostAmount()
                ),
                mathService.money(
                        row.baselineAnnualizedValueAmount()
                ),
                mathService.money(
                        row.baselineDurableAnnualValueAmount()
                ),
                mathService.money(
                        row.baselineDurableHorizonValueAmount()
                ),
                mathService.decimal(
                        row.baselineRoiPct()
                ),
                mathService.decimal(
                        row.baselineTargetRoiPct()
                ),
                mathService.decimal(
                        row.baselineTargetPaybackMonths()
                ),
                row.valueHorizonMonths(),

                mathService.money(
                        funding.releasedAmount()
                ),
                mathService.decimal(
                        funding.releasePct()
                ),

                isAssessed,
                assessedReleased,
                validatedValue,
                metric.realizedHorizonValueAmount(),
                metric.realizedOperatingCostHorizonAmount(),
                metric.realizedTotalCostAmount(),
                metric.realizedNetValueAmount(),
                metric.realizedRoiPct(),
                metric.roiVariancePct(),
                metric.fundingVarianceAmount(),
                metric.fundingVariancePct(),
                metric.capitalEfficiencyMultiple(),
                metric.valueVarianceAmount(),
                metric.health(),

                row.status(),
                repository
                        .observations(
                                row.id()
                        )
                        .size(),
                repository
                        .decisions(
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

    private InvestmentPerformanceMetricResult metric(
            InvestmentPerformanceRepository.CaseRow performanceCase,
            InvestmentPerformanceRepository.AssessedObservationRow assessed
    ) {
        return mathService.metrics(
                performanceCase.baselineInvestmentCostAmount(),
                performanceCase.baselineAnnualOperatingCostAmount(),
                performanceCase.baselineDurableHorizonValueAmount(),
                performanceCase.baselineRoiPct(),
                performanceCase.valueHorizonMonths(),
                assessed.releasedCapitalSnapshot(),
                assessed.validatedRealizedAnnualizedValueAmount(),
                true
        );
    }

    private InvestmentPerformanceObservationResponse observationResponse(
            InvestmentPerformanceRepository.ObservationRow row
    ) {
        InvestmentPerformanceRepository.ValidationRow validation =
                repository
                        .findValidation(
                                row.id()
                        );

        return new InvestmentPerformanceObservationResponse(
                row.id(),
                row.performanceCaseId(),
                row.observedOn(),
                mathService.money(
                        row.releasedCapitalSnapshot()
                ),
                mathService.decimal(
                        row.releasePctSnapshot()
                ),
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
                        validation
                                .validatedRealizedAnnualizedValueAmount()
                                == null
                        ? null
                        : mathService.money(
                                validation
                                        .validatedRealizedAnnualizedValueAmount()
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

    private InvestmentPerformanceDecisionResponse decisionResponse(
            InvestmentPerformanceRepository.DecisionRow row
    ) {
        return new InvestmentPerformanceDecisionResponse(
                row.id(),
                row.performanceCaseId(),
                row.observationId(),
                row.decision(),
                row.health(),
                mathService.money(
                        row.releasedCapitalAmount()
                ),
                mathService.money(
                        row.validatedRealizedAnnualizedValueAmount()
                ),
                mathService.money(
                        row.realizedHorizonValueAmount()
                ),
                mathService.money(
                        row.realizedTotalCostAmount()
                ),
                mathService.money(
                        row.realizedNetValueAmount()
                ),
                mathService.decimal(
                        row.realizedRoiPct()
                ),
                mathService.decimal(
                        row.baselineRoiPct()
                ),
                mathService.decimal(
                        row.roiVariancePct()
                ),
                mathService.money(
                        row.fundingVarianceAmount()
                ),
                mathService.decimal(
                        row.fundingVariancePct()
                ),
                mathService.multiple(
                        row.capitalEfficiencyMultiple()
                ),
                mathService.money(
                        row.valueVarianceAmount()
                ),
                row.decisionNote(),
                row.decidedByName(),
                row.decidedAt()
        );
    }

    private InvestmentPerformanceSummaryResponse summary(
            int candidateCount,
            List<InvestmentPerformanceCaseResponse> cases
    ) {
        List<InvestmentPerformanceCaseResponse> active =
                cases.stream()
                        .filter(
                                performanceCase ->
                                        performanceCase.status()
                                                != InvestmentPerformanceCaseStatus.CLOSED
                        )
                        .toList();

        List<InvestmentPerformanceCaseResponse> assessed =
                active.stream()
                        .filter(
                                InvestmentPerformanceCaseResponse::
                                        assessed
                        )
                        .toList();

        return new InvestmentPerformanceSummaryResponse(
                candidateCount,
                active.size(),
                assessed.size(),

                countHealth(
                        assessed,
                        InvestmentPerformanceHealth.OUTPERFORMING
                ),

                countHealth(
                        assessed,
                        InvestmentPerformanceHealth.ON_TRACK
                ),

                countHealth(
                        assessed,
                        InvestmentPerformanceHealth.WATCH
                ),

                countHealth(
                        assessed,
                        InvestmentPerformanceHealth.UNDERPERFORMING
                ),

                (
                        int
                ) active.stream()
                        .filter(
                                performanceCase ->
                                        performanceCase.status()
                                                == InvestmentPerformanceCaseStatus.IN_REMEDIATION
                        )
                        .count(),

                (
                        int
                ) active.stream()
                        .filter(
                                performanceCase ->
                                        performanceCase.status()
                                                == InvestmentPerformanceCaseStatus.VERIFIED
                        )
                        .count(),

                mathService.average(
                        assessed.stream()
                                .map(
                                        InvestmentPerformanceCaseResponse::
                                                realizedRoiPct
                                )
                                .toList()
                ),

                mathService.average(
                        assessed.stream()
                                .map(
                                        InvestmentPerformanceCaseResponse::
                                                roiVariancePct
                                )
                                .toList()
                ),

                mathService.average(
                        assessed.stream()
                                .map(
                                        InvestmentPerformanceCaseResponse::
                                                fundingVariancePct
                                )
                                .toList()
                ),

                mathService.averageMultiple(
                        assessed.stream()
                                .map(
                                        InvestmentPerformanceCaseResponse::
                                                capitalEfficiencyMultiple
                                )
                                .toList()
                )
        );
    }

    private InvestmentPerformanceSnapshotSummaryResponse snapshotSummary(
            InvestmentPerformanceRepository.SnapshotRow row
    ) {
        return new InvestmentPerformanceSnapshotSummaryResponse(
                row.id(),
                row.snapshotNumber(),
                row.caseCount(),
                row.assessedCaseCount(),
                row.outperformingCaseCount(),
                row.onTrackCaseCount(),
                row.watchCaseCount(),
                row.underperformingCaseCount(),
                mathService.decimal(
                        row.averageRealizedRoiPct()
                ),
                mathService.decimal(
                        row.averageRoiVariancePct()
                ),
                mathService.decimal(
                        row.averageFundingVariancePct()
                ),
                mathService.multiple(
                        row.averageCapitalEfficiencyMultiple()
                ),
                row.capturedByName(),
                row.capturedAt()
        );
    }

    private InvestmentPerformanceSnapshotItemResponse snapshotItemResponse(
            InvestmentPerformanceRepository.SnapshotItemRow row
    ) {
        return new InvestmentPerformanceSnapshotItemResponse(
                row.performanceCaseId(),
                row.performanceCaseNumber(),
                row.fundingCommitmentNumber(),
                row.valueCaseNumber(),
                row.initiativeNumber(),
                row.initiativeTitle(),
                row.currency(),
                row.caseStatus(),
                row.assessed(),
                mathService.money(
                        row.releasedCapitalAmount()
                ),
                mathService.money(
                        row.baselineInvestmentCostAmount()
                ),
                mathService.money(
                        row.baselineDurableHorizonValueAmount()
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
                        row.baselineRoiPct()
                ),
                mathService.decimal(
                        row.realizedRoiPct()
                ),
                mathService.decimal(
                        row.roiVariancePct()
                ),
                mathService.money(
                        row.fundingVarianceAmount()
                ),
                mathService.decimal(
                        row.fundingVariancePct()
                ),
                mathService.multiple(
                        row.capitalEfficiencyMultiple()
                ),
                mathService.money(
                        row.valueVarianceAmount()
                ),
                row.health()
        );
    }

    private FundingCommitmentResponse currentFundingCommitment(
            UUID currentUserId,
            UUID fundingCommitmentId
    ) {
        return fundingExecutionService
                .commitment(
                        currentUserId,
                        fundingCommitmentId
                )
                .commitment();
    }

    private StrategicValueCaseResponse currentValueCase(
            UUID currentUserId,
            UUID valueCaseId
    ) {
        return strategicValueService
                .valueCase(
                        currentUserId,
                        valueCaseId
                )
                .valueCase();
    }

    private boolean eligibleFundingCommitment(
            FundingCommitmentResponse funding
    ) {
        if (
                funding.status()
                        != FundingCommitmentStatus.ACTIVE
                &&
                funding.status()
                        != FundingCommitmentStatus.FULLY_RELEASED
                &&
                funding.status()
                        != FundingCommitmentStatus.CLOSED
        ) {
            return false;
        }

        return funding
                .releasedAmount()
                .compareTo(
                        BigDecimal.ZERO
                )
                > 0;
    }

    private void requireObservationMutable(
            InvestmentPerformanceRepository.CaseRow performanceCase
    ) {
        if (
                performanceCase.status()
                        != InvestmentPerformanceCaseStatus.ACTIVE
                &&
                performanceCase.status()
                        != InvestmentPerformanceCaseStatus.IN_REMEDIATION
        ) {
            throw new IllegalArgumentException(
                    "Realized-value observations can be recorded only while the investment-performance case is active or in remediation."
            );
        }
    }

    private InvestmentPerformanceRepository.CaseRow requireCase(
            UUID caseId
    ) {
        InvestmentPerformanceRepository.CaseRow performanceCase =
                repository
                        .findCase(
                                caseId
                        );

        if (performanceCase == null) {
            throw new ResourceNotFoundException(
                    "Investment-performance case not found: "
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
                    "Requester accounts cannot own investment-performance governance."
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
            List<InvestmentPerformanceCaseResponse> cases,
            InvestmentPerformanceHealth health
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

    private String nextCaseNumber() {
        return String.format(
                "INVPERF-%d-%05d",
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
                "INVPSNAP-%d-%05d",
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
                    "Your ProcureIQ role cannot access investment-performance governance."
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
                    "Your ProcureIQ role cannot manage investment-performance governance."
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
                    "Only administrators and procurement managers can validate realized investment value or finalize investment-performance reviews."
            );
        }
    }
}
