package com.procureiq.strategicokr;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record OkrCancellationInput(

        @NotBlank
        @Size(max = 3000)
        String note
) {
}
