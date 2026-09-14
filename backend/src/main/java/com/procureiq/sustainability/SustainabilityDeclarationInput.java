package com.procureiq.sustainability;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record SustainabilityDeclarationInput(

        @NotBlank
        @Size(max = 500)
        String documentReference,

        LocalDate expiryDate
) {
}
