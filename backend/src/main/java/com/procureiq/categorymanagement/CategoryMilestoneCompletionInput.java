package com.procureiq.categorymanagement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CategoryMilestoneCompletionInput(

        @NotBlank
        @Size(max = 2000)
        String note
) {
}
