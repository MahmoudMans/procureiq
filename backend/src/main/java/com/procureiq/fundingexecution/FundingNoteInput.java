package com.procureiq.fundingexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FundingNoteInput(

        @NotBlank
        @Size(max = 5000)
        String note
) {
}
