package com.procureiq.dataquality;

import java.math.BigDecimal;

public record DataQualityDomainScoreResponse(
        DataQualityDomain domain,
        long enabledRules,
        long affectedRules,
        long openFindings,
        BigDecimal score
) {
}
