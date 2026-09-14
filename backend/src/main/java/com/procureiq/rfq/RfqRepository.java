package com.procureiq.rfq;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RfqRepository
        extends JpaRepository<RfqEntity, UUID> {

    @Query(
            value = """
                    SELECT nextval('rfq_number_seq')
                    """,
            nativeQuery = true
    )
    Long nextRfqSequence();

    boolean existsBySourcePurchaseRequest_Id(
            UUID purchaseRequestId
    );

    @Query("""
            select rfq
            from RfqEntity rfq
            where (
                    :query is null
                    or lower(rfq.rfqNumber)
                        like lower(concat('%', :query, '%'))
                    or lower(rfq.title)
                        like lower(concat('%', :query, '%'))
                    or lower(
                        rfq.sourcePurchaseRequest.requestNumber
                    )
                        like lower(concat('%', :query, '%'))
            )
            and (
                    :status is null
                    or rfq.status = :status
            )
            order by rfq.updatedAt desc
            """)
    List<RfqEntity> search(
            @Param("query")
            String query,

            @Param("status")
            RfqStatus status
    );

    Optional<RfqEntity> findByRfqNumber(
            String rfqNumber
    );
}
