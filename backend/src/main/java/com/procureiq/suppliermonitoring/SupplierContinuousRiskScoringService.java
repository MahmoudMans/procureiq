package com.procureiq.suppliermonitoring;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

@Component
public class SupplierContinuousRiskScoringService {

    private static final BigDecimal ONBOARDING_WEIGHT =
            new BigDecimal(
                    "20.00"
            );

    private static final BigDecimal DOCUMENT_WEIGHT =
            new BigDecimal(
                    "20.00"
            );

    private static final BigDecimal ESG_WEIGHT =
            new BigDecimal(
                    "15.00"
            );

    private static final BigDecimal ANOMALY_WEIGHT =
            new BigDecimal(
                    "15.00"
            );

    private static final BigDecimal COLLABORATION_WEIGHT =
            new BigDecimal(
                    "10.00"
            );

    private static final BigDecimal COMMERCIAL_WEIGHT =
            new BigDecimal(
                    "10.00"
            );

    private static final BigDecimal DEPENDENCY_WEIGHT =
            new BigDecimal(
                    "10.00"
            );

    public SupplierRiskScoreResult evaluate(
            SupplierRiskRawSignals raw
    ) {
        List<SupplierRiskFactorResult> factors =
                new ArrayList<>();

        factors.add(
                factor(
                        SupplierRiskFactorCode.ONBOARDING,
                        onboardingScore(
                                raw
                        ),
                        ONBOARDING_WEIGHT,
                        onboardingDetails(
                                raw
                        )
                )
        );

        factors.add(
                factor(
                        SupplierRiskFactorCode.DOCUMENT_COMPLIANCE,
                        documentScore(
                                raw
                        ),
                        DOCUMENT_WEIGHT,
                        documentDetails(
                                raw
                        )
                )
        );

        factors.add(
                factor(
                        SupplierRiskFactorCode.ESG,
                        esgScore(
                                raw
                        ),
                        ESG_WEIGHT,
                        esgDetails(
                                raw
                        )
                )
        );

        factors.add(
                factor(
                        SupplierRiskFactorCode.CONTROL_ANOMALY,
                        anomalyScore(
                                raw
                        ),
                        ANOMALY_WEIGHT,
                        anomalyDetails(
                                raw
                        )
                )
        );

        factors.add(
                factor(
                        SupplierRiskFactorCode.COLLABORATION,
                        collaborationScore(
                                raw
                        ),
                        COLLABORATION_WEIGHT,
                        collaborationDetails(
                                raw
                        )
                )
        );

        factors.add(
                factor(
                        SupplierRiskFactorCode.COMMERCIAL,
                        commercialScore(
                                raw
                        ),
                        COMMERCIAL_WEIGHT,
                        commercialDetails(
                                raw
                        )
                )
        );

        factors.add(
                factor(
                        SupplierRiskFactorCode.SPEND_DEPENDENCY,
                        dependencyScore(
                                raw.categorySpendShare()
                        ),
                        DEPENDENCY_WEIGHT,
                        "Supplier represents "
                                + decimal(
                                        raw.categorySpendShare()
                                )
                                + "% of monitored purchase-order spend in its category."
                )
        );

        BigDecimal overall =
                factors.stream()
                        .map(
                                SupplierRiskFactorResult::
                                        contribution
                        )
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add
                        )
                        .setScale(
                                2,
                                RoundingMode.HALF_UP
                        );

        return new SupplierRiskScoreResult(
                overall,
                riskBand(
                        overall
                ),
                recommendation(
                        overall
                ),
                List.copyOf(
                        factors
                )
        );
    }

    private SupplierRiskFactorResult factor(
            SupplierRiskFactorCode code,
            BigDecimal score,
            BigDecimal weight,
            String details
    ) {
        BigDecimal normalized =
                bounded(
                        score
                );

        BigDecimal contribution =
                normalized
                        .multiply(
                                weight
                        )
                        .divide(
                                new BigDecimal(
                                        "100.00"
                                ),
                                2,
                                RoundingMode.HALF_UP
                        );

        return new SupplierRiskFactorResult(
                code,
                normalized,
                weight,
                contribution,
                details
        );
    }

    private BigDecimal onboardingScore(
            SupplierRiskRawSignals raw
    ) {
        if (!raw.onboardingExists()) {
            return value(
                    70
            );
        }

        if (raw.onboardingExpired()) {
            return value(
                    100
            );
        }

        if (!raw.onboardingClearance()) {
            return value(
                    90
            );
        }

        if (raw.onboardingDueSoon()) {
            return value(
                    35
            );
        }

        return value(
                0
        );
    }

    private String onboardingDetails(
            SupplierRiskRawSignals raw
    ) {
        if (!raw.onboardingExists()) {
            return "No onboarding or requalification case has established current activation clearance.";
        }

        if (raw.onboardingExpired()) {
            return "Supplier qualification is expired and requires requalification.";
        }

        if (!raw.onboardingClearance()) {
            return "Latest onboarding state does not provide current activation clearance.";
        }

        if (raw.onboardingDueSoon()) {
            return "Supplier requalification is due within 30 days.";
        }

        return "Supplier onboarding clearance is current.";
    }

    private BigDecimal documentScore(
            SupplierRiskRawSignals raw
    ) {
        if (
                raw.mandatoryDocuments()
                        == 0
        ) {
            return value(
                    0
            );
        }

        int gap =
                Math.max(
                        0,
                        raw.mandatoryDocuments()
                                -
                                raw.currentDocuments()
                );

        BigDecimal ratio =
                BigDecimal.valueOf(
                        gap
                )
                        .multiply(
                                new BigDecimal(
                                        "100.00"
                                )
                        )
                        .divide(
                                BigDecimal.valueOf(
                                        raw.mandatoryDocuments()
                                ),
                                2,
                                RoundingMode.HALF_UP
                        );

        BigDecimal score =
                ratio;

        if (
                raw.expiredDocuments()
                        > 0
        ) {
            score =
                    score.add(
                            new BigDecimal(
                                    "20.00"
                            )
                    );
        }

        if (
                raw.rejectedDocuments()
                        > 0
        ) {
            score =
                    score.add(
                            new BigDecimal(
                                    "15.00"
                            )
                    );
        }

        if (
                raw.submittedDocuments()
                        > 0
        ) {
            score =
                    score.add(
                            new BigDecimal(
                                    "5.00"
                            )
                    );
        }

        return bounded(
                score
        );
    }

    private String documentDetails(
            SupplierRiskRawSignals raw
    ) {
        int gap =
                Math.max(
                        0,
                        raw.mandatoryDocuments()
                                -
                                raw.currentDocuments()
                );

        return raw.currentDocuments()
                + "/"
                + raw.mandatoryDocuments()
                + " mandatory compliance documents are current; "
                + gap
                + " gap(s), "
                + raw.expiredDocuments()
                + " expired, "
                + raw.rejectedDocuments()
                + " rejected, "
                + raw.submittedDocuments()
                + " pending review.";
    }

    private BigDecimal esgScore(
            SupplierRiskRawSignals raw
    ) {
        if (
                raw.esgStatus()
                        == null
        ) {
            return value(
                    60
            );
        }

        return switch (
                raw.esgStatus()
        ) {
            case "EXPIRED" ->
                    value(
                            90
                    );

            case "REJECTED" ->
                    value(
                            100
                    );

            case "DRAFT",
                 "SUBMITTED" ->
                    value(
                            50
                    );

            case "APPROVED" ->
                    ratingScore(
                            raw.esgRating()
                    );

            default ->
                    value(
                            60
                    );
        };
    }

    private BigDecimal ratingScore(
            String rating
    ) {
        if (rating == null) {
            return value(
                    60
            );
        }

        return switch (
                rating
        ) {
            case "LEADING" ->
                    value(
                            0
                    );

            case "GOOD" ->
                    value(
                            15
                    );

            case "MODERATE" ->
                    value(
                            35
                    );

            case "HIGH_RISK" ->
                    value(
                            75
                    );

            case "CRITICAL" ->
                    value(
                            100
                    );

            default ->
                    value(
                            60
                    );
        };
    }

    private String esgDetails(
            SupplierRiskRawSignals raw
    ) {
        if (
                raw.esgStatus()
                        == null
        ) {
            return "No supplier ESG assessment is available.";
        }

        return "Latest ESG assessment status is "
                + raw.esgStatus()
                + (
                        raw.esgRating()
                                == null
                                ? "."
                                : " with rating "
                                        + raw.esgRating()
                                        + "."
                );
    }

    private BigDecimal anomalyScore(
            SupplierRiskRawSignals raw
    ) {
        if (
                raw.activeAnomalies()
                        == 0
        ) {
            return value(
                    0
            );
        }

        BigDecimal maximum =
                raw.maximumAnomalyScore()
                        == null
                        ? BigDecimal.ZERO
                        : raw.maximumAnomalyScore();

        BigDecimal severityBoost =
                BigDecimal.valueOf(
                        Math.min(
                                20,
                                raw.criticalAnomalies()
                                        * 10
                        )
                );

        return bounded(
                maximum.add(
                        severityBoost
                )
        );
    }

    private String anomalyDetails(
            SupplierRiskRawSignals raw
    ) {
        return raw.activeAnomalies()
                + " active anomaly-control finding(s), including "
                + raw.criticalAnomalies()
                + " critical signal(s); maximum anomaly score "
                + decimal(
                        raw.maximumAnomalyScore()
                )
                + ".";
    }

    private BigDecimal collaborationScore(
            SupplierRiskRawSignals raw
    ) {
        BigDecimal score =
                BigDecimal.valueOf(
                        raw.collaborationSlaBreaches()
                                * 35
                                +
                                raw.overdueCollaborationActions()
                                        * 15
                                +
                                raw.waitingSupplierWorkspaces()
                                        * 5
                );

        return bounded(
                score
        );
    }

    private String collaborationDetails(
            SupplierRiskRawSignals raw
    ) {
        return raw.waitingSupplierWorkspaces()
                + " workspace(s) waiting for supplier response, "
                + raw.collaborationSlaBreaches()
                + " response SLA breach(es), and "
                + raw.overdueCollaborationActions()
                + " overdue collaboration action(s).";
    }

    private BigDecimal commercialScore(
            SupplierRiskRawSignals raw
    ) {
        if (
                raw.openLeakageFindings()
                        == 0
        ) {
            return value(
                    0
            );
        }

        BigDecimal exposure =
                raw.leakageExposure()
                        == null
                        ? BigDecimal.ZERO
                        : raw.leakageExposure();

        BigDecimal spend =
                raw.spendExposure()
                        == null
                        ? BigDecimal.ZERO
                        : raw.spendExposure();

        BigDecimal ratioScore =
                spend.compareTo(
                        BigDecimal.ZERO
                ) <= 0
                        ? new BigDecimal(
                                "80.00"
                        )
                        : exposure
                                .multiply(
                                        new BigDecimal(
                                                "100.00"
                                        )
                                )
                                .divide(
                                        spend,
                                        2,
                                        RoundingMode.HALF_UP
                                );

        BigDecimal findingBoost =
                BigDecimal.valueOf(
                        Math.min(
                                30,
                                raw.openLeakageFindings()
                                        * 10
                        )
                );

        return bounded(
                ratioScore.add(
                        findingBoost
                )
        );
    }

    private String commercialDetails(
            SupplierRiskRawSignals raw
    ) {
        return raw.openLeakageFindings()
                + " open commercial-leakage finding(s) with monitored exposure "
                + decimal(
                        raw.leakageExposure()
                )
                + ".";
    }

    private BigDecimal dependencyScore(
            BigDecimal share
    ) {
        BigDecimal normalized =
                share == null
                        ? BigDecimal.ZERO
                        : share;

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return value(
                    100
            );
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return value(
                    75
            );
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "35.00"
                        )
                ) >= 0
        ) {
            return value(
                    50
            );
        }

        if (
                normalized.compareTo(
                        new BigDecimal(
                                "20.00"
                        )
                ) >= 0
        ) {
            return value(
                    25
            );
        }

        return value(
                10
        );
    }

    public SupplierContinuousRiskBand riskBand(
            BigDecimal overall
    ) {
        if (
                overall.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return SupplierContinuousRiskBand.CRITICAL;
        }

        if (
                overall.compareTo(
                        new BigDecimal(
                                "50.00"
                        )
                ) >= 0
        ) {
            return SupplierContinuousRiskBand.HIGH;
        }

        if (
                overall.compareTo(
                        new BigDecimal(
                                "30.00"
                        )
                ) >= 0
        ) {
            return SupplierContinuousRiskBand.MODERATE;
        }

        return SupplierContinuousRiskBand.LOW;
    }

    public SupplierRiskRecommendation recommendation(
            BigDecimal overall
    ) {
        if (
                overall.compareTo(
                        new BigDecimal(
                                "70.00"
                        )
                ) >= 0
        ) {
            return SupplierRiskRecommendation.CRITICAL_REVIEW;
        }

        if (
                overall.compareTo(
                        new BigDecimal(
                                "60.00"
                        )
                ) >= 0
        ) {
            return SupplierRiskRecommendation.ESCALATE;
        }

        if (
                overall.compareTo(
                        new BigDecimal(
                                "45.00"
                        )
                ) >= 0
        ) {
            return SupplierRiskRecommendation.REQUALIFY;
        }

        if (
                overall.compareTo(
                        new BigDecimal(
                                "30.00"
                        )
                ) >= 0
        ) {
            return SupplierRiskRecommendation.WATCHLIST;
        }

        return SupplierRiskRecommendation.MONITOR;
    }

    private BigDecimal bounded(
            BigDecimal value
    ) {
        if (
                value.compareTo(
                        BigDecimal.ZERO
                ) < 0
        ) {
            return BigDecimal.ZERO
                    .setScale(
                            2,
                            RoundingMode.HALF_UP
                    );
        }

        return value
                .min(
                        new BigDecimal(
                                "100.00"
                        )
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private BigDecimal value(
            int value
    ) {
        return BigDecimal
                .valueOf(
                        value
                )
                .setScale(
                        2,
                        RoundingMode.HALF_UP
                );
    }

    private String decimal(
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
                )
                .toPlainString();
    }
}
