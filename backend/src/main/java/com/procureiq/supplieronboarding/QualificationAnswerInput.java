package com.procureiq.supplieronboarding;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record QualificationAnswerInput(

        @NotBlank
        @Size(max = 2000)
        String answerValue,

        @NotNull
        QualificationComplianceStatus complianceStatus
) {
}
