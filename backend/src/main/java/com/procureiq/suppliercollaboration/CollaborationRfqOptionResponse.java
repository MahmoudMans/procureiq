package com.procureiq.suppliercollaboration;

import java.util.UUID;

public record CollaborationRfqOptionResponse(
        UUID id,
        String rfqNumber
) {
}
