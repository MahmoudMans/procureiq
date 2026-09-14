package com.procureiq.evaluation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AwardDecisionRepository
        extends JpaRepository<AwardDecisionEntity, UUID> {

    Optional<AwardDecisionEntity>
    findByRfq_Id(
            UUID rfqId
    );

    boolean existsByRfq_Id(
            UUID rfqId
    );
}
