package com.procureiq.commercialgovernance;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CommercialGovernanceRecordResponse(
        UUID id,

        UUID contractId,

        UUID supplierId,
        String supplierCode,
        String supplierName,

        String contractStatus,
        LocalDate contractEndDate,

        CommercialGovernanceStatus governanceStatus,
        ContractRenewalStatus renewalStatus,

        int noticePeriodDays,
        LocalDate noticeDeadline,

        BigDecimal baselineContractValue,
        String currency,

        BigDecimal priceEscalationPct,
        BigDecimal maxPoVariancePct,

        boolean autoRenewal,

        UUID ownerUserId,
        String ownerName,

        String renewalDecisionNote,
        Instant renewalDecidedAt,
        String renewalDecidedByName,

        String notes,

        long openObligations,
        long overdueObligations,

        long openLeakageFindings,
        BigDecimal leakageExposure,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
