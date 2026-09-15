package com.procureiq.strategycockpit;

import java.math.BigDecimal;

public record WeightedBoardDimension(
        BoardDimensionKey key,
        BigDecimal score,
        BigDecimal weightPct
) {
}
