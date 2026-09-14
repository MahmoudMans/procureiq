package com.procureiq.approval;

import com.procureiq.user.ProcurementRole;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ApprovalTaskRepository
        extends JpaRepository<ApprovalTaskEntity, UUID> {

    boolean existsByPurchaseRequest_IdAndStatus(
            UUID purchaseRequestId,
            ApprovalTaskStatus status
    );

    Optional<ApprovalTaskEntity>
    findFirstByPurchaseRequest_IdAndStatus(
            UUID purchaseRequestId,
            ApprovalTaskStatus status
    );

    List<ApprovalTaskEntity>
    findAllByPurchaseRequest_IdOrderByRequestedAtAsc(
            UUID purchaseRequestId
    );

    @Query("""
            select task
            from ApprovalTaskEntity task
            where (
                    :admin = true
                    or task.requiredRole = :role
            )
            and (
                    :status is null
                    or task.status = :status
            )
            order by
                case
                    when task.status =
                        com.procureiq.approval.ApprovalTaskStatus.PENDING
                    then 0
                    else 1
                end asc,
                task.requestedAt desc
            """)
    List<ApprovalTaskEntity> findQueue(
            @Param("role")
            ProcurementRole role,

            @Param("admin")
            boolean admin,

            @Param("status")
            ApprovalTaskStatus status
    );
}
