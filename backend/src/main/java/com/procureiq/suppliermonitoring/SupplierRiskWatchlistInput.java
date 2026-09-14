package com.procureiq.suppliermonitoring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierRiskWatchlistInput(

        @NotBlank
        @Size(max = 2000)
        String reason
) {
}
