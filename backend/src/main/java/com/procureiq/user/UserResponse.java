package com.procureiq.user;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String fullName,
        String email,
        ProcurementRole role,
        String jobTitle,
        UUID departmentId,
        String departmentCode,
        String departmentName,
        boolean active,
        Instant createdAt
) {
    public static UserResponse from(
            AppUserEntity user
    ) {
        return new UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole(),
                user.getJobTitle(),
                user.getDepartment().getId(),
                user.getDepartment().getCode(),
                user.getDepartment().getName(),
                user.isActive(),
                user.getCreatedAt()
        );
    }
}
