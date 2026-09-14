package com.procureiq.delivery;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SupplierDeliveryPerformanceRepository
        extends JpaRepository<SupplierDeliveryPerformanceEntity, UUID> {

    Optional<SupplierDeliveryPerformanceEntity>
    findBySupplier_Id(
            UUID supplierId
    );
}
