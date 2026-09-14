package com.procureiq.evaluation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SupplierEvaluationRepository
        extends JpaRepository<SupplierEvaluationEntity, UUID> {

    List<SupplierEvaluationEntity>
    findAllByRfq_IdOrderByRankPositionAsc(
            UUID rfqId
    );

    void deleteAllByRfq_Id(
            UUID rfqId
    );
}
