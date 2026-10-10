package com.procureiq.supplierportal;

import com.procureiq.quotation.QuotationLineInput;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Commercial terms a supplier enters in the portal. The supplier is taken from the
 * portal session, never from the request body.
 */
public record SupplierPortalQuotationInput(

        @Min(0)
        int leadTimeDays,

        @NotBlank
        @Size(max = 300)
        String paymentTerms,

        @NotNull
        @FutureOrPresent
        LocalDate validityDate,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal discountAmount,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal shippingAmount,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal taxAmount,

        @NotEmpty
        @Size(max = 100)
        List<
                @Valid
                QuotationLineInput
                > lines
) {
}
