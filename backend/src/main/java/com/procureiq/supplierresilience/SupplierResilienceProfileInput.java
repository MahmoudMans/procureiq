package com.procureiq.supplierresilience;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record SupplierResilienceProfileInput(

        @NotNull
        SupplierCriticality criticality,

        @NotNull
        SupplierCapacityStatus capacityStatus,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal dependencyTolerancePct,

        @Min(0)
        @Max(20)
        int minimumAlternates,

        UUID ownerUserId,

        @Size(max = 2000)
        String businessImpact,

        @Size(max = 2000)
        String capacityNotes,

        @Size(max = 3000)
        String notes
) {
}
