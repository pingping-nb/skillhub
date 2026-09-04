package com.iflytek.skillhub.auth.ldap;

import com.iflytek.skillhub.auth.entity.IdentityBinding;
import com.iflytek.skillhub.auth.oauth.AccountDisabledException;
import com.iflytek.skillhub.auth.oauth.AccountMergedException;
import com.iflytek.skillhub.auth.oauth.AccountPendingException;
import com.iflytek.skillhub.auth.oauth.SystemAccountLoginException;
import com.iflytek.skillhub.auth.rbac.PlatformPrincipal;
import com.iflytek.skillhub.auth.rbac.PlatformRoleDefaults;
import com.iflytek.skillhub.auth.repository.IdentityBindingRepository;
import com.iflytek.skillhub.auth.repository.UserRoleBindingRepository;
import com.iflytek.skillhub.domain.event.UserActivatedEvent;
import com.iflytek.skillhub.domain.namespace.GlobalNamespaceMembershipService;
import com.iflytek.skillhub.domain.user.UserAccount;
import com.iflytek.skillhub.domain.user.UserAccountRepository;
import com.iflytek.skillhub.domain.user.UserStatus;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionOperations;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Resolves LDAP-authenticated identities to platform users, creating or
 * updating bindings and user records as needed.
 *
 * <p>LDAP identities use the stable provider code {@code ldap} and the LDAP
 * UID attribute as the external subject. No account merging is performed.
 */
@Service
public class LdapIdentityService {

    public static final String PROVIDER_CODE = "ldap";

    private final IdentityBindingRepository bindingRepo;
    private final UserAccountRepository userRepo;
    private final UserRoleBindingRepository roleBindingRepo;
    private final GlobalNamespaceMembershipService globalNamespaceMembershipService;
    private final ApplicationEventPublisher eventPublisher;
    private final TransactionOperations transactions;

    public LdapIdentityService(IdentityBindingRepository bindingRepo,
                               UserAccountRepository userRepo,
                               UserRoleBindingRepository roleBindingRepo,
                               GlobalNamespaceMembershipService globalNamespaceMembershipService,
                               ApplicationEventPublisher eventPublisher,
                               PlatformTransactionManager transactionManager) {
        this.bindingRepo = bindingRepo;
        this.userRepo = userRepo;
        this.roleBindingRepo = roleBindingRepo;
        this.globalNamespaceMembershipService = globalNamespaceMembershipService;
        this.eventPublisher = eventPublisher;
        this.transactions = requiresNewTransactions(transactionManager);
    }

    /**
     * Resolves or creates a platform user for the given LDAP identity and
     * returns the corresponding {@link PlatformPrincipal}.
     */
    public PlatformPrincipal resolveOrCreate(LdapUser ldapUser) {
        try {
            return transactions.execute(status -> resolveOrCreateInTransaction(ldapUser));
        } catch (DataIntegrityViolationException conflict) {
            PlatformPrincipal winner = transactions.execute(status -> resolveConcurrentWinner(ldapUser));
            if (winner != null) {
                return winner;
            }
            throw conflict;
        }
    }

    private PlatformPrincipal resolveOrCreateInTransaction(LdapUser ldapUser) {
        IdentityBinding binding = bindingRepo
            .findByProviderCodeAndSubject(PROVIDER_CODE, ldapUser.uid())
            .orElse(null);

        UserAccount user;
        if (binding != null) {
            user = userRepo.findById(binding.getUserId())
                .orElseThrow(() -> new IllegalStateException("User not found for binding"));
            ensureLoginAllowed(user);
            user.setDisplayName(ldapUser.displayName());
            if (ldapUser.email() != null && !ldapUser.email().isBlank()) {
                user.setEmail(ldapUser.email());
            }
            user = userRepo.save(user);
        } else {
            user = new UserAccount(
                "usr_" + UUID.randomUUID(),
                ldapUser.displayName(),
                blankToNull(ldapUser.email()),
                null
            );
            user.setStatus(UserStatus.ACTIVE);
            user = userRepo.save(user);

            binding = new IdentityBinding(user.getId(), PROVIDER_CODE, ldapUser.uid(), ldapUser.username());
            bindingRepo.saveAndFlush(binding);
            globalNamespaceMembershipService.ensureMember(user.getId());
            eventPublisher.publishEvent(
                new UserActivatedEvent(user.getId(), ldapUser.displayName(), ldapUser.email()));
        }

        ensureLoginAllowed(user);

        Set<String> roles = roleBindingRepo.findByUserId(user.getId()).stream()
            .map(rb -> rb.getRole().getCode())
            .collect(Collectors.toSet());
        roles = PlatformRoleDefaults.withDefaultUserRole(roles);

        return new PlatformPrincipal(
            user.getId(), user.getDisplayName(), user.getEmail(),
            user.getAvatarUrl(), PROVIDER_CODE, roles
        );
    }

    private PlatformPrincipal resolveConcurrentWinner(LdapUser ldapUser) {
        IdentityBinding binding = bindingRepo
            .findByProviderCodeAndSubject(PROVIDER_CODE, ldapUser.uid())
            .orElse(null);
        if (binding == null) {
            return null;
        }
        UserAccount user = userRepo.findById(binding.getUserId())
            .orElseThrow(() -> new IllegalStateException("User not found for binding"));
        ensureLoginAllowed(user);
        Set<String> roles = roleBindingRepo.findByUserId(user.getId()).stream()
            .map(rb -> rb.getRole().getCode())
            .collect(Collectors.toSet());
        roles = PlatformRoleDefaults.withDefaultUserRole(roles);
        return new PlatformPrincipal(
            user.getId(), user.getDisplayName(), user.getEmail(),
            user.getAvatarUrl(), PROVIDER_CODE, roles
        );
    }

    private static TransactionOperations requiresNewTransactions(PlatformTransactionManager transactionManager) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return template;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private void ensureLoginAllowed(UserAccount user) {
        if (user.isSystemAccount()) {
            throw new SystemAccountLoginException();
        }
        if (user.getStatus() == UserStatus.PENDING) {
            throw new AccountPendingException();
        }
        if (user.getStatus() == UserStatus.DISABLED) {
            throw new AccountDisabledException();
        }
        if (user.getStatus() == UserStatus.MERGED) {
            throw new AccountMergedException();
        }
    }
}
