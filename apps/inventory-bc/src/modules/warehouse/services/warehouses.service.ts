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

import { CreateWarehouseDTO } from '../dto/create-warehouse.dto';
import { UpdateWarehouseDTO } from '../dto/update-warehouse.dto';
import { Warehouse } from '../entities/warehouse.entity';

@Injectable()
export class WarehousesService extends BaseServiceOperations<
  Warehouse,
  CreateWarehouseDTO,
  UpdateWarehouseDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(Warehouse, ErpDatabases.INVENTORY)
    warehouseRepository: Repository<Warehouse>,
  ) {
    super(warehouseRepository, {
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
    const parent = await manager.findOne(Warehouse, {
      where: { id: parentId, is_deleted: false },
    });
    if (!parent) {
      throw new BadRequestException(
        `Parent warehouse '${parentId}' not found.`,
      );
    }
    if (!parent.is_group) {
      throw new BadRequestException(
        'Cannot attach a child warehouse to a leaf (is_group=false) parent.',
      );
    }
  }

  private async rebuildTree(manager: EntityManager): Promise<void> {
    const repo = manager.getRepository(Warehouse);
    const nodes = await repo.find({ where: { is_deleted: false } });
    rebuildNestedSetFor(nodes, (n) => n.parent_warehouse_id);
    await repo.save(nodes);
  }

  async create(
    data: CreateWarehouseDTO,
    currentUser?: IUserSession | string,
  ): Promise<Warehouse> {
    return this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(async (manager) => {
        if (data.parent_warehouse_id) {
          await this.assertValidParent(manager, data.parent_warehouse_id);
        }

        const repo = manager.getRepository(Warehouse);
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
    data: UpdateWarehouseDTO,
    currentUser?: IUserSession | string,
  ): Promise<Warehouse> {
    return this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(async (manager) => {
        const repo = manager.getRepository(Warehouse);

        if (
          data.parent_warehouse_id !== undefined &&
          data.parent_warehouse_id !== null
        ) {
          if (data.parent_warehouse_id === id) {
            throw new BadRequestException(
              'A warehouse cannot be its own parent.',
            );
          }
          await this.assertValidParent(manager, data.parent_warehouse_id);
        }

        const preloadData: Record<string, unknown> = { id, ...data };
        if (currentUser !== undefined) {
          preloadData.updated_by =
            typeof currentUser === 'string' ? currentUser : currentUser.id;
        }

        const entity = await repo.preload(preloadData);
        if (!entity) {
          throw new NotFoundException(`Warehouse with ID '${id}' not found.`);
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
        const repo = manager.getRepository(Warehouse);

        const childCount = await repo.count({
          where: { parent_warehouse_id: id, is_deleted: false },
        });
        if (childCount > 0) {
          throw new BadRequestException(
            'Cannot delete a warehouse that still has child warehouses.',
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
            throw new NotFoundException(`Warehouse with ID '${id}' not found.`);
          }
        } else {
          const result = await repo.delete(id);
          if (result.affected === 0) {
            throw new NotFoundException(`Warehouse with ID '${id}' not found.`);
          }
        }

        await this.rebuildTree(manager);
      }),
    );
  }
}
