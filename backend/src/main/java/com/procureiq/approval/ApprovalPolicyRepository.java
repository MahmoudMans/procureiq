package com.procureiq.approval;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public interface ApprovalPolicyRepository
        extends JpaRepository<ApprovalPolicyEntity, UUID> {

    @Query("""
            select policy
            from ApprovalPolicyEntity policy
            where policy.active = true
              and policy.minimumAmount <= :amount
              and (
                    policy.maximumAmount is null
                    or policy.maximumAmount >= :amount
              )
            order by policy.priority asc
            """)
    List<ApprovalPolicyEntity> findMatchingPolicies(
            @Param("amount")
            BigDecimal amount
    );
}
