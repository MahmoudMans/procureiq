package com.procureiq.fundingexecution;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record FundingGateInput(

        @NotBlank
        @Size(max = 300)
        String title,

        @NotBlank
        @Size(max = 4000)
        String requirement
) {
}
