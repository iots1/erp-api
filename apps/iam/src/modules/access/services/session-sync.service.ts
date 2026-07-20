import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { SessionStoreService } from '@lib/common/services/session-store.service';
import { ConfigService } from '@lib/config';

import { Role } from '../../roles/entities/role.entity';
import { User } from '../../users/entities/user.entity';
import { PermissionResolverService } from './permission-resolver.service';

/**
 * Pushes freshly-resolved permissions into every active Redis session of the
 * affected user(s) right after a role/policy mutation commits in iam-bc, so a
 * revoked (or newly granted) permission takes effect on the user's very next
 * request instead of waiting out the access token's TTL.
 *
 * Best-effort by design: the DB write this follows has already succeeded and
 * is the source of truth. A Redis failure here must never surface as an error
 * on that request — it only means the change falls back to the old
 * TTL-bounded behaviour (applies at the user's next login/refresh) instead of
 * being immediate.
 */
@Injectable()
export class SessionSyncService {
  constructor(
    private readonly logger: LogsService,
    configService: ConfigService,
    private readonly permissionResolver: PermissionResolverService,
    private readonly sessionStore: SessionStoreService,
    @InjectRepository(User, ErpDatabases.IAM)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Role, ErpDatabases.IAM)
    private readonly roleRepository: Repository<Role>,
  ) {
    this.logger.setContext(
      `${configService.get<string>('IAM_PREFIX_NAME')} [session-sync]`,
      configService.get<string>('IAM_PREFIX_VERSION'),
    );
  }

  /** Re-resolves and overwrites permissions in every active session for one user. */
  async syncUser(userId: string): Promise<void> {
    try {
      const resolved = await this.permissionResolver.resolveForUser(userId);
      await this.sessionStore.refreshPermissionsForUser(userId, resolved);
    } catch (error) {
      this.logger.error(
        'Failed to sync live sessions after a permission change.',
        error as Error,
        { user_id: userId },
      );
    }
  }

  /** A role's attached policies changed — resync every user holding that role. */
  async syncUsersByRole(roleId: string): Promise<void> {
    const users = await this.userRepository.find({
      where: { roles: { id: roleId } },
    });
    await this.syncUsers(users.map((user) => user.id));
  }

  /** A policy's statements changed — resync every user reachable via role → policy. */
  async syncUsersByPolicy(policyId: string): Promise<void> {
    const roles = await this.roleRepository.find({
      where: { policies: { id: policyId } },
    });
    if (roles.length === 0) return;

    const users = await this.userRepository.find({
      where: { roles: { id: In(roles.map((role) => role.id)) } },
    });
    await this.syncUsers([...new Set(users.map((user) => user.id))]);
  }

  private async syncUsers(userIds: string[]): Promise<void> {
    await Promise.all(userIds.map((userId) => this.syncUser(userId)));
  }
}
