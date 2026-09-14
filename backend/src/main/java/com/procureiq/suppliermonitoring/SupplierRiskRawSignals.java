package com.procureiq.suppliermonitoring;

import java.math.BigDecimal;

public record SupplierRiskRawSignals(
        boolean onboardingExists,
        boolean onboardingClearance,
        boolean onboardingDueSoon,
        boolean onboardingExpired,

        int mandatoryDocuments,
        int currentDocuments,
        int submittedDocuments,
        int expiredDocuments,
        int rejectedDocuments,

        String esgStatus,
        String esgRating,

        long activeAnomalies,
        long criticalAnomalies,
        BigDecimal maximumAnomalyScore,

        long waitingSupplierWorkspaces,
        long collaborationSlaBreaches,
        long overdueCollaborationActions,

        long openLeakageFindings,
        BigDecimal leakageExposure,

        BigDecimal spendExposure,
        BigDecimal categorySpendShare
) {
}
