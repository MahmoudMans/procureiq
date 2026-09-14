package com.procureiq.guidedbuying;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record PreferredSupplierInput(

        @NotBlank
        @Size(max = 120)
        String category,

        @NotNull
        UUID supplierId,

        @Min(1)
        @Max(99)
        int preferenceRank,

        @Size(max = 2000)
        String notes
) {
}
