package com.procureiq.supplierresilience;

import java.math.BigDecimal;
import java.util.UUID;

public record SupplierResilienceIntelligenceResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String category,
        String country,
        BigDecimal supplierRating,
        String supplierRiskLevel,

        UUID profileId,
        SupplierResilienceProfileStatus profileStatus,
        SupplierCriticality criticality,
        SupplierCapacityStatus capacityStatus,
        BigDecimal dependencyTolerancePct,
        int minimumAlternates,
        String businessImpact,
        String capacityNotes,
        String profileNotes,
        UUID profileOwnerUserId,
        String profileOwnerName,

        String currency,

        BigDecimal supplierSpend,
        BigDecimal portfolioSpend,
        BigDecimal spendSharePct,

        BigDecimal categorySpend,
        BigDecimal categorySharePct,

        BigDecimal countrySpend,
        BigDecimal countrySpendSharePct,

        int alternateSupplierCount,
        int alternateGap,

        boolean singleSource,
        boolean dependencyToleranceBreached,

        BigDecimal latestPerformanceScore,
        long openCorrectiveActions,
        boolean activeContractCoverage,

        BigDecimal resilienceScore,
        SupplierResilienceBand resilienceBand,

        long openMitigationActions,
        long overdueMitigationActions
) {
}
