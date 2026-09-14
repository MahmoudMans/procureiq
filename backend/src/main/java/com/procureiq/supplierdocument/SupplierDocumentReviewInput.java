package com.procureiq.supplierdocument;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierDocumentReviewInput(

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
