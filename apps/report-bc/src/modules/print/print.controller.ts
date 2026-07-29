import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '@lib/common';
import { ApiJsonApiCreatedResponse } from '@lib/common/decorators/json-api-response.decorator';
import { ResourceType } from '@lib/common/decorators/resource-type.decorator';

import {
  PRINT_MOCK_INVOICE_DESCRIPTION,
  PRINT_MOCK_INVOICE_SUMMARY,
} from './constants/print.swagger';
import { CreateInvoicePrintDTO } from './dto/create-invoice-print.dto';
import { InvoicePrintResultDTO } from './dto/invoice-print-result.dto';
import { InvoicePrintService } from './services/invoice-print.service';

@ResourceType('invoice-prints')
@ApiTags('Print')
@Controller('invoices')
export class PrintController {
  constructor(private readonly invoicePrintService: InvoicePrintService) {}

  @Post('mock-pdf')
  @RequirePermission('report:print_invoice', {
    th: 'พิมพ์ใบแจ้งหนี้เป็น PDF',
    en: 'Print invoice as PDF',
  })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: PRINT_MOCK_INVOICE_SUMMARY,
    description: PRINT_MOCK_INVOICE_DESCRIPTION,
  })
  @ApiJsonApiCreatedResponse('invoice-prints', InvoicePrintResultDTO)
  async printMockInvoice(
    @Body() dto: CreateInvoicePrintDTO,
  ): Promise<InvoicePrintResultDTO> {
    return this.invoicePrintService.printMockInvoice(dto);
  }
}
