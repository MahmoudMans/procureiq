package com.procureiq.delivery;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record GoodsReceiptInput(

        @NotNull
        @PastOrPresent
        LocalDate receivedDate,

        @Size(max = 160)
        String deliveryReference,

        @Size(max = 2000)
        String notes,

        @NotEmpty
        List<
                @Valid
                GoodsReceiptLineInput
                > lines
) {
}
