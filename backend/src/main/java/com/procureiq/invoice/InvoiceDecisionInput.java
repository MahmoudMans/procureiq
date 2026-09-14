package com.procureiq.invoice;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InvoiceDecisionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
