package com.procureiq.auth;

import com.procureiq.user.UserResponse;

import java.time.Instant;

public record AuthLoginResponse(
        String accessToken,
        String tokenType,
        Instant expiresAt,
        UserResponse user
) {
}
