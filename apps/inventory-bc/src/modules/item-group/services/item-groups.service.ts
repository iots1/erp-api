import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { EntityManager, Repository } from 'typeorm';

import { rebuildNestedSetFor } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { CreateItemGroupDTO } from '../dto/create-item-group.dto';
import { UpdateItemGroupDTO } from '../dto/update-item-group.dto';
import { ItemGroup } from '../entities/item-group.entity';

@Injectable()
export class ItemGroupsService extends BaseServiceOperations<
  ItemGroup,
  CreateItemGroupDTO,
  UpdateItemGroupDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(ItemGroup, ErpDatabases.INVENTORY)
    itemGroupRepository: Repository<ItemGroup>,
  ) {
    super(itemGroupRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }

  private async assertValidParent(
    manager: EntityManager,
    parentId: string,
  ): Promise<void> {
    const parent = await manager.findOne(ItemGroup, {
      where: { id: parentId, is_deleted: false },
    });
    if (!parent) {
      throw new BadRequestException(
        `Parent item group '${parentId}' not found.`,
      );
    }
    if (!parent.is_group) {
      throw new BadRequestException(
        'Cannot attach a child item group to a leaf (is_group=false) parent.',
      );
    }
  }

  private async rebuildTree(manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(ItemGroup);
    const nodes = await repo.find({ where: { is_deleted: false } });
    rebuildNestedSetFor(nodes, (n) => n.parent_item_group_id);
    await repo.save(nodes);
  }

  async create(
    data: CreateItemGroupDTO,
    currentUser?: IUserSession | string,
  ): Promise<ItemGroup> {
    return this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(async (manager) => {
        if (data.parent_item_group_id) {
          await this.assertValidParent(manager, data.parent_item_group_id);
        }

        const repo = manager.getRepository(ItemGroup);
        const entity = repo.create({ ...data, lft: 0, rgt: 0 });
        if (currentUser !== undefined) {
          const userId =
            typeof currentUser === 'string' ? currentUser : currentUser.id;
          entity.created_by = userId;
          entity.updated_by = userId;
        }
        const saved = await repo.save(entity);

        await this.rebuildTree(manager);

        return repo.findOneOrFail({ where: { id: saved.id } });
      }),
    );
  }

  async update(
    id: string,
    data: UpdateItemGroupDTO,
    currentUser?: IUserSession | string,
  ): Promise<ItemGroup> {
    return this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(async (manager) => {
        const repo = manager.getRepository(ItemGroup);

        if (
          data.parent_item_group_id !== undefined &&
          data.parent_item_group_id !== null
        ) {
          if (data.parent_item_group_id === id) {
            throw new BadRequestException(
              'An item group cannot be its own parent.',
            );
          }
          await this.assertValidParent(manager, data.parent_item_group_id);
        }

        const preloadData: Record<string, unknown> = { id, ...data };
        if (currentUser !== undefined) {
          preloadData.updated_by =
            typeof currentUser === 'string' ? currentUser : currentUser.id;
        }

        const entity = await repo.preload(preloadData);
        if (!entity) {
          throw new NotFoundException(`ItemGroup with ID '${id}' not found.`);
        }
        await repo.save(entity);

        await this.rebuildTree(manager);

        return repo.findOneOrFail({ where: { id } });
      }),
    );
  }

  async delete(
    id: string,
    softDelete = true,
    currentUser?: IUserSession | string,
  ): Promise<void> {
    await this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(async (manager) => {
        const repo = manager.getRepository(ItemGroup);

        const childCount = await repo.count({
          where: { parent_item_group_id: id, is_deleted: false },
        });
        if (childCount > 0) {
          throw new BadRequestException(
            'Cannot delete an item group that still has child item groups.',
          );
        }

        if (softDelete) {
          const updateData: Record<string, unknown> = {
            is_deleted: true,
            deleted_at: new Date(),
          };
          if (currentUser !== undefined) {
            updateData.deleted_by =
              typeof currentUser === 'string' ? currentUser : currentUser.id;
          }
          const result = await repo.update(id, updateData);
          if (result.affected === 0) {
            throw new NotFoundException(`ItemGroup with ID '${id}' not found.`);
          }
        } else {
          const result = await repo.delete(id);
          if (result.affected === 0) {
            throw new NotFoundException(`ItemGroup with ID '${id}' not found.`);
          }
        }

        await this.rebuildTree(manager);
      }),
    );
  }
}
