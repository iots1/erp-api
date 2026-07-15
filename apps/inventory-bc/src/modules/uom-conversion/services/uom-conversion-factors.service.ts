import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { Repository } from 'typeorm';

import { IResponsePaginatedService } from '@lib/common';
import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { QueryParamsDTO } from '@lib/common/dto/query-params.dto';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { Product } from '../../product/entities/product.entity';
import { Uom } from '../../uom/entities/uom.entity';
import { CreateUomConversionFactorDTO } from '../dto/create-uom-conversion-factor.dto';
import { UpdateUomConversionFactorDTO } from '../dto/update-uom-conversion-factor.dto';
import { UomConversionFactor } from '../entities/uom-conversion-factor.entity';

@Injectable()
export class UomConversionFactorsService extends BaseServiceOperations<
  UomConversionFactor,
  CreateUomConversionFactorDTO,
  UpdateUomConversionFactorDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    @InjectRepository(UomConversionFactor, ErpDatabases.INVENTORY)
    uomConversionFactorRepository: Repository<UomConversionFactor>,
    @InjectRepository(Product, ErpDatabases.INVENTORY)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Uom, ErpDatabases.INVENTORY)
    private readonly uomRepository: Repository<Uom>,
  ) {
    super(uomConversionFactorRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }

  /**
   * "RULE · CONVERSION ROUND CHECK" (backend-convention.html): if the
   * product's stock UOM is whole-number-only, the conversion factor itself
   * must be an integer, otherwise qty × conversion_factor could produce a
   * fractional stock quantity when GR/PO/SO convert back to stock_uom.
   */
  private async assertWholeNumberRoundCheck(
    productId: string,
    conversionFactor: number,
  ): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: productId, is_deleted: false },
    });
    if (!product) {
      throw new BadRequestException(`Product '${productId}' not found.`);
    }

    const stockUom = await this.uomRepository.findOne({
      where: { id: product.stock_uom_id, is_deleted: false },
    });
    if (
      stockUom?.is_whole_number === true &&
      !Number.isInteger(conversionFactor)
    ) {
      throw new BadRequestException(
        `Stock UOM '${stockUom.name}' is whole-number-only; conversion_factor (${conversionFactor}) must be a whole number.`,
      );
    }
  }

  async create(
    data: CreateUomConversionFactorDTO,
    currentUser?: IUserSession | string,
  ): Promise<UomConversionFactor> {
    await this.assertWholeNumberRoundCheck(
      data.product_id,
      data.conversion_factor,
    );
    return super.create(data, currentUser);
  }

  async update(
    id: string,
    data: UpdateUomConversionFactorDTO,
    currentUser?: IUserSession | string,
  ): Promise<UomConversionFactor> {
    if (data.conversion_factor !== undefined) {
      const productId = data.product_id ?? (await this.findById(id)).product_id;
      await this.assertWholeNumberRoundCheck(productId, data.conversion_factor);
    }
    return super.update(id, data, currentUser);
  }

  findPaginatedByProductId(
    productId: string,
    query: QueryParamsDTO,
  ): Promise<IResponsePaginatedService<UomConversionFactor[]>> {
    return super.findPaginated({
      ...query,
      filter: ([] as string[])
        .concat(query.filter ?? [])
        .concat(`product_id||$eq||${productId}`),
    });
  }
}
