package com.procureiq.commandcenter;

public record CommandCenterBreakdownResponse(
        CommandCenterActionType type,
        long total,
        long critical,
        long high,
        long overdue
) {
}
