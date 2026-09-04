package com.iflytek.skillhub.auth.ldap;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.iflytek.skillhub.auth.entity.IdentityBinding;
import com.iflytek.skillhub.auth.repository.IdentityBindingRepository;
import com.iflytek.skillhub.auth.repository.UserRoleBindingRepository;
import com.iflytek.skillhub.auth.rbac.PlatformPrincipal;
import com.iflytek.skillhub.domain.event.UserActivatedEvent;
import com.iflytek.skillhub.domain.namespace.GlobalNamespaceMembershipService;
import com.iflytek.skillhub.domain.user.UserAccount;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
class LdapIdentityServiceTest {

    @Mock
    private IdentityBindingRepository bindingRepo;

    @Mock
    private UserAccountRepository userRepo;

    @Mock
    private UserRoleBindingRepository roleBindingRepo;

    @Mock
    private GlobalNamespaceMembershipService globalNamespaceMembershipService;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private PlatformTransactionManager transactionManager;

    private LdapIdentityService service;

    @BeforeEach
    void setUp() {
        given(transactionManager.getTransaction(any())).willReturn(new org.springframework.transaction.support.DefaultTransactionStatus(
            new Object(), true, true, false, false, null));
        service = new LdapIdentityService(
            bindingRepo,
            userRepo,
            roleBindingRepo,
            globalNamespaceMembershipService,
            eventPublisher,
            transactionManager
        );
    }

    @Test
    void resolveOrCreate_createsNewUserOnFirstLogin() {
        LdapUser ldapUser = new LdapUser("uid-123", "alice", "Alice", "alice@example.com");

        given(bindingRepo.findByProviderCodeAndSubject("ldap", "uid-123")).willReturn(Optional.empty());
        given(userRepo.save(any(UserAccount.class))).willAnswer(inv -> inv.getArgument(0));
        given(bindingRepo.saveAndFlush(any(IdentityBinding.class))).willAnswer(inv -> inv.getArgument(0));
        given(roleBindingRepo.findByUserId(any())).willReturn(List.of());

        PlatformPrincipal principal = service.resolveOrCreate(ldapUser);

        assertThat(principal.userId()).startsWith("usr_");
        assertThat(principal.displayName()).isEqualTo("Alice");
        assertThat(principal.email()).isEqualTo("alice@example.com");
        assertThat(principal.oauthProvider()).isEqualTo("ldap");
        assertThat(principal.platformRoles()).contains("USER");

        verify(globalNamespaceMembershipService).ensureMember(principal.userId());
        verify(eventPublisher).publishEvent(any(UserActivatedEvent.class));
    }

    @Test
    void resolveOrCreate_reusesExistingBinding() {
        LdapUser ldapUser = new LdapUser("uid-123", "alice", "Alice Updated", "alice@example.com");
        UserAccount existing = new UserAccount("usr_existing", "Alice", "old@example.com", null);
        IdentityBinding binding = new IdentityBinding("usr_existing", "ldap", "uid-123", "alice");

        given(bindingRepo.findByProviderCodeAndSubject("ldap", "uid-123")).willReturn(Optional.of(binding));
        given(userRepo.findById("usr_existing")).willReturn(Optional.of(existing));
        given(userRepo.save(any(UserAccount.class))).willAnswer(inv -> inv.getArgument(0));
        given(roleBindingRepo.findByUserId("usr_existing")).willReturn(List.of());

        PlatformPrincipal principal = service.resolveOrCreate(ldapUser);

        assertThat(principal.userId()).isEqualTo("usr_existing");
        assertThat(principal.displayName()).isEqualTo("Alice Updated");
        assertThat(principal.email()).isEqualTo("alice@example.com");
    }
}
