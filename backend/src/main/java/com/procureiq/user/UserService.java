package com.procureiq.user;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class UserService {

    private final AppUserRepository appUserRepository;

    public UserService(
            AppUserRepository appUserRepository
    ) {
        this.appUserRepository = appUserRepository;
    }

    public List<UserResponse> findAll() {
        return appUserRepository
                .findAllByOrderByFullNameAsc()
                .stream()
                .map(UserResponse::from)
                .toList();
    }
}
