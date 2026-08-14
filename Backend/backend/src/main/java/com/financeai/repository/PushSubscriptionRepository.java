package com.financeai.repository;

import com.financeai.model.PushSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PushSubscriptionRepository extends JpaRepository<PushSubscription, UUID> {

    Optional<PushSubscription> findByEndpoint(String endpoint);

    List<PushSubscription> findByUsuarioId(String usuarioId);

    @Modifying
    @Transactional
    void deleteByUsuarioIdAndEndpoint(String usuarioId, String endpoint);

    @Modifying
    @Transactional
    void deleteByEndpoint(String endpoint);
}
