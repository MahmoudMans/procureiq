package com.procureiq.categorymanagement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record CategoryMilestoneInput(

        @NotBlank
        @Size(max = 240)
        String title,

        @NotNull
        LocalDate dueDate
) {
}
