package com.procureiq.evaluation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record RfqEvaluationInput(

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal priceWeight,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal deliveryWeight,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal supplierRatingWeight,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal riskWeight,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal qualityWeight,

        @NotEmpty
        List<
                @Valid
                SupplierQualityScoreInput
                > qualityScores
) {
}
