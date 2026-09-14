package com.procureiq.auth;

import com.procureiq.common.exception.ResourceNotFoundException;
import com.procureiq.security.JwtProperties;
import com.procureiq.user.AppUserEntity;
import com.procureiq.user.AppUserRepository;
import com.procureiq.user.UserResponse;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AuthenticationService {

    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final JwtProperties jwtProperties;

    public AuthenticationService(
            AppUserRepository appUserRepository,
            PasswordEncoder passwordEncoder,
            JwtEncoder jwtEncoder,
            JwtProperties jwtProperties
    ) {
        this.appUserRepository = appUserRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.jwtProperties = jwtProperties;
    }

    public AuthLoginResponse login(
            AuthLoginRequest request
    ) {
        String email =
                request.email()
                        .trim()
                        .toLowerCase();

        AppUserEntity user =
                appUserRepository
                        .findByEmailIgnoreCase(email)
                        .orElseThrow(
                                InvalidCredentialsException::new
                        );

        if (!user.isActive()) {
            throw new AccountInactiveException();
        }

        if (
                !passwordEncoder.matches(
                        request.password(),
                        user.getPasswordHash()
                )
        ) {
            throw new InvalidCredentialsException();
        }

        Instant issuedAt = Instant.now();

        Instant expiresAt =
                issuedAt.plus(
                        jwtProperties.accessTokenMinutes(),
                        ChronoUnit.MINUTES
                );

        JwtClaimsSet claims =
                JwtClaimsSet.builder()
                        .issuer(
                                jwtProperties.issuer()
                        )
                        .issuedAt(issuedAt)
                        .expiresAt(expiresAt)
                        .subject(
                                user.getId().toString()
                        )
                        .claim(
                                "email",
                                user.getEmail()
                        )
                        .claim(
                                "name",
                                user.getFullName()
                        )
                        .claim(
                                "roles",
                                List.of(
                                        "ROLE_"
                                                + user.getRole()
                                                        .name()
                                )
                        )
                        .claim(
                                "department",
                                user.getDepartment()
                                        .getCode()
                        )
                        .build();

        JwsHeader header =
                JwsHeader
                        .with(MacAlgorithm.HS256)
                        .type("JWT")
                        .build();

        String accessToken =
                jwtEncoder
                        .encode(
                                JwtEncoderParameters
                                        .from(
                                                header,
                                                claims
                                        )
                        )
                        .getTokenValue();

        return new AuthLoginResponse(
                accessToken,
                "Bearer",
                expiresAt,
                UserResponse.from(user)
        );
    }

    public UserResponse findCurrentUser(
            String subject
    ) {
        UUID userId;

        try {
            userId = UUID.fromString(subject);
        } catch (IllegalArgumentException exception) {
            throw new InvalidCredentialsException();
        }

        AppUserEntity user =
                appUserRepository
                        .findById(userId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Authenticated user no longer exists."
                                        )
                        );

        if (!user.isActive()) {
            throw new AccountInactiveException();
        }

        return UserResponse.from(user);
    }
}
