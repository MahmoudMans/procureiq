package com.procureiq.supplierportal;

import com.procureiq.suppliercollaboration.CollaborationMessageType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SupplierPortalResponseInput(

        @NotNull
        CollaborationMessageType messageType,

        @NotBlank
        @Size(max = 5000)
        String body,

        @Size(max = 1000)
        String referenceText
) {
}
