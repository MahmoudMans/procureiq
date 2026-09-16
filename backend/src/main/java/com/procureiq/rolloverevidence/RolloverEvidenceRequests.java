package com.procureiq.rolloverevidence;

import jakarta.validation.constraints.*;
import java.time.LocalDate;
import java.util.UUID;

public final class RolloverEvidenceRequests {
    private RolloverEvidenceRequests() { }

    public record Open(
        UUID rolloverCaseId,
        UUID parentCycleId
    ) { }

    public record Plan(
        @NotNull UUID itemId,
        @NotNull @Min(0) Long version,
        @NotNull LocalDate targetDate,
        @NotBlank @Size(max=2500) String rationale
    ) { }

    public record Observation(
        @NotNull UUID itemId,
        @NotNull @Min(0) Long version,
        @NotBlank
        @Pattern(
            regexp="RECOVERY_CONFIRMED|WRITE_OFF_CONFIRMED|INVESTIGATION_CONCLUDED|RISK_ACCEPTANCE_CONFIRMED|PARTIAL|UNRESOLVED"
        )
        String resolutionType,
        @NotBlank
        @Pattern(regexp="[0-9]{1,18}(\\.[0-9]{1,2})?")
        String reductionAmount,
        @NotNull LocalDate observedOn,
        @NotBlank @Size(max=500) String evidenceReference,
        @NotBlank @Size(max=2500) String evidenceNote
    ) { }

    public record Transition(
        @NotNull @Min(0) Long version,
        @NotBlank
        @Pattern(
            regexp="submit-plan|approve-plan|close-governance|submit-evidence|verify-evidence|close-evidence"
        )
        String operation,
        @NotBlank @Size(max=2500) String note
    ) { }
}
