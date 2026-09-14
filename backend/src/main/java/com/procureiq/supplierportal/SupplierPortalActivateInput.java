package com.procureiq.supplierportal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupplierPortalActivateInput(

        @NotBlank
        @Size(max = 500)
        String invitationToken,

        @NotBlank
        @Size(min = 12, max = 128)
        String password
) {
}
