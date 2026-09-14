package com.procureiq.quotation;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface QuotationRepository
        extends JpaRepository<QuotationEntity, UUID> {

    @Query(
            value = """
                    SELECT nextval('quotation_number_seq')
                    """,
            nativeQuery = true
    )
    Long nextQuotationSequence();

    boolean existsByRfq_IdAndSupplier_Id(
            UUID rfqId,
            UUID supplierId
    );

    List<QuotationEntity>
    findAllByRfq_IdOrderByTotalAmountAsc(
            UUID rfqId
    );
}
