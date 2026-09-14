package com.procureiq.risk;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProcurementRiskCaseRepository
        extends JpaRepository<ProcurementRiskCaseEntity, UUID> {

    @Query(
            value = """
                    SELECT nextval(
                        'procurement_risk_number_seq'
                    )
                    """,
            nativeQuery = true
    )
    Long nextRiskSequence();

    Optional<ProcurementRiskCaseEntity>
    findBySourceKey(
            String sourceKey
    );

    List<ProcurementRiskCaseEntity>
    findAllByOrderByUpdatedAtDesc();
}
