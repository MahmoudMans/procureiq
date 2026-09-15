package com.procureiq.strategyrecovery;

import java.util.List;

public record RecoveryCaseDetailResponse(
        RecoveryCaseResponse recoveryCase,
        List<RecoveryActionResponse> actions,
        List<RecoveryCheckpointResponse> checkpoints,
        List<RecoveryEscalationResponse> escalations
) {
}
