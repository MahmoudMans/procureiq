package com.procureiq.suppliermonitoring;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record SupplierRiskUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
