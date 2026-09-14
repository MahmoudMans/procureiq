package com.procureiq.suppliermonitoring;

import java.util.List;

public record SupplierRiskContextResponse(
        List<SupplierRiskUserOptionResponse> users
) {
}
