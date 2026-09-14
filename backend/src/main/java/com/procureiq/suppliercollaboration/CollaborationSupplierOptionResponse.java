package com.procureiq.suppliercollaboration;

import java.util.UUID;

public record CollaborationSupplierOptionResponse(
        UUID id,
        String supplierCode,
        String supplierName,
        String status
) {
}
