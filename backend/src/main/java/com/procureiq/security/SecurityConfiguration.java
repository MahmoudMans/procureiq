package com.procureiq.security;

import javax.crypto.SecretKey;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.server.resource.web.BearerTokenResolver;
import org.springframework.security.oauth2.server.resource.web.DefaultBearerTokenResolver;
import org.springframework.security.web.SecurityFilterChain;

import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.List;

@Configuration
@EnableMethodSecurity
@EnableConfigurationProperties(
        JwtProperties.class
)
public class SecurityConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecretKey jwtSecretKey(
            JwtProperties properties
    ) {
        byte[] secretBytes =
                properties
                        .secret()
                        .getBytes(
                                StandardCharsets.UTF_8
                        );

        if (secretBytes.length < 32) {
            throw new IllegalStateException(
                    "PROCUREIQ JWT secret must contain at least 32 bytes."
            );
        }

        return new SecretKeySpec(
                secretBytes,
                "HmacSHA256"
        );
    }

    @Bean
    JwtEncoder jwtEncoder(
            SecretKey jwtSecretKey
    ) {
        return NimbusJwtEncoder
                .withSecretKey(
                        jwtSecretKey
                )
                .algorithm(
                        MacAlgorithm.HS256
                )
                .build();
    }

    @Bean
    JwtDecoder jwtDecoder(
            SecretKey jwtSecretKey,
            JwtProperties properties
    ) {
        NimbusJwtDecoder decoder =
                NimbusJwtDecoder
                        .withSecretKey(
                                jwtSecretKey
                        )
                        .macAlgorithm(
                                MacAlgorithm.HS256
                        )
                        .build();

        decoder.setJwtValidator(
                JwtValidators
                        .createDefaultWithIssuer(
                                properties.issuer()
                        )
        );

        return decoder;
    }

    @Bean
    Converter<
            Jwt,
            ? extends AbstractAuthenticationToken
            > jwtAuthenticationConverter() {

        return jwt -> {
            List<String> roles =
                    jwt.getClaimAsStringList(
                            "roles"
                    );

            if (roles == null) {
                roles = List.of();
            }

            Collection<GrantedAuthority>
                    authorities =
                    roles.stream()
                            .map(
                                    role ->
                                            (GrantedAuthority)
                                                    new SimpleGrantedAuthority(
                                                            role
                                                    )
                            )
                            .toList();

            String principalName =
                    jwt.getClaimAsString(
                            "email"
                    );

            if (principalName == null) {
                principalName =
                        jwt.getSubject();
            }

            return new JwtAuthenticationToken(
                    jwt,
                    authorities,
                    principalName
            );
        };
    }

    /**
     * Supplier portal requests carry an opaque portal session token in the Authorization
     * header, not a signed JWT. Without this, the JWT filter tries to parse that token and
     * rejects the request with 401 before the portal controllers ever see it.
     *
     * Only /api/v1/supplier-portal/ is excluded (note the trailing slash, so the staff
     * endpoint /api/v1/supplier-portal-admin still requires a staff token). Those paths are
     * already permitAll; the portal controllers validate their own session tokens.
     */
    @Bean
    BearerTokenResolver portalAwareBearerTokenResolver() {
        DefaultBearerTokenResolver delegate =
                new DefaultBearerTokenResolver();

        return request ->
                request.getRequestURI()
                        .startsWith(
                                "/api/v1/supplier-portal/"
                        )
                        ? null
                        : delegate.resolve(
                                request
                        );
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            Converter<
                    Jwt,
                    ? extends AbstractAuthenticationToken
                    > jwtAuthenticationConverter,
            BearerTokenResolver portalAwareBearerTokenResolver
    ) throws Exception {

        http
                .csrf(
                        csrf ->
                                csrf.disable()
                )
                .cors(
                        Customizer
                                .withDefaults()
                )
                .sessionManagement(
                        sessions ->
                                sessions
                                        .sessionCreationPolicy(
                                                SessionCreationPolicy
                                                        .STATELESS
                                        )
                )
                .authorizeHttpRequests(
                        authorization ->
                                authorization
                                        .requestMatchers(
                                                HttpMethod.OPTIONS,
                                                "/**"
                                        )
                                        .permitAll()
                                        .requestMatchers(
                                                "/api/v1/auth/login",
                                                "/actuator/health"
                                        )
                                        .permitAll()
                                        .requestMatchers("/api/v1/supplier-portal/**").permitAll()
                    .anyRequest().authenticated()
                )
                .oauth2ResourceServer(
                        oauth2 ->
                                oauth2
                                        .bearerTokenResolver(
                                                portalAwareBearerTokenResolver
                                        )
                                        .jwt(
                                                jwt ->
                                                        jwt
                                                                .jwtAuthenticationConverter(
                                                                        jwtAuthenticationConverter
                                                                )
                                        )
                                        .authenticationEntryPoint(
                                                (
                                                        request,
                                                        response,
                                                        exception
                                                ) -> {
                                                    response.setStatus(401);
                                                    response.setContentType(
                                                            "application/problem+json"
                                                    );
                                                    response.getWriter()
                                                            .write(
                                                                    """
                                                                    {
                                                                      "title":"Authentication required",
                                                                      "status":401,
                                                                      "detail":"A valid ProcureIQ access token is required."
                                                                    }
                                                                    """
                                                            );
                                                }
                                        )
                )
                .exceptionHandling(
                        exceptions ->
                                exceptions
                                        .accessDeniedHandler(
                                                (
                                                        request,
                                                        response,
                                                        exception
                                                ) -> {
                                                    response.setStatus(403);
                                                    response.setContentType(
                                                            "application/problem+json"
                                                    );
                                                    response.getWriter()
                                                            .write(
                                                                    """
                                                                    {
                                                                      "title":"Access denied",
                                                                      "status":403,
                                                                      "detail":"Your ProcureIQ role does not permit this operation."
                                                                    }
                                                                    """
                                                            );
                                                }
                                        )
                );

        return http.build();
    }
}
