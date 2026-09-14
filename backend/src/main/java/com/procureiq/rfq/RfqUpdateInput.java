package com.procureiq.rfq;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

public record RfqUpdateInput(

        @NotBlank
        @Size(max = 200)
        String title,

        @Size(max = 3000)
        String description,

        @NotNull
        @Future
        LocalDateTime responseDeadline,

        @NotEmpty
        @Size(max = 50)
        List<@NotNull UUID> supplierIds
) {
}
