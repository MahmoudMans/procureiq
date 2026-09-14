package com.procureiq.suppliermonitoring;

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
import java.util.concurrent.atomic.AtomicLong;

@Service
@Transactional
public class SupplierRiskMonitoringService {

    private static final BigDecimal DETERIORATION_THRESHOLD =
            new BigDecimal(
                    "10.00"
            );

    private final SupplierRiskMonitoringRepository repository;

    private final SupplierContinuousRiskScoringService scoringService;

    private final AppUserRepository appUserRepository;

    public SupplierRiskMonitoringService(
            SupplierRiskMonitoringRepository repository,
            SupplierContinuousRiskScoringService scoringService,
            AppUserRepository appUserRepository
    ) {
        this.repository =
                repository;

        this.scoringService =
                scoringService;

        this.appUserRepository =
                appUserRepository;
    }

    public SupplierRiskEvaluationRunResponse evaluatePortfolio(
            UUID currentUserId,
            String currency
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        List<SupplierRiskMonitoringRepository.SupplierBaselineRow> suppliers =
                repository
                        .suppliersWithSpend(
                                normalizedCurrency
                        );

        AtomicLong createdAlerts =
                new AtomicLong();

        AtomicLong refreshedAlerts =
                new AtomicLong();

        AtomicLong resolvedAlerts =
                new AtomicLong();

        AtomicLong deterioratingSuppliers =
                new AtomicLong();

        for (
                SupplierRiskMonitoringRepository.SupplierBaselineRow supplier
                : suppliers
        ) {
            SupplierRiskRawSignals raw =
                    rawSignals(
                            supplier,
                            normalizedCurrency
                    );

            SupplierRiskScoreResult score =
                    scoringService
                            .evaluate(
                                    raw
                            );

            SupplierRiskMonitoringRepository.EvaluationRow previous =
                    repository
                            .latestEvaluation(
                                    supplier.supplierId(),
                                    normalizedCurrency
                            );

            BigDecimal previousScore =
                    previous == null
                            ? null
                            : previous.overallScore();

            BigDecimal delta =
                    previousScore == null
                            ? null
                            : score
                                    .overallScore()
                                    .subtract(
                                            previousScore
                                    )
                                    .setScale(
                                            2,
                                            RoundingMode.HALF_UP
                                    );

            boolean deterioration =
                    delta != null
                            &&
                            delta.compareTo(
                                    DETERIORATION_THRESHOLD
                            ) >= 0;

            if (deterioration) {
                deterioratingSuppliers.incrementAndGet();
            }

            UUID evaluationId =
                    UUID.randomUUID();

            repository.insertEvaluation(
                    evaluationId,
                    supplier.supplierId(),
                    normalizedCurrency,
                    score,
                    previousScore,
                    delta,
                    deterioration,
                    money(
                            supplier.spendExposure()
                    ),
                    decimal(
                            supplier.categorySpendShare()
                    ),
                    currentUserId
            );

            for (
                    SupplierRiskFactorResult factor
                    : score.factors()
            ) {
                repository.insertFactor(
                        evaluationId,
                        factor
                );
            }

            syncAlerts(
                    supplier,
                    raw,
                    score,
                    evaluationId,
                    delta,
                    normalizedCurrency,
                    createdAlerts,
                    refreshedAlerts,
                    resolvedAlerts
            );
        }

        return new SupplierRiskEvaluationRunResponse(
                suppliers.size(),
                createdAlerts.get(),
                refreshedAlerts.get(),
                resolvedAlerts.get(),
                deterioratingSuppliers.get()
        );
    }

    @Transactional(readOnly = true)
    public SupplierRiskDashboardResponse dashboard(
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

        List<SupplierRiskMonitoringRepository.EvaluationRow> latest =
                repository
                        .latestEvaluations(
                                normalizedCurrency
                        );

        List<SupplierRiskAlertResponse> alerts =
                repository
                        .activeAlerts(
                                normalizedCurrency
                        )
                        .stream()
                        .map(
                                this::alertResponse
                        )
                        .toList();

        List<SupplierRiskPortfolioItemResponse> portfolio =
                latest.stream()
                        .map(
                                this::portfolioItem
                        )
                        .toList();

        long highRisk =
                portfolio.stream()
                        .filter(
                                supplier ->
                                        supplier.riskBand()
                                                == SupplierContinuousRiskBand.HIGH
                        )
                        .count();

        long critical =
                portfolio.stream()
                        .filter(
                                supplier ->
                                        supplier.riskBand()
                                                == SupplierContinuousRiskBand.CRITICAL
                        )
                        .count();

        long requalification =
                portfolio.stream()
                        .filter(
                                supplier ->
                                        supplier.recommendation()
                                                == SupplierRiskRecommendation.REQUALIFY
                                        ||
                                        supplier.recommendation()
                                                == SupplierRiskRecommendation.ESCALATE
                                        ||
                                        supplier.recommendation()
                                                == SupplierRiskRecommendation.CRITICAL_REVIEW
                        )
                        .count();

        BigDecimal highRiskSpend =
                portfolio.stream()
                        .filter(
                                supplier ->
                                        supplier.riskBand()
                                                == SupplierContinuousRiskBand.HIGH
                                        ||
                                        supplier.riskBand()
                                                == SupplierContinuousRiskBand.CRITICAL
                        )
                        .map(
                                SupplierRiskPortfolioItemResponse::
                                        spendExposure
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        long watchlisted =
                portfolio.stream()
                        .filter(
                                SupplierRiskPortfolioItemResponse::
                                        watchlisted
                        )
                        .count();

        long openCases =
                portfolio.stream()
                        .mapToLong(
                                SupplierRiskPortfolioItemResponse::
                                        openEscalations
                        )
                        .sum();

        return new SupplierRiskDashboardResponse(
                new SupplierRiskSummaryResponse(
                        normalizedCurrency,
                        portfolio.size(),
                        highRisk,
                        critical,
                        portfolio.stream()
                                .filter(
                                        SupplierRiskPortfolioItemResponse::
                                                deterioration
                                )
                                .count(),
                        requalification,
                        watchlisted,
                        alerts.size(),
                        openCases,
                        highRiskSpend,
                        latest.stream()
                                .map(
                                        SupplierRiskMonitoringRepository.EvaluationRow::
                                                evaluatedAt
                                )
                                .max(
                                        java.util.Comparator
                                                .naturalOrder()
                                )
                                .orElse(null)
                ),
                portfolio,
                alerts
        );
    }

    @Transactional(readOnly = true)
    public SupplierRiskDetailResponse detail(
            UUID currentUserId,
            UUID supplierId,
            String currency
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierRiskMonitoringRepository.SupplierIdentityRow supplier =
                requireSupplier(
                        supplierId
                );

        String normalizedCurrency =
                normalizeCurrency(
                        currency
                );

        List<SupplierRiskMonitoringRepository.EvaluationRow> historyRows =
                repository
                        .evaluationHistory(
                                supplierId,
                                normalizedCurrency
                        );

        List<SupplierRiskEvaluationResponse> history =
                historyRows.stream()
                        .map(
                                this::evaluationResponse
                        )
                        .toList();

        return new SupplierRiskDetailResponse(
                supplier.id(),
                supplier.supplierCode(),
                supplier.supplierName(),
                supplier.category(),
                supplier.country(),
                history.isEmpty()
                        ? null
                        : history.get(
                                0
                        ),
                history,
                watchlistResponse(
                        repository
                                .activeWatchlist(
                                        supplierId
                                )
                ),
                repository
                        .alertsForSupplier(
                                supplierId
                        )
                        .stream()
                        .map(
                                this::alertResponse
                        )
                        .toList(),
                repository
                        .escalationsForSupplier(
                                supplierId
                        )
                        .stream()
                        .map(
                                this::escalationResponse
                        )
                        .toList()
        );
    }

    public SupplierRiskWatchlistResponse addWatchlist(
            UUID currentUserId,
            UUID supplierId,
            SupplierRiskWatchlistInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        requireSupplier(
                supplierId
        );

        repository.activateWatchlist(
                supplierId,
                currentUserId,
                input.reason()
        );

        return watchlistResponse(
                repository
                        .activeWatchlist(
                                supplierId
                        )
        );
    }

    public void releaseWatchlist(
            UUID currentUserId,
            UUID supplierId,
            SupplierRiskWatchlistInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        if (
                repository
                        .activeWatchlist(
                                supplierId
                        )
                        == null
        ) {
            throw new IllegalArgumentException(
                    "Supplier is not currently on the risk watchlist."
            );
        }

        repository.releaseWatchlist(
                supplierId,
                currentUserId,
                input.reason()
        );
    }

    public SupplierRiskAlertResponse acknowledgeAlert(
            UUID currentUserId,
            UUID alertId,
            SupplierRiskAlertAcknowledgeInput input
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierRiskMonitoringRepository.AlertRow alert =
                requireAlert(
                        alertId
                );

        if (
                alert.status()
                        != SupplierRiskAlertStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open supplier-risk alerts can be acknowledged."
            );
        }

        repository.acknowledgeAlert(
                alertId,
                currentUserId,
                input.note()
        );

        return alertResponse(
                requireAlert(
                        alertId
                )
        );
    }

    public SupplierRiskEscalationResponse createEscalation(
            UUID currentUserId,
            UUID supplierId,
            SupplierRiskEscalationInput input
    ) {
        AppUserEntity currentUser =
                findCurrentUser(
                        currentUserId
                );

        assertWriteRole(
                currentUser.getRole()
        );

        requireSupplier(
                supplierId
        );

        if (
                input.alertId()
                        != null
        ) {
            SupplierRiskMonitoringRepository.AlertRow alert =
                    requireAlert(
                            input.alertId()
                    );

            if (
                    !alert.supplierId()
                            .equals(
                                    supplierId
                            )
            ) {
                throw new IllegalArgumentException(
                        "Selected risk alert belongs to a different supplier."
                );
            }
        }

        UUID ownerId =
                input.ownerUserId()
                        == null
                        ? currentUserId
                        : requireRiskUser(
                                input.ownerUserId()
                        )
                                .getId();

        UUID caseId =
                UUID.randomUUID();

        repository.createEscalation(
                caseId,
                nextEscalationNumber(),
                supplierId,
                input,
                ownerId
        );

        return escalationResponse(
                requireEscalation(
                        caseId
                )
        );
    }

    public SupplierRiskEscalationResponse startEscalation(
            UUID currentUserId,
            UUID caseId
    ) {
        assertWriteRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierRiskMonitoringRepository.EscalationRow escalation =
                requireEscalation(
                        caseId
                );

        if (
                escalation.status()
                        != SupplierRiskEscalationStatus.OPEN
        ) {
            throw new IllegalArgumentException(
                    "Only open supplier-risk escalation cases can be started."
            );
        }

        repository.startEscalation(
                caseId
        );

        return escalationResponse(
                requireEscalation(
                        caseId
                )
        );
    }

    public SupplierRiskEscalationResponse closeEscalation(
            UUID currentUserId,
            UUID caseId,
            SupplierRiskEscalationCloseInput input
    ) {
        assertCloseRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierRiskMonitoringRepository.EscalationRow escalation =
                requireEscalation(
                        caseId
                );

        if (
                escalation.status()
                        != SupplierRiskEscalationStatus.OPEN
                &&
                escalation.status()
                        != SupplierRiskEscalationStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active escalation cases can be closed."
            );
        }

        repository.closeEscalation(
                caseId,
                input.note()
        );

        return escalationResponse(
                requireEscalation(
                        caseId
                )
        );
    }

    public SupplierRiskEscalationResponse cancelEscalation(
            UUID currentUserId,
            UUID caseId,
            SupplierRiskEscalationCloseInput input
    ) {
        assertCloseRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        SupplierRiskMonitoringRepository.EscalationRow escalation =
                requireEscalation(
                        caseId
                );

        if (
                escalation.status()
                        != SupplierRiskEscalationStatus.OPEN
                &&
                escalation.status()
                        != SupplierRiskEscalationStatus.IN_PROGRESS
        ) {
            throw new IllegalArgumentException(
                    "Only active escalation cases can be cancelled."
            );
        }

        repository.cancelEscalation(
                caseId,
                input.note()
        );

        return escalationResponse(
                requireEscalation(
                        caseId
                )
        );
    }

    @Transactional(readOnly = true)
    public SupplierRiskContextResponse contextOptions(
            UUID currentUserId
    ) {
        assertReadRole(
                findCurrentUser(
                        currentUserId
                )
                        .getRole()
        );

        return new SupplierRiskContextResponse(
                repository.users()
        );
    }

    private SupplierRiskRawSignals rawSignals(
            SupplierRiskMonitoringRepository.SupplierBaselineRow supplier,
            String currency
    ) {
        LocalDate today =
                LocalDate.now(
                        ZoneOffset.UTC
                );

        SupplierRiskMonitoringRepository.OnboardingSignalRow onboarding =
                repository
                        .onboardingSignal(
                                supplier.supplierId()
                        );

        boolean onboardingExists =
                onboarding != null;

        boolean onboardingClearance =
                onboarding != null
                        &&
                        onboarding.activationClearance()
                        &&
                        "APPROVED".equals(
                                onboarding.status()
                        )
                        &&
                        (
                                onboarding.requalificationDueDate()
                                        == null
                                ||
                                !onboarding
                                        .requalificationDueDate()
                                        .isBefore(
                                                today
                                        )
                        );

        boolean onboardingExpired =
                onboarding != null
                        &&
                        (
                                "EXPIRED".equals(
                                        onboarding.status()
                                )
                                ||
                                (
                                        onboarding.requalificationDueDate()
                                                != null
                                        &&
                                        onboarding
                                                .requalificationDueDate()
                                                .isBefore(
                                                        today
                                                )
                                )
                        );

        boolean onboardingDueSoon =
                onboarding != null
                        &&
                        onboarding.requalificationDueDate()
                                != null
                        &&
                        !onboarding
                                .requalificationDueDate()
                                .isBefore(
                                        today
                                )
                        &&
                        !onboarding
                                .requalificationDueDate()
                                .isAfter(
                                        today.plusDays(
                                                30
                                        )
                                );

        SupplierRiskMonitoringRepository.DocumentSignalRow documents =
                repository
                        .documentSignal(
                                supplier.supplierId()
                        );

        SupplierRiskMonitoringRepository.EsgSignalRow esg =
                repository
                        .esgSignal(
                                supplier.supplierId()
                        );

        String effectiveEsgStatus =
                null;

        String esgRating =
                null;

        if (esg != null) {
            effectiveEsgStatus =
                    esg.status();

            esgRating =
                    esg.rating();

            if (
                    "APPROVED".equals(
                            effectiveEsgStatus
                    )
                    &&
                    esg.nextReviewDate()
                            != null
                    &&
                    esg.nextReviewDate()
                            .isBefore(
                                    today
                            )
            ) {
                effectiveEsgStatus =
                        "EXPIRED";
            }
        }

        SupplierRiskMonitoringRepository.AnomalySignalRow anomaly =
                repository
                        .anomalySignal(
                                supplier.supplierId(),
                                currency
                        );

        SupplierRiskMonitoringRepository.CollaborationSignalRow collaboration =
                repository
                        .collaborationSignal(
                                supplier.supplierId()
                        );

        SupplierRiskMonitoringRepository.CommercialSignalRow commercial =
                repository
                        .commercialSignal(
                                supplier.supplierId(),
                                currency
                        );

        return new SupplierRiskRawSignals(
                onboardingExists,
                onboardingClearance,
                onboardingDueSoon,
                onboardingExpired,
                documents.mandatoryDocuments(),
                documents.currentDocuments(),
                documents.submittedDocuments(),
                documents.expiredDocuments(),
                documents.rejectedDocuments(),
                effectiveEsgStatus,
                esgRating,
                anomaly.activeFindings(),
                anomaly.criticalFindings(),
                anomaly.maximumScore(),
                collaboration.waitingSupplier(),
                collaboration.slaBreaches(),
                collaboration.overdueActions(),
                commercial.openFindings(),
                commercial.exposure(),
                supplier.spendExposure(),
                supplier.categorySpendShare()
        );
    }

    private void syncAlerts(
            SupplierRiskMonitoringRepository.SupplierBaselineRow supplier,
            SupplierRiskRawSignals raw,
            SupplierRiskScoreResult score,
            UUID evaluationId,
            BigDecimal delta,
            String currency,
            AtomicLong created,
            AtomicLong refreshed,
            AtomicLong resolved
    ) {
        boolean highRisk =
                score.riskBand()
                                == SupplierContinuousRiskBand.HIGH
                        ||
                        score.riskBand()
                                == SupplierContinuousRiskBand.CRITICAL;

        syncAlert(
                supplier,
                evaluationId,
                currency,
                SupplierRiskAlertType.HIGH_RISK,
                highRisk,
                score.riskBand()
                                == SupplierContinuousRiskBand.CRITICAL
                        ? SupplierRiskAlertSeverity.CRITICAL
                        : SupplierRiskAlertSeverity.HIGH,
                "Elevated continuous supplier risk",
                "Supplier continuous-risk score is "
                        + score.overallScore()
                        + " with band "
                        + score.riskBand()
                        + ".",
                created,
                refreshed,
                resolved
        );

        boolean deterioration =
                delta != null
                        &&
                        delta.compareTo(
                                DETERIORATION_THRESHOLD
                        ) >= 0;

        syncAlert(
                supplier,
                evaluationId,
                currency,
                SupplierRiskAlertType.DETERIORATION,
                deterioration,
                delta != null
                                &&
                                delta.compareTo(
                                        new BigDecimal(
                                                "20.00"
                                        )
                                ) >= 0
                        ? SupplierRiskAlertSeverity.HIGH
                        : SupplierRiskAlertSeverity.MEDIUM,
                "Supplier risk deterioration",
                delta == null
                        ? "No previous evaluation is available."
                        : "Supplier continuous-risk score deteriorated by "
                                + delta
                                + " points since the previous evaluation.",
                created,
                refreshed,
                resolved
        );

        boolean requalify =
                score.recommendation()
                                == SupplierRiskRecommendation.REQUALIFY
                        ||
                        score.recommendation()
                                == SupplierRiskRecommendation.ESCALATE
                        ||
                        score.recommendation()
                                == SupplierRiskRecommendation.CRITICAL_REVIEW;

        syncAlert(
                supplier,
                evaluationId,
                currency,
                SupplierRiskAlertType.REQUALIFICATION_REQUIRED,
                requalify,
                score.recommendation()
                                == SupplierRiskRecommendation.CRITICAL_REVIEW
                        ? SupplierRiskAlertSeverity.CRITICAL
                        : SupplierRiskAlertSeverity.HIGH,
                "Supplier requalification recommended",
                "Continuous monitoring recommendation is "
                        + score.recommendation()
                        + ". ProcureIQ recommends governance review before creating or updating a formal requalification case.",
                created,
                refreshed,
                resolved
        );

        int documentGap =
                Math.max(
                        0,
                        raw.mandatoryDocuments()
                                -
                                raw.currentDocuments()
                );

        boolean complianceGap =
                !raw.onboardingClearance()
                        ||
                        raw.onboardingExpired()
                        ||
                        documentGap
                                > 0;

        syncAlert(
                supplier,
                evaluationId,
                currency,
                SupplierRiskAlertType.COMPLIANCE_GAP,
                complianceGap,
                (
                        raw.onboardingExpired()
                                ||
                                raw.expiredDocuments()
                                        > 0
                )
                        ? SupplierRiskAlertSeverity.HIGH
                        : SupplierRiskAlertSeverity.MEDIUM,
                "Supplier qualification or document gap",
                "Onboarding clearance="
                        + raw.onboardingClearance()
                        + ", document gaps="
                        + documentGap
                        + ", expired documents="
                        + raw.expiredDocuments()
                        + ".",
                created,
                refreshed,
                resolved
        );
    }

    private void syncAlert(
            SupplierRiskMonitoringRepository.SupplierBaselineRow supplier,
            UUID evaluationId,
            String currency,
            SupplierRiskAlertType type,
            boolean active,
            SupplierRiskAlertSeverity severity,
            String title,
            String details,
            AtomicLong created,
            AtomicLong refreshed,
            AtomicLong resolved
    ) {
        String alertKey =
                supplier.supplierId()
                        + ":"
                        + currency
                        + ":"
                        + type.name();

        SupplierRiskMonitoringRepository.AlertRow existing =
                repository
                        .findAlertByKey(
                                alertKey
                        );

        if (active) {
            repository.upsertAlert(
                    existing == null
                            ? UUID.randomUUID()
                            : existing.id(),
                    alertKey,
                    supplier.supplierId(),
                    evaluationId,
                    type,
                    severity,
                    title,
                    details
            );

            if (existing == null) {
                created.incrementAndGet();
            } else {
                refreshed.incrementAndGet();
            }

            return;
        }

        if (
                existing != null
                &&
                repository
                        .resolveAlert(
                                alertKey
                        )
                        > 0
        ) {
            resolved.incrementAndGet();
        }
    }

    private SupplierRiskPortfolioItemResponse portfolioItem(
            SupplierRiskMonitoringRepository.EvaluationRow row
    ) {
        boolean watchlisted =
                repository
                        .activeWatchlist(
                                row.supplierId()
                        )
                        != null;

        long alerts =
                repository
                        .alertsForSupplier(
                                row.supplierId()
                        )
                        .stream()
                        .filter(
                                alert ->
                                        alert.status()
                                                != SupplierRiskAlertStatus.RESOLVED
                        )
                        .count();

        long cases =
                repository
                        .escalationsForSupplier(
                                row.supplierId()
                        )
                        .stream()
                        .filter(
                                escalation ->
                                        escalation.status()
                                                == SupplierRiskEscalationStatus.OPEN
                                        ||
                                        escalation.status()
                                                == SupplierRiskEscalationStatus.IN_PROGRESS
                        )
                        .count();

        return new SupplierRiskPortfolioItemResponse(
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.category(),
                row.country(),
                row.currency(),
                row.id(),
                decimal(
                        row.overallScore()
                ),
                row.riskBand(),
                row.recommendation(),
                decimalNullable(
                        row.deltaScore()
                ),
                row.deterioration(),
                money(
                        row.spendExposure()
                ),
                decimal(
                        row.categorySpendShare()
                ),
                watchlisted,
                alerts,
                cases,
                row.evaluatedAt()
        );
    }

    private SupplierRiskEvaluationResponse evaluationResponse(
            SupplierRiskMonitoringRepository.EvaluationRow row
    ) {
        return new SupplierRiskEvaluationResponse(
                row.id(),
                row.supplierId(),
                row.supplierCode(),
                row.supplierName(),
                row.category(),
                row.country(),
                row.currency(),
                decimal(
                        row.overallScore()
                ),
                row.riskBand(),
                row.recommendation(),
                decimalNullable(
                        row.previousScore()
                ),
                decimalNullable(
                        row.deltaScore()
                ),
                row.deterioration(),
                money(
                        row.spendExposure()
                ),
                decimal(
                        row.categorySpendShare()
                ),
                repository
                        .factors(
                                row.id()
                        )
                        .stream()
                        .map(
                                factor ->
                                        new SupplierRiskFactorResponse(
                                                factor.factorCode(),
                                                decimal(
                                                        factor.factorScore()
                                                ),
                                                decimal(
                                                        factor.weightPct()
                                                ),
                                                decimal(
                                                        factor.contribution()
                                                ),
                                                factor.details()
                                        )
                        )
                        .toList(),
                row.evaluatedAt()
        );
    }

    private SupplierRiskAlertResponse alertResponse(
            SupplierRiskMonitoringRepository.AlertRow row
    ) {
        return new SupplierRiskAlertResponse(
                row.id(),
                row.supplierId(),
                row.evaluationId(),
                row.alertType(),
                row.severity(),
                row.status(),
                row.title(),
                row.details(),
                row.acknowledgedByName(),
                row.acknowledgementNote(),
                row.acknowledgedAt(),
                row.resolvedAt(),
                row.createdAt(),
                row.lastSeenAt()
        );
    }

    private SupplierRiskWatchlistResponse watchlistResponse(
            SupplierRiskMonitoringRepository.WatchlistRow row
    ) {
        if (row == null) {
            return null;
        }

        return new SupplierRiskWatchlistResponse(
                row.id(),
                row.supplierId(),
                row.status(),
                row.reason(),
                row.addedByName(),
                row.addedAt(),
                row.releasedByName(),
                row.releaseNote(),
                row.releasedAt()
        );
    }

    private SupplierRiskEscalationResponse escalationResponse(
            SupplierRiskMonitoringRepository.EscalationRow row
    ) {
        boolean overdue =
                (
                        row.status()
                                == SupplierRiskEscalationStatus.OPEN
                        ||
                        row.status()
                                == SupplierRiskEscalationStatus.IN_PROGRESS
                )
                &&
                row.dueDate()
                        .isBefore(
                                LocalDate.now(
                                        ZoneOffset.UTC
                                )
                        );

        return new SupplierRiskEscalationResponse(
                row.id(),
                row.caseNumber(),
                row.supplierId(),
                row.alertId(),
                row.ownerUserId(),
                row.ownerName(),
                row.priority(),
                row.status(),
                row.dueDate(),
                overdue,
                row.rationale(),
                row.resolutionNote(),
                row.closedAt(),
                row.createdAt(),
                row.updatedAt(),
                row.version()
        );
    }

    private SupplierRiskMonitoringRepository.SupplierIdentityRow requireSupplier(
            UUID supplierId
    ) {
        SupplierRiskMonitoringRepository.SupplierIdentityRow supplier =
                repository
                        .supplierIdentity(
                                supplierId
                        );

        if (supplier == null) {
            throw new ResourceNotFoundException(
                    "Supplier not found: "
                            + supplierId
            );
        }

        return supplier;
    }

    private SupplierRiskMonitoringRepository.AlertRow requireAlert(
            UUID alertId
    ) {
        SupplierRiskMonitoringRepository.AlertRow alert =
                repository
                        .findAlert(
                                alertId
                        );

        if (alert == null) {
            throw new ResourceNotFoundException(
                    "Supplier-risk alert not found: "
                            + alertId
            );
        }

        return alert;
    }

    private SupplierRiskMonitoringRepository.EscalationRow requireEscalation(
            UUID caseId
    ) {
        SupplierRiskMonitoringRepository.EscalationRow escalation =
                repository
                        .findEscalation(
                                caseId
                        );

        if (escalation == null) {
            throw new ResourceNotFoundException(
                    "Supplier-risk escalation case not found: "
                            + caseId
            );
        }

        return escalation;
    }

    private String nextEscalationNumber() {
        Long sequence =
                repository
                        .nextEscalationSequence();

        return String.format(
                "SRISK-%d-%05d",
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
                    "Supplier-risk currency must contain exactly three characters."
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

    private AppUserEntity requireRiskUser(
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
                    "Supplier-risk ownership requires a procurement governance role."
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
                    "Your ProcureIQ role cannot access continuous supplier-risk monitoring."
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
                    "Your ProcureIQ role cannot manage continuous supplier-risk monitoring."
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
                    "Only administrators and procurement managers can close supplier-risk escalation cases."
            );
        }
    }
}
