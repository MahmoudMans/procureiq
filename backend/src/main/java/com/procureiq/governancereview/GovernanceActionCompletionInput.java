package com.procureiq.governancereview;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GovernanceActionCompletionInput(

        @NotBlank
        @Size(max = 2500)
        String note
) {
}
