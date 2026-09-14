package com.procureiq.supplier;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record SupplierUpdateRequest(

        @NotBlank
        @Size(max = 160)
        String legalName,

        @Size(max = 160)
        String tradingName,

        @Email
        @Size(max = 200)
        String contactEmail,

        @Size(max = 50)
        String phone,

        @Size(max = 300)
        String website,

        @NotBlank
        @Size(max = 100)
        String country,

        @Size(max = 100)
        String city,

        @NotBlank
        @Size(max = 120)
        String category,

        @NotNull
        SupplierStatus status,

        @NotNull
        SupplierRiskLevel riskLevel,

        @DecimalMin("0.00")
        @DecimalMax("5.00")
        BigDecimal rating,

        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal onTimeDeliveryRate
) {
}
