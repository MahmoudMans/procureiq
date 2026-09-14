package com.procureiq.anomaly;

import java.math.BigDecimal;
import java.time.Instant;

public record AnomalyControlSummaryResponse(
        String currency,

        long activeFindings,
        long criticalFindings,
        long underInvestigation,
        long confirmedFindings,

        BigDecimal activeExposure,
        BigDecimal invoiceExposure,
        BigDecimal commercialLeakageExposure,

        long duplicateInvoiceSignals,
        long repeatedValueSignals,
        long splitPurchaseSignals,
        long concentrationSignals,
        long offContractSignals,

        long activeInvestigations,
        long overdueInvestigations,

        Instant lastScanAt
) {
}
