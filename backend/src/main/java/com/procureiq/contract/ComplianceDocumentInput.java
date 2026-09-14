package com.procureiq.contract;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record ComplianceDocumentInput(

        UUID contractId,

        @NotBlank
        @Size(max = 120)
        String documentType,

        @NotBlank
        @Size(max = 200)
        String documentName,

        @Size(max = 200)
        String documentReference,

        boolean required,

        LocalDate issueDate,

        LocalDate expiryDate,

        @Size(max = 2000)
        String notes
) {
}
