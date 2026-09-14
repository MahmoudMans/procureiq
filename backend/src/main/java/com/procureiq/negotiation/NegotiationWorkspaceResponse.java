package com.procureiq.negotiation;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record NegotiationWorkspaceResponse(
        UUID id,
        String negotiationNumber,

        UUID rfqId,
        String rfqNumber,
        String rfqTitle,

        UUID supplierId,
        String supplierName,
        String supplierRiskLevel,

        UUID baselineQuotationId,
        String baselineQuotationReference,

        NegotiationWorkspaceStatus status,
        String currency,

        BigDecimal baselineValue,
        BigDecimal targetValue,
        BigDecimal walkAwayValue,
        BigDecimal agreedValue,

        BigDecimal targetSavings,
        BigDecimal agreedSavings,
        BigDecimal agreedSavingsPct,

        UUID agreedScenarioId,

        UUID ownerUserId,
        String ownerName,

        String notes,

        Instant agreedAt,
        Instant closedAt,

        UUID awardedQuotationId,
        UUID awardedSupplierId,
        String awardedSupplierName,
        BigDecimal awardedValue,
        BigDecimal awardSavingsFromBaseline,
        BigDecimal agreementToAwardDelta,
        Boolean agreementSupplierMatchesAward,

        List<NegotiationScenarioResponse> scenarios,
        List<NegotiationRoundResponse> rounds,

        Instant createdAt,
        Instant updatedAt,
        long version
) {
}
