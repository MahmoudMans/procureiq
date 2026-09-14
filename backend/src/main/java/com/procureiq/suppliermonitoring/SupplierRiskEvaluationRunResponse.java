package com.procureiq.suppliermonitoring;

public record SupplierRiskEvaluationRunResponse(
        long evaluatedSuppliers,
        long alertsCreated,
        long alertsRefreshed,
        long alertsResolved,
        long deterioratingSuppliers
) {
}
