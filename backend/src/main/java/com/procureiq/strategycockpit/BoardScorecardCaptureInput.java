package com.procureiq.strategycockpit;

import jakarta.validation.constraints.Size;

public record BoardScorecardCaptureInput(

        @Size(max = 4000)
        String boardCommentary
) {
}
