package com.procureiq.suppliercollaboration;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SupplierResponseInput(

        @NotNull
        CollaborationMessageType messageType,

        @NotBlank
        @Size(max = 220)
        String supplierContactName,

        @NotBlank
        @Size(max = 5000)
        String body,

        @Size(max = 1000)
        String referenceText
) {
}
