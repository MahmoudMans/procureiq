package com.procureiq.dataquality;

import java.util.List;

public record DataQualityContextResponse(
        List<DataQualityUserOptionResponse> users
) {
}
