package com.procureiq.purchaserequest;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PurchaseRequestRepository
        extends JpaRepository<PurchaseRequestEntity, UUID> {

    @Query(
            value = """
                    SELECT nextval('purchase_request_number_seq')
                    """,
            nativeQuery = true
    )
    Long nextRequestSequence();

    @EntityGraph(
            attributePaths = {
                    "requester",
                    "department",
                    "items"
            }
    )
    @Query("""
            select distinct request
            from PurchaseRequestEntity request
            where (
                    :privileged = true
                    or request.requester.id = :userId
            )
            and (
                    :query is null
                    or lower(request.requestNumber)
                        like lower(concat('%', cast(:query as string), '%'))
                    or lower(request.title)
                        like lower(concat('%', cast(:query as string), '%'))
                    or lower(coalesce(request.description, ''))
                        like lower(concat('%', cast(:query as string), '%'))
                    or lower(request.costCenter)
                        like lower(concat('%', cast(:query as string), '%'))
            )
            and (
                    :status is null
                    or request.status = :status
            )
            order by request.updatedAt desc
            """)
    List<PurchaseRequestEntity> searchVisible(
            @Param("userId")
            UUID userId,

            @Param("privileged")
            boolean privileged,

            @Param("query")
            String query,

            @Param("status")
            PurchaseRequestStatus status
    );

    @EntityGraph(
            attributePaths = {
                    "requester",
                    "department",
                    "items"
            }
    )
    @Query("""
            select request
            from PurchaseRequestEntity request
            where request.id = :id
            """)
    Optional<PurchaseRequestEntity> findDetailedById(
            @Param("id")
            UUID id
    );
}
