package com.procureiq.supplierperformance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SupplierPerformanceReviewResponse(
        UUID id,
        String reviewNumber,

        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierCategory,

        LocalDate periodStart,
        LocalDate periodEnd,

        SupplierPerformanceReviewStatus status,

        BigDecimal qualityScore,
        BigDecimal deliveryScore,
        BigDecimal commercialScore,
        BigDecimal serviceScore,
        BigDecimal complianceScore,

        BigDecimal weightedScore,
        SupplierPerformanceBand performanceBand,

        BigDecimal supplierRatingSnapshot,
        String supplierRiskSnapshot,

        long purchaseOrderCountSnapshot,
        BigDecimal purchaseOrderValueSnapshot,
        long overduePurchaseOrderCountSnapshot,

        UUID ownerUserId,
        String ownerName,

        String decisionNote,
        Instant decidedAt,
        String decidedByName,

        String notes,

        long openCorrectiveActions,
        long overdueCorrectiveActions,

        Instant submittedAt,
        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
