package com.procureiq.supplieronboarding;

import java.time.Instant;
import java.util.UUID;

public record QualificationQuestionResponse(
        UUID id,
        String questionCode,
        String questionLabel,
        boolean mandatory,
        String answerValue,
        QualificationComplianceStatus complianceStatus,
        UUID answeredByUserId,
        String answeredByName,
        Instant answeredAt
) {
}
