package com.procureiq.purchaseorder;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record PurchaseOrderUpdateInput(

        @NotNull
        @FutureOrPresent
        LocalDate expectedDeliveryDate,

        @NotBlank
        @Size(max = 1000)
        String deliveryAddress,

        @Size(max = 2000)
        String buyerNotes
) {
}
