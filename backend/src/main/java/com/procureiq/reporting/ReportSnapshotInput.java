package com.procureiq.reporting;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record ReportSnapshotInput(

        @NotNull
        ReportType reportType,

        LocalDate periodStart,

        LocalDate periodEnd,

        @NotBlank
        @Size(max = 200)
        String label
) {
}
