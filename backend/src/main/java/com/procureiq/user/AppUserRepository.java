package com.procureiq.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AppUserRepository
        extends JpaRepository<AppUserEntity, UUID> {

    Optional<AppUserEntity> findByEmailIgnoreCase(
            String email
    );

    boolean existsByEmailIgnoreCase(
            String email
    );

    List<AppUserEntity> findAllByOrderByFullNameAsc();
}
