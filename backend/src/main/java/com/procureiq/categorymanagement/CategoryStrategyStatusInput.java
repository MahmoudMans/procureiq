package com.procureiq.categorymanagement;

import jakarta.validation.constraints.NotNull;

public record CategoryStrategyStatusInput(

        @NotNull
        CategoryStrategyStatus status
) {
}
