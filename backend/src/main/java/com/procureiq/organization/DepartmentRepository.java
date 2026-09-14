package com.procureiq.organization;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DepartmentRepository
        extends JpaRepository<DepartmentEntity, UUID> {

    Optional<DepartmentEntity> findByCode(String code);

    List<DepartmentEntity> findAllByOrderByNameAsc();
}
