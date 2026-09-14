package com.procureiq.risk;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record RiskCaseCreateInput(

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        @Size(max = 3000)
        String description,

        @NotNull
        RiskCategory category,

        @Min(1)
        @Max(5)
        int likelihood,

        @Min(1)
        @Max(5)
        int impact,

        LocalDate dueDate,

        UUID ownerUserId,

        UUID supplierId,

        UUID contractId,

        UUID purchaseOrderId,

        UUID rfqId
) {
}
