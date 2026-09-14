package com.procureiq.suppliermonitoring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierRiskEscalationCloseInput(

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
