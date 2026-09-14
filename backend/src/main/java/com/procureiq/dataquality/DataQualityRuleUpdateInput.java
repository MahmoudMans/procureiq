package com.procureiq.dataquality;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record DataQualityRuleUpdateInput(

        boolean enabled,

        @NotNull
        DataQualitySeverity severity,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal weight
) {
}
