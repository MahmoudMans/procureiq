package com.procureiq.suppliermonitoring;

import java.util.List;
import java.util.UUID;

public record SupplierRiskDetailResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierCategory,
        String supplierCountry,
        SupplierRiskEvaluationResponse latestEvaluation,
        List<SupplierRiskEvaluationResponse> history,
        SupplierRiskWatchlistResponse watchlist,
        List<SupplierRiskAlertResponse> alerts,
        List<SupplierRiskEscalationResponse> escalationCases
) {
}
