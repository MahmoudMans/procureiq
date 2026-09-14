package com.procureiq.purchaserequest;

import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record PurchaseRequestInput(

        @NotBlank
        @Size(max = 200)
        String title,

        @Size(max = 2000)
        String description,

        @NotBlank
        @Size(max = 3000)
        String businessJustification,

        @NotBlank
        @Size(max = 80)
        String costCenter,

        @NotBlank
        @Pattern(
                regexp = "^[A-Za-z]{3}$",
                message = "Currency must contain exactly three letters."
        )
        String currency,

        @NotNull
        @FutureOrPresent
        LocalDate desiredDeliveryDate,

        @NotEmpty
        @Size(max = 50)
        List<
                @Valid
                PurchaseRequestItemInput
                > items
) {
}
