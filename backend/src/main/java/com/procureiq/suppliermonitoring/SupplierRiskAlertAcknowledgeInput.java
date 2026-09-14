package com.procureiq.suppliermonitoring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierRiskAlertAcknowledgeInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
