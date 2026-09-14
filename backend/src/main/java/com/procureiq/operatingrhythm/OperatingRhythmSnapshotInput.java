package com.procureiq.operatingrhythm;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record OperatingRhythmSnapshotInput(

        @NotBlank
        @Size(min = 3, max = 3)
        String currency,

        @NotNull
        LocalDate periodStart,

        @NotNull
        LocalDate periodEnd
) {
}
