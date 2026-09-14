package com.procureiq.organization;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@Transactional(readOnly = true)
public class DepartmentService {

    private final DepartmentRepository departmentRepository;

    public DepartmentService(
            DepartmentRepository departmentRepository
    ) {
        this.departmentRepository = departmentRepository;
    }

    public List<DepartmentResponse> findAll() {
        return departmentRepository
                .findAllByOrderByNameAsc()
                .stream()
                .map(DepartmentResponse::from)
                .toList();
    }
}
