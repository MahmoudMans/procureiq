package com.procureiq.organization;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "departments")
public class DepartmentEntity {

    @Id
    private UUID id;

    @Column(
            name = "code",
            nullable = false,
            unique = true,
            length = 40
    )
    private String code;

    @Column(
            name = "name",
            nullable = false,
            unique = true,
            length = 120
    )
    private String name;

    @Column(
            name = "description",
            length = 500
    )
    private String description;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false
    )
    private Instant createdAt;

    public UUID getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
