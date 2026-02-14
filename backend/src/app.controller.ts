import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { ResolveRecipientDto } from './dto/resolve-recipient.dto';
import { SendPaymentDto } from './dto/send-payment.dto';
import { PrivyUpsertDto } from './dto/privy-upsert.dto';
import { AdminBootstrapDto } from './dto/admin-bootstrap.dto';
import { TempoTransferWebhookDto } from './dto/tempo-transfer-webhook.dto';
import { NotificationDeliveriesQueryDto } from './dto/notification-deliveries-query.dto';
import { ConfirmSignedPaymentDto } from './dto/confirm-signed-payment.dto';
import { AuthGuard } from './auth/auth.guard';
import { RequestWithAuth } from './auth/auth.types';

@Controller('v1')
@UseGuards(AuthGuard)
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post('auth/resolve-recipient')
  resolveRecipient(@Req() req: RequestWithAuth, @Body() body: ResolveRecipientDto) {
    return this.appService.resolveRecipient(req.authUser, body);
  }

  @Post('payments/send')
  sendPayment(@Req() req: RequestWithAuth, @Body() body: SendPaymentDto) {
    return this.appService.sendPayment(req.authUser, body);
  }

  @Post('payments/prepare')
  prepareSignedPayment(@Req() req: RequestWithAuth, @Body() body: SendPaymentDto) {
    return this.appService.prepareSignedPayment(req.authUser, body);
  }

  @Post('payments/confirm-signed')
  confirmSignedPayment(@Req() req: RequestWithAuth, @Body() body: ConfirmSignedPaymentDto) {
    return this.appService.confirmSignedPayment(req.authUser, body);
  }

  @Post('auth/privy-upsert')
  privyUpsert(@Req() req: RequestWithAuth, @Body() body: PrivyUpsertDto) {
    return this.appService.privyUpsert(req.authUser, body);
  }

  @Post('admin/bootstrap-fees-and-funds')
  bootstrapFeesAndFunds(@Req() req: RequestWithAuth, @Body() body: AdminBootstrapDto) {
    return this.appService.bootstrapFeesAndFunds(req.authUser, body);
  }

  @Post('admin/indexer/sync')
  forceIndexerSync(@Req() req: RequestWithAuth) {
    return this.appService.forceIndexerSync(req.authUser);
  }

  @Post('webhooks/tempo-transfer')
  ingestTempoTransfer(@Req() req: RequestWithAuth, @Body() body: TempoTransferWebhookDto) {
    return this.appService.ingestTempoTransferWebhook(req.authUser, body);
  }

  @Get('contacts/ledger')
  getLedger(@Req() req: RequestWithAuth, @Query('userId') userId: string) {
    return this.appService.getLedger(req.authUser, userId);
  }

  @Get('wallet/balances')
  getWalletBalances(@Req() req: RequestWithAuth, @Query('userId') userId: string) {
    return this.appService.getWalletBalances(req.authUser, userId);
  }

  @Get('transfers')
  getTransfers(@Req() req: RequestWithAuth, @Query('userId') userId: string, @Query('cursor') cursor?: string) {
    return this.appService.getTransfers(req.authUser, userId, cursor);
  }

  @Get('insights/weekly-spend')
  getWeeklySpend(@Req() req: RequestWithAuth, @Query('userId') userId: string) {
    return this.appService.getWeeklySpend(req.authUser, userId);
  }

  @Get('notifications/deliveries')
  getNotificationDeliveries(@Req() req: RequestWithAuth, @Query() query: NotificationDeliveriesQueryDto) {
    return this.appService.getNotificationDeliveries(req.authUser, query);
  }
}
