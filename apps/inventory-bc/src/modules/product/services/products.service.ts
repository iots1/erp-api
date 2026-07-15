import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { In, Repository } from 'typeorm';

import { ErpDatabases } from '@lib/common/enum/erp-databases.enum';
import { IUserSession } from '@lib/common/interfaces/auth.interface';
import { LogsService } from '@lib/common/modules/log/logs.service';
import { BaseServiceOperations } from '@lib/common/utils/base-operations/base-service-operations.util';
import { ConfigService } from '@lib/config';

import { SuppliersProxyService } from '../../../integrations/supplier-bc/suppliers.proxy-service';
import { ItemAttributeValue } from '../../item-attribute/entities/item-attribute-value.entity';
import { CreateProductDTO } from '../dto/create-product.dto';
import { GenerateVariantsDTO } from '../dto/generate-variants.dto';
import { UpdateProductDTO } from '../dto/update-product.dto';
import { ItemVariantAttribute } from '../entities/item-variant-attribute.entity';
import { Product } from '../entities/product.entity';
import { generateVariantCombinations } from '../utils/generate-variant-combinations.util';

@Injectable()
export class ProductsService extends BaseServiceOperations<
  Product,
  CreateProductDTO,
  UpdateProductDTO
> {
  protected readonly allowedRelations: string[] = [];

  constructor(
    protected readonly logger: LogsService,
    configService: ConfigService,
    private readonly suppliersProxyService: SuppliersProxyService,
    @InjectRepository(Product, ErpDatabases.INVENTORY)
    productRepository: Repository<Product>,
  ) {
    super(productRepository, {
      logging: {
        logger: logger,
        serviceName: configService.get('INVENTORY_PREFIX_NAME'),
        serviceVersion: configService.get('INVENTORY_PREFIX_VERSION'),
      },
    });
  }

  private async assertValidSupplier(supplierId: string): Promise<void> {
    const supplier =
      await this.suppliersProxyService.getSupplierById(supplierId);
    if (!supplier) {
      throw new BadRequestException(`Supplier '${supplierId}' not found.`);
    }
  }

  private async assertValidTemplate(templateId: string): Promise<void> {
    const template = await this.typeOrmRepository.findOne({
      where: { id: templateId, is_deleted: false },
    });
    if (!template) {
      throw new BadRequestException(
        `Template product '${templateId}' not found.`,
      );
    }
    if (!template.has_variants) {
      throw new BadRequestException(
        `Product '${templateId}' is not a variant template (has_variants=false).`,
      );
    }
  }

  async create(
    data: CreateProductDTO,
    currentUser?: IUserSession | string,
  ): Promise<Product> {
    if (data.supplier_id) {
      await this.assertValidSupplier(data.supplier_id);
    }
    if (data.template_product_id) {
      await this.assertValidTemplate(data.template_product_id);
    }
    return super.create(data, currentUser);
  }

  async update(
    id: string,
    data: UpdateProductDTO,
    currentUser?: IUserSession | string,
  ): Promise<Product> {
    if (data.supplier_id) {
      await this.assertValidSupplier(data.supplier_id);
    }
    if (data.template_product_id) {
      await this.assertValidTemplate(data.template_product_id);
    }
    return super.update(id, data, currentUser);
  }

  /**
   * Cartesian-products the selected attribute values into every variant
   * combination and creates one `Product` row (+ its `ItemVariantAttribute`
   * rows) per combination, in a single transaction.
   */
  async generateVariants(
    templateId: string,
    dto: GenerateVariantsDTO,
    currentUser?: IUserSession | string,
  ): Promise<Product[]> {
    return this.executeDbOperation(() =>
      this.typeOrmRepository.manager.transaction(async (manager) => {
        const productRepo = manager.getRepository(Product);
        const valueRepo = manager.getRepository(ItemAttributeValue);
        const variantAttributeRepo =
          manager.getRepository(ItemVariantAttribute);

        const template = await productRepo.findOne({
          where: { id: templateId, is_deleted: false },
        });
        if (!template) {
          throw new NotFoundException(
            `Product with ID '${templateId}' not found.`,
          );
        }
        if (!template.has_variants) {
          throw new BadRequestException(
            `Product '${templateId}' is not a variant template (has_variants=false).`,
          );
        }

        const combinations = generateVariantCombinations(dto.attributes);
        if (combinations.length === 0) {
          throw new BadRequestException(
            'Every attribute dimension must have at least one selected value.',
          );
        }

        const allValueIds = Array.from(
          new Set(combinations.flat().map((entry) => entry.attribute_value_id)),
        );
        const values = await valueRepo.find({ where: { id: In(allValueIds) } });
        const valueById = new Map(values.map((value) => [value.id, value]));

        const userId =
          currentUser === undefined
            ? undefined
            : typeof currentUser === 'string'
              ? currentUser
              : currentUser.id;

        const createdVariants: Product[] = [];

        for (const combination of combinations) {
          const combinationValues = combination.map((entry) => {
            const value = valueById.get(entry.attribute_value_id);
            if (!value) {
              throw new BadRequestException(
                `Attribute value '${entry.attribute_value_id}' not found.`,
              );
            }
            return value;
          });

          const skuSuffix = combinationValues
            .map((value) => value.abbr ?? value.value)
            .join('-');
          const nameSuffix = combinationValues
            .map((value) => value.value)
            .join(' ');

          const variant = productRepo.create({
            sku: `${template.sku}-${skuSuffix}`,
            name_th: `${template.name_th} ${nameSuffix}`,
            name_en: `${template.name_en} ${nameSuffix}`,
            type: template.type,
            item_group_id: template.item_group_id,
            brand_id: template.brand_id,
            stock_uom_id: template.stock_uom_id,
            has_variants: false,
            template_product_id: template.id,
            supplier_id: template.supplier_id,
          });
          if (userId !== undefined) {
            variant.created_by = userId;
            variant.updated_by = userId;
          }
          const savedVariant = await productRepo.save(variant);

          const variantAttributes = combination.map((entry) =>
            variantAttributeRepo.create({
              variant_product_id: savedVariant.id,
              attribute_id: entry.attribute_id,
              attribute_value_id: entry.attribute_value_id,
              created_by: userId ?? null,
              updated_by: userId ?? null,
            }),
          );
          await variantAttributeRepo.save(variantAttributes);

          createdVariants.push(savedVariant);
        }

        return createdVariants;
      }),
    );
  }
}
