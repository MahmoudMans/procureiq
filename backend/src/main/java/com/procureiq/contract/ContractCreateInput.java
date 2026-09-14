package com.procureiq.contract;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record ContractCreateInput(

        @NotNull
        UUID supplierId,

        @NotBlank
        @Size(max = 200)
        String title,

        @NotBlank
        @Size(max = 100)
        String contractType,

        @NotNull
        LocalDate startDate,

        @NotNull
        @Future
        LocalDate endDate,

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal contractValue,

        boolean autoRenew,

        @PositiveOrZero
        int noticePeriodDays,

        @Size(max = 2000)
        String notes
) {
}
