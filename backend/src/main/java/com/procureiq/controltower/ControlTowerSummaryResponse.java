package com.procureiq.controltower;

import java.math.BigDecimal;

public record ControlTowerSummaryResponse(
        String currency,
        long activeItems,
        long criticalItems,
        long highItems,
        long slaOverdueItems,
        long unassignedItems,
        BigDecimal activeMonetaryExposure,
        long supplierRiskItems,
        long complianceItems,
        long sourcingItems,
        long benefitsItems,
        long governanceItems
) {
}
