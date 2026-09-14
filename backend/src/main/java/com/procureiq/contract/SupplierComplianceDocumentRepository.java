package com.procureiq.contract;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SupplierComplianceDocumentRepository
        extends JpaRepository<SupplierComplianceDocumentEntity, UUID> {

    List<SupplierComplianceDocumentEntity>
    findAllBySupplier_IdOrderByExpiryDateAsc(
            UUID supplierId
    );

    List<SupplierComplianceDocumentEntity>
    findAllByContract_IdOrderByExpiryDateAsc(
            UUID contractId
    );
}
