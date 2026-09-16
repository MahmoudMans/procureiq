package com.procureiq.rolloverevidence;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;
import java.math.BigDecimal;

import static com.procureiq.rolloverevidence.RolloverEvidenceRequests.*;

@Service
@Transactional
public class RolloverEvidenceService {
    private final RolloverEvidenceRepository repository;

    public RolloverEvidenceService(RolloverEvidenceRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly=true)
    public String dashboard(UUID actor) {
        return repository.scalar(
            "SELECT procureiq_rce91_dashboard(?::uuid)::text",
            actor
        );
    }

    @Transactional(readOnly=true)
    public String detail(UUID id, UUID actor) {
        return repository.scalar(
            "SELECT procureiq_rce91_detail(?::uuid,?::uuid)::text",
            id, actor
        );
    }

    @Transactional(readOnly=true)
    public String snapshot(UUID id, UUID actor) {
        return repository.scalar(
            "SELECT procureiq_rce91_snapshot(?::uuid,?::uuid)::text",
            id, actor
        );
    }

    public String open(UUID actor, Open input) {
        UUID id = UUID.fromString(
            repository.scalar(
                "SELECT procureiq_rce91_open(?::uuid,?::uuid,?::uuid)::text",
                input.rolloverCaseId(),
                input.parentCycleId(),
                actor
            )
        );

        return detail(id, actor);
    }

    public String plan(UUID id, UUID actor, Plan input) {
        repository.execute(
            "SELECT procureiq_rce91_plan(?::uuid,?::uuid,?::bigint,?::uuid,?::date,?::text)",
            id,
            input.itemId(),
            input.version(),
            actor,
            input.targetDate(),
            input.rationale()
        );

        return detail(id, actor);
    }

    public String observe(UUID id, UUID actor, Observation input) {
        repository.execute(
            "SELECT procureiq_rce91_observe(?::uuid,?::uuid,?::bigint,?::uuid,?::text,?::numeric,?::date,?::text,?::text)",
            id,
            input.itemId(),
            input.version(),
            actor,
            input.resolutionType(),
            new BigDecimal(input.reductionAmount()),
            input.observedOn(),
            input.evidenceReference(),
            input.evidenceNote()
        );

        return detail(id, actor);
    }

    public String transition(UUID id, UUID actor, Transition input) {
        repository.execute(
            "SELECT procureiq_rce91_transition(?::uuid,?::bigint,?::uuid,?::text,?::text)",
            id,
            input.version(),
            actor,
            input.operation(),
            input.note()
        );

        return detail(id, actor);
    }

    public String capture(UUID id, UUID actor) {
        UUID snapshotId = UUID.fromString(
            repository.scalar(
                "SELECT procureiq_rce91_capture(?::uuid,?::uuid)::text",
                id,
                actor
            )
        );

        return snapshot(snapshotId, actor);
    }
}
