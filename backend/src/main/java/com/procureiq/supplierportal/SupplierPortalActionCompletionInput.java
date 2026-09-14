package com.procureiq.supplierportal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierPortalActionCompletionInput(

        @NotBlank
        @Size(max = 2500)
        String note,

        @Size(max = 1000)
        String referenceText
) {
}
