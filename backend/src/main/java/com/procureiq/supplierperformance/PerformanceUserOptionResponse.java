package com.procureiq.supplierperformance;

import com.procureiq.user.ProcurementRole;

import java.util.UUID;

public record PerformanceUserOptionResponse(
        UUID id,
        String fullName,
        ProcurementRole role
) {
}
