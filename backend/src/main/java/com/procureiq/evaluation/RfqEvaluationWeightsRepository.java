package com.procureiq.evaluation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RfqEvaluationWeightsRepository
        extends JpaRepository<RfqEvaluationWeightsEntity, UUID> {

    Optional<RfqEvaluationWeightsEntity>
    findByRfq_Id(
            UUID rfqId
    );
}
