package com.procureiq.dataquality;

import java.math.BigDecimal;

public record DataQualityRuleResponse(
        long id,
        String ruleCode,
        DataQualityDomain domain,
        String title,
        String description,
        DataQualitySeverity severity,
        BigDecimal weight,
        boolean enabled,
        long activeFindings
) {
}
