package com.procureiq.organization;

import java.util.UUID;

public record DepartmentResponse(
        UUID id,
        String code,
        String name,
        String description
) {
    public static DepartmentResponse from(
            DepartmentEntity department
    ) {
        return new DepartmentResponse(
                department.getId(),
                department.getCode(),
                department.getName(),
                department.getDescription()
        );
    }
}
