package com.procureiq.risk;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface RiskMitigationActionRepository
        extends JpaRepository<RiskMitigationActionEntity, UUID> {
}
