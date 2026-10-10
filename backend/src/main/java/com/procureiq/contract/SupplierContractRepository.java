package com.procureiq.contract;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SupplierContractRepository
        extends JpaRepository<SupplierContractEntity, UUID> {

    @Query(
            value = """
                    SELECT nextval(
                        'supplier_contract_number_seq'
                    )
                    """,
            nativeQuery = true
    )
    Long nextContractSequence();

    @Query("""
            select contract
            from SupplierContractEntity contract
            where (
                    :query is null
                    or lower(
                        contract.contractNumber
                    )
                        like lower(
                            concat('%', cast(:query as string), '%')
                        )
                    or lower(
                        contract.title
                    )
                        like lower(
                            concat('%', cast(:query as string), '%')
                        )
                    or lower(
                        contract.supplier.legalName
                    )
                        like lower(
                            concat('%', cast(:query as string), '%')
                        )
            )
            and (
                    :status is null
                    or contract.status = :status
            )
            and (
                    :supplierId is null
                    or contract.supplier.id =
                        :supplierId
            )
            order by
                contract.updatedAt desc
            """)
    List<SupplierContractEntity> search(
            @Param("query")
            String query,

            @Param("status")
            ContractStatus status,

            @Param("supplierId")
            UUID supplierId
    );

    List<SupplierContractEntity>
    findAllBySupplier_IdOrderByEndDateDesc(
            UUID supplierId
    );
}
