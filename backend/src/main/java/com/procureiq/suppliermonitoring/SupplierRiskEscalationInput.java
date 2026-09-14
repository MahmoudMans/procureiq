package com.procureiq.suppliermonitoring;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record SupplierRiskEscalationInput(

        UUID alertId,

        UUID ownerUserId,

        @NotNull
        SupplierRiskEscalationPriority priority,

        @NotNull
        LocalDate dueDate,

        @NotBlank
        @Size(max = 2500)
        String rationale
) {
}
