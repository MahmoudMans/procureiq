package com.procureiq.approval;

import jakarta.validation.constraints.Size;

public record ApprovalDecisionInput(

        @Size(max = 2000)
        String comment
) {
}
