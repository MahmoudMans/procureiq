package com.procureiq.continuousimprovement;

import java.util.List;

public record ImprovementContextResponse(
        List<ImprovementSnapshotOptionResponse> snapshots,
        ImprovementSnapshotOptionResponse selectedSnapshot,
        List<ImprovementDimensionOptionResponse> dimensions,
        List<ImprovementUserOptionResponse> users
) {
}
