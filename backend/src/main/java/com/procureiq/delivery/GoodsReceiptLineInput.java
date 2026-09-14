package com.procureiq.delivery;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.UUID;

public record GoodsReceiptLineInput(

        @NotNull
        UUID purchaseOrderLineId,

        @NotNull
        @DecimalMin("0.001")
        BigDecimal quantityReceived
) {
}
