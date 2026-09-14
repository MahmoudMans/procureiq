package com.procureiq.supplier;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SupplierRepository
        extends JpaRepository<SupplierEntity, UUID> {

    boolean existsBySupplierCodeIgnoreCase(
            String supplierCode
    );

    Optional<SupplierEntity> findByIdAndActiveTrue(
            UUID id
    );

    List<SupplierEntity>
    findAllByActiveTrueOrderByLegalNameAsc();

    @Query("""
            select supplier
            from SupplierEntity supplier
            where supplier.active = true
              and (
                    :query is null
                    or lower(supplier.supplierCode)
                        like lower(concat('%', :query, '%'))
                    or lower(supplier.legalName)
                        like lower(concat('%', :query, '%'))
                    or lower(coalesce(supplier.tradingName, ''))
                        like lower(concat('%', :query, '%'))
                    or lower(supplier.category)
                        like lower(concat('%', :query, '%'))
                    or lower(supplier.country)
                        like lower(concat('%', :query, '%'))
              )
              and (
                    :status is null
                    or supplier.status = :status
              )
              and (
                    :riskLevel is null
                    or supplier.riskLevel = :riskLevel
              )
            order by supplier.legalName asc
            """)
    List<SupplierEntity> search(
            @Param("query") String query,
            @Param("status") SupplierStatus status,
            @Param("riskLevel")
            SupplierRiskLevel riskLevel
    );
}
