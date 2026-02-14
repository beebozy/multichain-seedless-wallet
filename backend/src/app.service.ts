import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import Database = require('better-sqlite3');
import {
  Contract,
  decodeBytes32String,
  formatUnits,
  Interface,
  JsonRpcProvider,
  parseUnits,
  Wallet,
} from 'ethers';
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { ResolveRecipientDto } from './dto/resolve-recipient.dto';
import { SendPaymentDto } from './dto/send-payment.dto';
import { PrivyUpsertDto } from './dto/privy-upsert.dto';
import { AdminBootstrapDto } from './dto/admin-bootstrap.dto';
import { TempoTransferWebhookDto } from './dto/tempo-transfer-webhook.dto';
import { NotificationDeliveriesQueryDto } from './dto/notification-deliveries-query.dto';
import { ConfirmSignedPaymentDto } from './dto/confirm-signed-payment.dto';
import { AuthUser } from './auth/auth.types';
import { MetricsService } from './metrics.service';

type UserRow = {
  id: string;
  handle: string;
  wallet_address: string;
  chain: string;
  privy_user_id: string | null;
  custodial: number;
  encrypted_private_key: string | null;
};

type PaymentRow = {
  payment_id: string;
  idempotency_key: string;
  sender_user_id: string;
  recipient_user_id: string;
  recipient_handle: string;
  amount_usd: number;
  stablecoin: string;
  memo: string | null;
  memo_hex: string;
  status: 'initiated' | 'submitted' | 'settled' | 'failed';
  chain: string;
  tx_hash: string | null;
  sponsored_fee: number;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationRow = {
  id: string;
  payment_id: string | null;
  user_id: string;
  channel: 'email' | 'sms';
  destination: string;
  provider: string;
  template: string;
  payload_json: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  provider_message_id: string | null;
  last_error: string | null;
  next_retry_at: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type NotificationDelivery = {
  id: string;
  paymentId: string | null;
  userId: string;
  channel: 'email' | 'sms';
  destination: string;
  provider: string;
  template: string;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  providerMessageId: string | null;
  lastError: string | null;
  nextRetryAt: string;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  payload: Record<string, unknown>;
};

type IndexedEventRow = {
  token_address: string;
  tx_hash: string;
  block_number: number;
  block_hash: string;
  log_index: number;
  from_addr: string;
  to_addr: string;
  amount_raw: string;
  memo_hex: string;
  created_at: string;
};

type StablecoinConfig = {
  symbol: string;
  address: string;
  decimals: number;
};

type TransferRecord = {
  paymentId: string;
  senderUserId: string;
  recipientUserId: string;
  recipientHandle: string;
  amountUsd: number;
  stablecoin: string;
  memo?: string;
  memoHex: string;
  status: 'settled';
  chain: string;
  txHash: string;
  sponsoredFee: boolean;
  createdAt: string;
  direction: 'incoming' | 'outgoing';
  counterpartyWallet: string;
  blockNumber: number;
  logIndex: number;
};

const TIP20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transferWithMemo(address to, uint256 amount, bytes32 memo)',
  'function ISSUER_ROLE() view returns (bytes32)',
  'function grantRole(bytes32 role, address account)',
  'function mint(address to, uint256 amount)',
  'event TransferWithMemo(address indexed from, address indexed to, uint256 amount, bytes32 indexed memo)',
] as const;

const FEE_MANAGER_ABI = ['function setUserToken(address token)'] as const;

const FEE_MANAGER_ADDRESS = '0xfeEC000000000000000000000000000000000000';
const PATH_USD = '0x20C0000000000000000000000000000000000000';
const TIP20_INTERFACE = new Interface(TIP20_ABI);

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);

  private readonly rpcUrl = this.env('TEMPO_RPC_URL');
  private readonly provider = this.rpcUrl ? new JsonRpcProvider(this.rpcUrl) : null;
  private readonly chainId = Number(this.env('CHAIN_ID') ?? 42431);
  private readonly chainName = this.env('CHAIN_NAME') ?? 'tempo';
  private readonly startBlock = Number(this.env('TEMPO_START_BLOCK') ?? 0);
  private readonly maxLogRange = Number(this.env('TEMPO_MAX_LOG_RANGE') ?? 100000);
  private readonly indexerConfirmations = Number(this.env('INDEXER_CONFIRMATIONS') ?? 1);
  private readonly indexerReorgWindow = Number(this.env('INDEXER_REORG_WINDOW') ?? 64);
  private readonly feeSponsored = (this.env('TEMPO_FEE_SPONSORED') ?? 'true') !== 'false';
  private readonly indexerEnabled = (this.env('INDEXER_ENABLED') ?? 'true') !== 'false';
  private readonly indexerIntervalMs = Number(this.env('INDEXER_INTERVAL_MS') ?? 30000);
  private readonly notifyEnabled = (this.env('NOTIFY_ENABLED') ?? 'true') !== 'false';
  private readonly notifyProvider = (this.env('NOTIFY_PROVIDER') ?? 'log').toLowerCase();
  private readonly notifyRetryMax = Number(this.env('NOTIFY_RETRY_MAX') ?? 5);
  private readonly notifyRetryBaseMs = Number(this.env('NOTIFY_RETRY_BASE_MS') ?? 5000);
  private readonly notifyWorkerIntervalMs = Number(this.env('NOTIFY_WORKER_INTERVAL_MS') ?? 5000);
  private readonly encryptionSecret = this.env('CUSTODIAL_KEY_ENCRYPTION_SECRET') ?? '';

  private readonly dataDir = path.resolve(process.cwd(), 'data');
  private readonly dbPath = path.resolve(this.dataDir, 'backend.sqlite');
  private readonly db: Database.Database;
  private readonly stablecoins: StablecoinConfig[];

  private indexerTimer: NodeJS.Timeout | null = null;
  private notificationTimer: NodeJS.Timeout | null = null;
  private syncing = false;
  private notifying = false;

  constructor(private readonly metrics: MetricsService) {
    this.ensureDataDir();
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.setupSchema();
    this.stablecoins = this.loadStablecoins();
  }

  async onModuleInit() {
    if (this.indexerEnabled && this.provider) {
      await this.syncIndexerInternal();
      this.indexerTimer = setInterval(() => {
        this.syncIndexerInternal().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Indexer sync failed: ${message}`);
        });
      }, this.indexerIntervalMs);
    }

    if (this.notifyEnabled) {
      this.notificationTimer = setInterval(() => {
        this.processNotificationQueue().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Notification worker failed: ${message}`);
        });
      }, this.notifyWorkerIntervalMs);
    }
  }

  onModuleDestroy() {
    if (this.indexerTimer) {
      clearInterval(this.indexerTimer);
      this.indexerTimer = null;
    }
    if (this.notificationTimer) {
      clearInterval(this.notificationTimer);
      this.notificationTimer = null;
    }
    this.db.close();
  }

  resolveRecipient(auth: AuthUser | undefined, { handle }: ResolveRecipientDto) {
    this.requireAuth(auth);

    const normalized = this.normalizeHandle(handle);
    let user = this.findUserByHandle(normalized);

    let provisioned = false;
    if (!user) {
      user = this.provisionCustodialUser(handle.trim());
      provisioned = true;
    }

    this.audit(auth, 'resolve_recipient', user.id, { handle, provisioned });

    return {
      found: true,
      provisioned,
      userId: user.id,
      handle: user.handle,
      walletAddress: user.walletAddress,
      chain: user.chain,
      custodial: user.custodial,
      privyUserId: user.privyUserId,
      safetyFlags: provisioned ? ['new_custodial_wallet_created'] : [],
    };
  }

  privyUpsert(auth: AuthUser | undefined, input: PrivyUpsertDto) {
    this.requireAuth(auth);

    const admin = this.isAdmin(auth);
    if (!admin && auth?.sub !== input.privyUserId) {
      throw new ForbiddenException('Cannot upsert another Privy user');
    }

    const handle = input.email?.trim() || input.phone?.trim() || `privy:${input.privyUserId}`;
    const normalizedHandle = this.normalizeHandle(handle);
    const wallet = input.walletAddress.toLowerCase();

    const existing =
      this.db
        .prepare('SELECT * FROM users WHERE privy_user_id = ?')
        .get(input.privyUserId) ||
      this.db
        .prepare('SELECT * FROM users WHERE lower(handle) = ?')
        .get(normalizedHandle) ||
      this.db
        .prepare('SELECT * FROM users WHERE lower(wallet_address) = ?')
        .get(wallet);

    let provisioned = false;
    let id: string;
    if (!existing) {
      id = `user_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      this.db
        .prepare(
          `INSERT INTO users (id, handle, wallet_address, chain, privy_user_id, custodial, encrypted_private_key, created_at)
           VALUES (?, ?, ?, ?, ?, 0, NULL, ?)` ,
        )
        .run(id, handle, input.walletAddress, this.chainName, input.privyUserId, new Date().toISOString());
      provisioned = true;
    } else {
      id = (existing as UserRow).id;
      this.db
        .prepare(
          `UPDATE users
           SET handle = ?, wallet_address = ?, privy_user_id = ?, custodial = 0, encrypted_private_key = NULL
           WHERE id = ?`,
        )
        .run(handle, input.walletAddress, input.privyUserId, id);
    }

    const user = this.getUserById(id);
    this.audit(auth, 'privy_upsert', user.id, { provisioned });

    return {
      found: true,
      provisioned,
      userId: user.id,
      handle: user.handle,
      walletAddress: user.walletAddress,
      chain: user.chain,
      custodial: user.custodial,
      privyUserId: user.privyUserId,
      safetyFlags: provisioned ? ['privy_user_linked'] : [],
    };
  }

  async sendPayment(auth: AuthUser | undefined, input: SendPaymentDto) {
    this.requireAuth(auth);
    void input;
    throw new BadRequestException(
      'Direct backend signing is disabled. Use /v1/payments/prepare and /v1/payments/confirm-signed.',
    );
  }

  async prepareSignedPayment(auth: AuthUser | undefined, input: SendPaymentDto) {
    this.requireAuth(auth);
    this.ensureProvider();

    const sender = this.resolveActor(auth);
    const recipient = this.getOrProvisionUserByHandle(input.recipientHandle);
    const stablecoin = this.getStablecoinBySymbol(input.stablecoin);

    const existing = this.db
      .prepare(
        'SELECT * FROM payments WHERE idempotency_key = ? AND sender_user_id = ? ORDER BY created_at DESC LIMIT 1',
      )
      .get(input.idempotencyKey, sender.id) as PaymentRow | undefined;

    if (existing) {
      return {
        paymentId: existing.payment_id,
        senderUserId: existing.sender_user_id,
        recipientUserId: existing.recipient_user_id,
        txRequest: await this.buildSignedTxRequest(
          sender.walletAddress,
          recipient.walletAddress,
          stablecoin,
          existing.amount_usd,
          existing.memo_hex,
        ),
        status: existing.status,
      };
    }

    const paymentId = `pay_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 6)}`;
    const memoHex = this.memoToBytes32(input.memo);
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO payments (
          payment_id, idempotency_key, sender_user_id, recipient_user_id, recipient_handle,
          amount_usd, stablecoin, memo, memo_hex, status, chain, tx_hash,
          sponsored_fee, failure_code, failure_message, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'initiated', ?, NULL, ?, NULL, NULL, ?, ?)` ,
      )
      .run(
        paymentId,
        input.idempotencyKey,
        sender.id,
        recipient.id,
        recipient.handle,
        input.amountUsd,
        stablecoin.symbol,
        input.memo ?? null,
        memoHex,
        this.chainName,
        this.feeSponsored ? 1 : 0,
        now,
        now,
      );

    const txRequest = await this.buildSignedTxRequest(
      sender.walletAddress,
      recipient.walletAddress,
      stablecoin,
      input.amountUsd,
      memoHex,
    );
    this.audit(auth, 'prepare_signed_payment', paymentId, {
      senderUserId: sender.id,
      recipientUserId: recipient.id,
      stablecoin: stablecoin.symbol,
    });

    return {
      paymentId,
      senderUserId: sender.id,
      recipientUserId: recipient.id,
      txRequest,
      status: 'initiated',
    };
  }

  async confirmSignedPayment(auth: AuthUser | undefined, input: ConfirmSignedPaymentDto) {
    this.requireAuth(auth);
    this.ensureProvider();

    const sender = this.resolveActor(auth);
    const txHash = input.txHash.toLowerCase();

    const row = this.db
      .prepare('SELECT * FROM payments WHERE payment_id = ? AND sender_user_id = ? LIMIT 1')
      .get(input.paymentId, sender.id) as PaymentRow | undefined;
    if (!row) {
      throw new NotFoundException('Payment intent not found');
    }

    if (row.tx_hash && row.tx_hash.toLowerCase() === txHash && (row.status === 'submitted' || row.status === 'settled')) {
      return this.paymentRowToResponse(row);
    }

    const stablecoin = this.getStablecoinBySymbol(row.stablecoin);
    const tx = await (this.provider as JsonRpcProvider).getTransaction(txHash);
    if (!tx) {
      throw new BadRequestException('Transaction hash not found on chain');
    }

    if (!tx.from || tx.from.toLowerCase() !== sender.walletAddress.toLowerCase()) {
      throw new BadRequestException('Signed transaction sender does not match authenticated sender wallet');
    }
    if (!tx.to || tx.to.toLowerCase() !== stablecoin.address.toLowerCase()) {
      throw new BadRequestException('Signed transaction token contract does not match payment intent');
    }

    let decodedTo = '';
    let decodedAmount = '';
    let decodedMemoHex = '';
    try {
      const parsed = TIP20_INTERFACE.parseTransaction({ data: tx.data, value: tx.value });
      if (!parsed || parsed.name !== 'transferWithMemo') {
        throw new Error('Unexpected function');
      }
      decodedTo = String(parsed.args[0]).toLowerCase();
      decodedAmount = String(parsed.args[1]);
      decodedMemoHex = String(parsed.args[2]).toLowerCase();
    } catch {
      throw new BadRequestException('Unable to decode transferWithMemo from signed transaction');
    }

    const recipient = this.getUserById(row.recipient_user_id);
    const expectedUnits = this.usdToTokenUnits(row.amount_usd, stablecoin.decimals).toString();
    if (decodedTo !== recipient.walletAddress.toLowerCase()) {
      throw new BadRequestException('Signed transaction recipient does not match payment intent');
    }
    if (decodedAmount !== expectedUnits) {
      throw new BadRequestException('Signed transaction amount does not match payment intent');
    }
    if (decodedMemoHex !== row.memo_hex.toLowerCase()) {
      throw new BadRequestException('Signed transaction memo does not match payment intent');
    }

    this.db
      .prepare(`UPDATE payments SET status = 'submitted', tx_hash = ?, updated_at = ? WHERE payment_id = ?`)
      .run(txHash, new Date().toISOString(), row.payment_id);

    const receipt = await (this.provider as JsonRpcProvider).waitForTransaction(txHash, 1);
    const settled = receipt?.status === 1;
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE payments
         SET status = ?, updated_at = ?, failure_code = ?, failure_message = ?
         WHERE payment_id = ?`,
      )
      .run(
        settled ? 'settled' : 'failed',
        now,
        settled ? null : 'receipt_failed',
        settled ? null : 'Transaction receipt status indicates failure',
        row.payment_id,
      );

    this.metrics.incPayment(settled ? 'settled' : 'failed', stablecoin.symbol, 'client_signed');
    await this.syncIndexerInternal();

    const updated = this.db.prepare('SELECT * FROM payments WHERE payment_id = ? LIMIT 1').get(row.payment_id) as PaymentRow;
    if (settled) {
      this.enqueuePaymentNotifications(updated);
    }

    this.audit(auth, 'confirm_signed_payment', row.payment_id, {
      txHash,
      status: updated.status,
    });

    return this.paymentRowToResponse(updated);
  }

  async bootstrapFeesAndFunds(auth: AuthUser | undefined, input: AdminBootstrapDto) {
    this.requireAdmin(auth);
    this.ensureProvider();

    const deployerPk = this.env('DEPLOYER_PRIVATE_KEY');
    if (!deployerPk) {
      throw new BadRequestException('DEPLOYER_PRIVATE_KEY is required for bootstrap.');
    }

    const signer = new Wallet(deployerPk, this.provider as JsonRpcProvider);
    const stablecoin = input.tokenSymbol
      ? this.getStablecoinBySymbol(input.tokenSymbol)
      : this.stablecoins[0];
    const feeTokenAddress = input.feeTokenAddress ?? this.env('TEMPO_FEE_TOKEN') ?? PATH_USD;

    const feeManager = new Contract(FEE_MANAGER_ADDRESS, FEE_MANAGER_ABI, signer);
    const setFeeTx = await feeManager.setUserToken(feeTokenAddress);
    const setFeeReceipt = await setFeeTx.wait();

    const token = new Contract(stablecoin.address, TIP20_ABI, signer);

    let grantIssuerTxHash: string | null = null;
    if (input.grantIssuer ?? true) {
      const issuerRole = await token.ISSUER_ROLE();
      const tx = await token.grantRole(issuerRole, signer.address);
      grantIssuerTxHash = (await tx.wait())?.hash ?? tx.hash;
    }

    let mintTxHash: string | null = null;
    if ((input.mintAmount ?? 0) > 0) {
      const mintTo = this.env('WALLET_ADDRESS') ?? signer.address;
      const mintUnits = parseUnits((input.mintAmount as number).toFixed(stablecoin.decimals), stablecoin.decimals);
      const tx = await token.mint(mintTo, mintUnits);
      mintTxHash = (await tx.wait())?.hash ?? tx.hash;
    }

    this.audit(auth, 'bootstrap_fees_and_funds', stablecoin.address, {
      feeTokenAddress,
      grantIssuerTxHash,
      mintTxHash,
    });

    return {
      feeTokenAddress,
      stablecoin: stablecoin.symbol,
      stablecoinAddress: stablecoin.address,
      setFeeTokenTxHash: setFeeReceipt?.hash ?? setFeeTx.hash,
      grantIssuerTxHash,
      mintTxHash,
      deployer: signer.address,
    };
  }

  async forceIndexerSync(auth: AuthUser | undefined) {
    this.requireAdmin(auth);
    const result = await this.syncIndexerInternal();
    this.audit(auth, 'force_indexer_sync', 'indexer', result);
    return result;
  }

  ingestTempoTransferWebhook(auth: AuthUser | undefined, body: TempoTransferWebhookDto) {
    this.requireAdmin(auth);

    const memoHex = body.memoHex && body.memoHex.startsWith('0x')
      ? body.memoHex.toLowerCase()
      : '0x0000000000000000000000000000000000000000000000000000000000000000';

    const existing = this.db
      .prepare(
        'SELECT 1 FROM indexed_events WHERE lower(token_address)=? AND lower(tx_hash)=? AND log_index=? LIMIT 1',
      )
      .get(body.tokenAddress.toLowerCase(), body.txHash.toLowerCase(), body.logIndex);

    if (existing) {
      return { accepted: true, deduplicated: true };
    }

    this.db
      .prepare(
        `INSERT INTO indexed_events (
          token_address, tx_hash, block_number, block_hash, log_index,
          from_addr, to_addr, amount_raw, memo_hex, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      )
      .run(
        body.tokenAddress.toLowerCase(),
        body.txHash.toLowerCase(),
        body.blockNumber,
        '',
        body.logIndex,
        body.from.toLowerCase(),
        body.to.toLowerCase(),
        body.amount,
        memoHex,
        new Date().toISOString(),
      );

    this.audit(auth, 'ingest_webhook_transfer', body.txHash, { block: body.blockNumber, logIndex: body.logIndex });

    return { accepted: true, deduplicated: false };
  }

  async getLedger(auth: AuthUser | undefined, userId: string) {
    const owner = this.getAccessibleUser(auth, userId);
    const transfers = await this.getUserTransfers(owner);

    const netByCounterparty = new Map<string, number>();
    for (const transfer of transfers) {
      const current = netByCounterparty.get(transfer.counterpartyWallet) ?? 0;
      netByCounterparty.set(
        transfer.counterpartyWallet,
        transfer.direction === 'incoming' ? current + transfer.amountUsd : current - transfer.amountUsd,
      );
    }

    return Array.from(netByCounterparty.entries()).map(([wallet, netUsd]) => {
      const contact = this.findUserByWallet(wallet);
      return {
        contactId: contact?.id ?? wallet,
        contactHandle: contact?.handle ?? wallet,
        netUsd: Number(netUsd.toFixed(2)),
        status: netUsd > 0 ? 'owes_you' : netUsd < 0 ? 'you_owe' : 'settled',
      };
    });
  }

  async getWalletBalances(auth: AuthUser | undefined, userId: string) {
    this.ensureProvider();
    const owner = this.getAccessibleUser(auth, userId);

    const balances = await Promise.all(
      this.stablecoins.map(async (token) => {
        const contract = new Contract(token.address, TIP20_ABI, this.provider as JsonRpcProvider);
        const raw = (await contract.balanceOf(owner.walletAddress)) as bigint;
        const amount = Number(formatUnits(raw, token.decimals));

        return {
          asset: token.symbol,
          amount: Number(amount.toFixed(6)),
          usdValue: Number(amount.toFixed(2)),
          tokenAddress: token.address,
        };
      }),
    );

    const totalUsd = balances.reduce((acc, entry) => acc + entry.usdValue, 0);

    return {
      userId: owner.id,
      walletAddress: owner.walletAddress,
      balances,
      totalUsd: Number(totalUsd.toFixed(2)),
    };
  }

  async getTransfers(auth: AuthUser | undefined, userId: string, cursor?: string) {
    const owner = this.getAccessibleUser(auth, userId);
    const all = await this.getUserTransfers(owner);

    const sorted = all.sort((a, b) =>
      a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : b.blockNumber - a.blockNumber,
    );

    const start = cursor ? Number(cursor) : 0;
    const size = 20;
    return {
      data: sorted.slice(start, start + size),
      nextCursor: start + size < sorted.length ? String(start + size) : null,
    };
  }

  async getWeeklySpend(auth: AuthUser | undefined, userId: string) {
    const owner = this.getAccessibleUser(auth, userId);
    const transfers = await this.getUserTransfers(owner);

    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const outgoing = transfers.filter(
      (entry) => entry.direction === 'outgoing' && new Date(entry.createdAt).getTime() >= since,
    );

    const total = outgoing.reduce((acc, entry) => acc + entry.amountUsd, 0);
    const top = [...outgoing].sort((a, b) => b.amountUsd - a.amountUsd)[0] ?? null;

    return {
      userId: owner.id,
      walletAddress: owner.walletAddress,
      weekStart: new Date(since).toISOString(),
      totalSpentUsd: Number(total.toFixed(2)),
      transactionCount: outgoing.length,
      biggestExpense: top
        ? {
            amountUsd: Number(top.amountUsd.toFixed(2)),
            memo: top.memo ?? 'No memo',
            stablecoin: top.stablecoin,
            txHash: top.txHash,
          }
        : null,
      summary: `You spent $${Number(total.toFixed(2))} in the last 7 days.`,
    };
  }

  async getNotificationDeliveries(auth: AuthUser | undefined, query: NotificationDeliveriesQueryDto) {
    const owner = this.getAccessibleUser(auth, query.userId);
    const limit = query.limit ?? 20;
    const start = query.cursor ? Number(query.cursor) : 0;
    if (!Number.isFinite(start) || start < 0) {
      throw new BadRequestException('Invalid cursor');
    }

    const where: string[] = ['user_id = ?'];
    const params: Array<string | number> = [owner.id];
    if (query.paymentId) {
      where.push('payment_id = ?');
      params.push(query.paymentId);
    }
    const whereClause = where.join(' AND ');

    const countRow = this.db
      .prepare(`SELECT COUNT(*) as total FROM notifications WHERE ${whereClause}`)
      .get(...params) as { total: number };

    const rows = this.db
      .prepare(
        `SELECT * FROM notifications
         WHERE ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, start) as NotificationRow[];

    const data: NotificationDelivery[] = rows.map((row) => ({
      id: row.id,
      paymentId: row.payment_id,
      userId: row.user_id,
      channel: row.channel,
      destination: row.destination,
      provider: row.provider,
      template: row.template,
      status: row.status,
      attempts: row.attempts,
      providerMessageId: row.provider_message_id,
      lastError: row.last_error,
      nextRetryAt: row.next_retry_at,
      sentAt: row.sent_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      payload: JSON.parse(row.payload_json) as Record<string, unknown>,
    }));

    const next = start + limit < countRow.total ? String(start + limit) : null;

    return {
      userId: owner.id,
      total: countRow.total,
      data,
      nextCursor: next,
    };
  }

  private setupSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        handle TEXT NOT NULL,
        wallet_address TEXT NOT NULL,
        chain TEXT NOT NULL,
        privy_user_id TEXT,
        custodial INTEGER NOT NULL,
        encrypted_private_key TEXT,
        created_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS users_handle_idx ON users(lower(handle));
      CREATE UNIQUE INDEX IF NOT EXISTS users_wallet_idx ON users(lower(wallet_address));
      CREATE UNIQUE INDEX IF NOT EXISTS users_privy_idx ON users(privy_user_id);

      CREATE TABLE IF NOT EXISTS payments (
        payment_id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL,
        sender_user_id TEXT NOT NULL,
        recipient_user_id TEXT NOT NULL,
        recipient_handle TEXT NOT NULL,
        amount_usd REAL NOT NULL,
        stablecoin TEXT NOT NULL,
        memo TEXT,
        memo_hex TEXT NOT NULL,
        status TEXT NOT NULL,
        chain TEXT NOT NULL,
        tx_hash TEXT,
        sponsored_fee INTEGER NOT NULL,
        failure_code TEXT,
        failure_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_sender_idx
        ON payments(idempotency_key, sender_user_id);

      CREATE TABLE IF NOT EXISTS indexed_events (
        token_address TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        block_number INTEGER NOT NULL,
        block_hash TEXT NOT NULL,
        log_index INTEGER NOT NULL,
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        amount_raw TEXT NOT NULL,
        memo_hex TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(token_address, tx_hash, log_index)
      );

      CREATE TABLE IF NOT EXISTS indexer_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        last_synced_block INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        target TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        payment_id TEXT,
        user_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        destination TEXT NOT NULL,
        provider TEXT NOT NULL,
        template TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        provider_message_id TEXT,
        last_error TEXT,
        next_retry_at TEXT NOT NULL,
        sent_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS notifications_pending_idx
        ON notifications(status, next_retry_at);
    `);

    const hasState = this.db.prepare('SELECT 1 FROM indexer_state WHERE id = 1').get();
    if (!hasState) {
      this.db
        .prepare('INSERT INTO indexer_state(id, last_synced_block) VALUES(1, ?)')
        .run(this.startBlock - 1);
    }

    const hasUsers = this.db.prepare('SELECT 1 FROM users LIMIT 1').get();
    if (!hasUsers) {
      this.seedDefaultOwner();
    }
  }

  private async syncIndexerInternal() {
    this.ensureProvider();
    if (this.syncing) {
      return { synced: false, reason: 'sync_in_progress' };
    }

    this.syncing = true;
    try {
      const provider = this.provider as JsonRpcProvider;
      const latest = await provider.getBlockNumber();
      const confirmed = latest - this.indexerConfirmations;
      this.metrics.setIndexerLag(this.chainName, Math.max(0, confirmed - this.currentSyncedBlock()));
      if (confirmed < this.startBlock) {
        return { synced: true, newEvents: 0, lastSyncedBlock: this.currentSyncedBlock() };
      }

      const rewindFrom = Math.max(this.startBlock, this.currentSyncedBlock() - this.indexerReorgWindow);
      let from = rewindFrom;
      let newEvents = 0;

      while (from <= confirmed) {
        const to = Math.min(from + this.maxLogRange - 1, confirmed);

        for (const stablecoin of this.stablecoins) {
          const token = new Contract(stablecoin.address, TIP20_ABI, provider);
          const logs = await token.queryFilter(token.filters.TransferWithMemo(), from, to);

          for (const log of logs) {
            if (!('args' in log)) {
              continue;
            }

            const args = log.args as unknown as {
              from: string;
              to: string;
              amount: bigint;
              memo: string;
            };

            const timestamp = await this.getBlockTimestamp(log.blockNumber);
            this.db
              .prepare(
                `INSERT INTO indexed_events (
                  token_address, tx_hash, block_number, block_hash, log_index,
                  from_addr, to_addr, amount_raw, memo_hex, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(token_address, tx_hash, log_index)
                DO UPDATE SET
                  block_number = excluded.block_number,
                  block_hash = excluded.block_hash,
                  from_addr = excluded.from_addr,
                  to_addr = excluded.to_addr,
                  amount_raw = excluded.amount_raw,
                  memo_hex = excluded.memo_hex,
                  created_at = excluded.created_at`,
              )
              .run(
                stablecoin.address.toLowerCase(),
                log.transactionHash.toLowerCase(),
                log.blockNumber,
                log.blockHash.toLowerCase(),
                log.index,
                args.from.toLowerCase(),
                args.to.toLowerCase(),
                args.amount.toString(),
                args.memo.toLowerCase(),
                timestamp,
              );

            newEvents += 1;
          }
        }

        this.db.prepare('UPDATE indexer_state SET last_synced_block = ? WHERE id = 1').run(to);
        from = to + 1;
      }

      return {
        synced: true,
        newEvents,
        lastSyncedBlock: this.currentSyncedBlock(),
      };
    } finally {
      this.syncing = false;
    }
  }

  private currentSyncedBlock(): number {
    const row = this.db.prepare('SELECT last_synced_block FROM indexer_state WHERE id = 1').get() as {
      last_synced_block: number;
    };
    return row.last_synced_block;
  }

  private paymentRowToResponse(row: PaymentRow) {
    return {
      paymentId: row.payment_id,
      senderUserId: row.sender_user_id,
      recipientUserId: row.recipient_user_id,
      recipientHandle: row.recipient_handle,
      amountUsd: row.amount_usd,
      stablecoin: row.stablecoin,
      memo: row.memo ?? undefined,
      memoHex: row.memo_hex,
      status: row.status,
      chain: row.chain,
      txHash: row.tx_hash ?? undefined,
      sponsoredFee: row.sponsored_fee === 1,
      createdAt: row.created_at,
      idempotencyKey: row.idempotency_key,
      failureCode: row.failure_code ?? undefined,
      failureMessage: row.failure_message ?? undefined,
    };
  }

  private async buildSignedTxRequest(
    senderWallet: string,
    recipientWallet: string,
    stablecoin: StablecoinConfig,
    amountUsd: number,
    memoHex: string,
  ) {
    const amountUnits = this.usdToTokenUnits(amountUsd, stablecoin.decimals);
    const data = TIP20_INTERFACE.encodeFunctionData('transferWithMemo', [recipientWallet, amountUnits, memoHex]);
    let gasLimit = 300000n;
    if (this.provider) {
      try {
        gasLimit = await (this.provider as JsonRpcProvider).estimateGas({
          from: senderWallet,
          to: stablecoin.address,
          data,
          value: 0n,
        });
      } catch {
        // keep conservative fallback so client tx does not default to 0 gas limit
      }
    }
    return {
      to: stablecoin.address,
      data,
      value: '0x0',
      chainId: this.chainId,
      gasLimit: gasLimit.toString(),
      tokenAddress: stablecoin.address,
      amountUnits: amountUnits.toString(),
      memoHex,
      stablecoin: stablecoin.symbol,
    };
  }

  private async getUserTransfers(user: {
    id: string;
    walletAddress: string;
  }): Promise<TransferRecord[]> {
    if (this.indexerEnabled && this.provider) {
      await this.syncIndexerInternal();
    }

    const wallet = user.walletAddress.toLowerCase();
    const rows = this.db
      .prepare(
        `SELECT * FROM indexed_events
         WHERE from_addr = ? OR to_addr = ?
         ORDER BY block_number DESC, log_index DESC`,
      )
      .all(wallet, wallet) as IndexedEventRow[];

    return rows.map((row) => {
      const stablecoin = this.getStablecoinByAddress(row.token_address);
      const decimals = stablecoin?.decimals ?? 6;
      const symbol = stablecoin?.symbol ?? row.token_address;
      const direction: 'incoming' | 'outgoing' = row.from_addr === wallet ? 'outgoing' : 'incoming';
      const counterpartyWallet = direction === 'incoming' ? row.from_addr : row.to_addr;
      const amountUsd = Number(formatUnits(BigInt(row.amount_raw), decimals));

      return {
        paymentId: row.tx_hash,
        senderUserId: this.findUserByWallet(row.from_addr)?.id ?? row.from_addr,
        recipientUserId: this.findUserByWallet(row.to_addr)?.id ?? row.to_addr,
        recipientHandle: this.findUserByWallet(row.to_addr)?.handle ?? row.to_addr,
        amountUsd: Number(amountUsd.toFixed(6)),
        stablecoin: symbol,
        memo: this.bytes32ToMemo(row.memo_hex),
        memoHex: row.memo_hex,
        status: 'settled',
        chain: this.chainName,
        txHash: row.tx_hash,
        sponsoredFee: this.feeSponsored,
        createdAt: row.created_at,
        direction,
        counterpartyWallet,
        blockNumber: row.block_number,
        logIndex: row.log_index,
      };
    });
  }

  private getStablecoinByAddress(address: string): StablecoinConfig | undefined {
    return this.stablecoins.find((entry) => entry.address.toLowerCase() === address.toLowerCase());
  }

  private resolveActor(auth: AuthUser): {
    id: string;
    handle: string;
    walletAddress: string;
    chain: string;
    privyUserId?: string;
    custodial: boolean;
    encryptedPrivateKey?: string;
  } {
    const byPrivy = this.db
      .prepare('SELECT * FROM users WHERE privy_user_id = ? LIMIT 1')
      .get(auth.sub) as UserRow | undefined;
    if (byPrivy) {
      return this.rowToUser(byPrivy);
    }

    if (auth.walletAddress) {
      const byWallet = this.db
        .prepare('SELECT * FROM users WHERE lower(wallet_address)=? LIMIT 1')
        .get(auth.walletAddress.toLowerCase()) as UserRow | undefined;
      if (byWallet) {
        if (!byWallet.privy_user_id) {
          this.db.prepare('UPDATE users SET privy_user_id = ? WHERE id = ?').run(auth.sub, byWallet.id);
          byWallet.privy_user_id = auth.sub;
        }
        return this.rowToUser(byWallet);
      }
    }

    const handleCandidate = auth.email ?? auth.phone ?? `auth:${auth.sub}`;
    const walletAddress = auth.walletAddress;
    if (!walletAddress) {
      throw new UnauthorizedException('Authenticated token missing wallet address claim');
    }

    const id = `user_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    this.db
      .prepare(
        `INSERT INTO users (id, handle, wallet_address, chain, privy_user_id, custodial, encrypted_private_key, created_at)
         VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
      )
      .run(id, handleCandidate, walletAddress, this.chainName, auth.sub, new Date().toISOString());

    return {
      id,
      handle: handleCandidate,
      walletAddress,
      chain: this.chainName,
      privyUserId: auth.sub,
      custodial: false,
    };
  }

  private getAccessibleUser(auth: AuthUser | undefined, userId: string) {
    this.requireAuth(auth);

    const actor = this.resolveActor(auth as AuthUser);
    if (!this.isAdmin(auth as AuthUser) && actor.id !== userId) {
      throw new ForbiddenException('Cannot access another user data');
    }

    return this.getUserById(userId);
  }

  private getUserById(userId: string) {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').get(userId) as UserRow | undefined;
    if (!row) {
      throw new NotFoundException('User not found');
    }
    return this.rowToUser(row);
  }

  private findUserByHandle(handle: string) {
    const row = this.db
      .prepare('SELECT * FROM users WHERE lower(handle) = ? LIMIT 1')
      .get(this.normalizeHandle(handle)) as UserRow | undefined;
    return row ? this.rowToUser(row) : null;
  }

  private findUserByWallet(wallet: string) {
    const row = this.db
      .prepare('SELECT * FROM users WHERE lower(wallet_address) = ? LIMIT 1')
      .get(wallet.toLowerCase()) as UserRow | undefined;
    return row ? this.rowToUser(row) : null;
  }

  private getOrProvisionUserByHandle(handle: string) {
    const existing = this.findUserByHandle(handle);
    if (existing) {
      return existing;
    }
    return this.provisionCustodialUser(handle.trim());
  }

  private provisionCustodialUser(handle: string) {
    const wallet = Wallet.createRandom();
    const encrypted = this.encryptPrivateKey(wallet.privateKey);
    const id = `user_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

    this.db
      .prepare(
        `INSERT INTO users (id, handle, wallet_address, chain, privy_user_id, custodial, encrypted_private_key, created_at)
         VALUES (?, ?, ?, ?, NULL, 1, ?, ?)`,
      )
      .run(id, handle, wallet.address, this.chainName, encrypted, new Date().toISOString());

    return {
      id,
      handle,
      walletAddress: wallet.address,
      chain: this.chainName,
      privyUserId: undefined,
      custodial: true,
      encryptedPrivateKey: encrypted,
    };
  }

  private rowToUser(row: UserRow) {
    return {
      id: row.id,
      handle: row.handle,
      walletAddress: row.wallet_address,
      chain: row.chain,
      privyUserId: row.privy_user_id ?? undefined,
      custodial: row.custodial === 1,
      encryptedPrivateKey: row.encrypted_private_key ?? undefined,
    };
  }

  private enqueuePaymentNotifications(payment: PaymentRow) {
    if (!this.notifyEnabled) {
      return;
    }

    const recipient = this.getUserById(payment.recipient_user_id);
    const sender = this.getUserById(payment.sender_user_id);
    const now = new Date().toISOString();

    const jobs: Array<{ channel: 'email' | 'sms'; destination: string }> = [];
    if (this.looksLikeEmail(recipient.handle)) {
      jobs.push({ channel: 'email', destination: recipient.handle });
    }
    if (this.looksLikePhone(recipient.handle)) {
      jobs.push({ channel: 'sms', destination: recipient.handle });
    }

    for (const job of jobs) {
      const id = `ntf_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
      const payload = {
        paymentId: payment.payment_id,
        txHash: payment.tx_hash,
        amountUsd: payment.amount_usd,
        stablecoin: payment.stablecoin,
        memo: payment.memo,
        senderHandle: sender.handle,
        recipientHandle: recipient.handle,
      };

      this.db
        .prepare(
          `INSERT INTO notifications (
            id, payment_id, user_id, channel, destination, provider, template, payload_json,
            status, attempts, provider_message_id, last_error, next_retry_at, sent_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, NULL, NULL, ?, NULL, ?, ?)`,
        )
        .run(
          id,
          payment.payment_id,
          recipient.id,
          job.channel,
          job.destination,
          this.notifyProvider,
          'payment_received',
          JSON.stringify(payload),
          now,
          now,
          now,
        );
    }
  }

  private async processNotificationQueue() {
    if (this.notifying) {
      return;
    }
    this.notifying = true;

    try {
      const now = new Date().toISOString();
      const rows = this.db
        .prepare(
          `SELECT * FROM notifications
           WHERE status = 'pending' AND next_retry_at <= ?
           ORDER BY created_at ASC
           LIMIT 50`,
        )
        .all(now) as NotificationRow[];

      for (const row of rows) {
        await this.processSingleNotification(row);
      }
    } finally {
      this.notifying = false;
    }
  }

  private async processSingleNotification(row: NotificationRow) {
    const attempts = row.attempts + 1;
    try {
      const providerMessageId = await this.deliverNotification(row);
      const now = new Date().toISOString();
      this.db
        .prepare(
          `UPDATE notifications
           SET status='sent', attempts=?, provider_message_id=?, sent_at=?, updated_at=?
           WHERE id=?`,
        )
        .run(attempts, providerMessageId ?? null, now, now, row.id);
      this.metrics.incNotification('sent', row.channel, row.provider);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = attempts >= this.notifyRetryMax;
      const delayMs = this.notifyRetryBaseMs * 2 ** Math.max(0, attempts - 1);
      const nextRetryAt = new Date(Date.now() + delayMs).toISOString();
      const now = new Date().toISOString();

      this.db
        .prepare(
          `UPDATE notifications
           SET status=?, attempts=?, last_error=?, next_retry_at=?, updated_at=?
           WHERE id=?`,
        )
        .run(failed ? 'failed' : 'pending', attempts, message, nextRetryAt, now, row.id);

      this.metrics.incNotification('failed', row.channel, row.provider);
    }
  }

  private async deliverNotification(row: NotificationRow): Promise<string | undefined> {
    const payload = JSON.parse(row.payload_json) as Record<string, unknown>;
    if (this.notifyProvider === 'webhook') {
      const url = this.env('NOTIFY_WEBHOOK_URL');
      if (!url) {
        throw new Error('NOTIFY_WEBHOOK_URL is required for webhook provider');
      }
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          channel: row.channel,
          destination: row.destination,
          template: row.template,
          payload,
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new Error(`Webhook notify failed: ${resp.status} ${body}`);
      }
      return resp.headers.get('x-message-id') ?? undefined;
    }

    this.logger.log(
      `[notify:${row.channel}] to=${row.destination} template=${row.template} payload=${JSON.stringify(payload)}`,
    );
    return `log-${Date.now()}`;
  }

  private looksLikeEmail(value: string): boolean {
    return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value.trim());
  }

  private looksLikePhone(value: string): boolean {
    return /^\\+?[0-9]{8,15}$/.test(value.trim());
  }

  private loadStablecoins(): StablecoinConfig[] {
    const raw = this.env('TOKEN_ADDRESSES_JSON');
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const entries = Object.entries(parsed).map(([symbol, address]) => ({
        symbol,
        address,
        decimals: Number(this.env(`TOKEN_DECIMALS_${symbol.toUpperCase()}`) ?? 6),
      }));
      if (entries.length > 0) {
        return entries;
      }
    }

    const single = this.env('STABLE_ADDRESS') ?? this.readDeployedTokenAddress();
    if (!single) {
      throw new InternalServerErrorException(
        'No token config found. Set TOKEN_ADDRESSES_JSON, STABLE_ADDRESS, or DeploymentValue.txt.',
      );
    }

    return [
      {
        symbol: this.env('DEFAULT_STABLECOIN_SYMBOL') ?? 'iUSD',
        address: single,
        decimals: Number(this.env('DEFAULT_STABLECOIN_DECIMALS') ?? 6),
      },
    ];
  }

  private getStablecoinBySymbol(symbol: string): StablecoinConfig {
    const input = symbol.trim().toLowerCase();
    const stable =
      this.stablecoins.find((entry) => entry.symbol.toLowerCase() === input) ??
      this.stablecoins.find((entry) => {
        const configured = entry.symbol.toLowerCase();
        if (input === 'pathusd' && configured === 'iusd') {
          return true;
        }
        if (input === 'iusd' && configured === 'pathusd') {
          return true;
        }
        return false;
      });
    if (!stable) {
      throw new BadRequestException(
        `Unsupported stablecoin ${symbol}. Supported: ${this.stablecoins.map((s) => s.symbol).join(', ')}`,
      );
    }
    return stable;
  }

  private readDeployedTokenAddress(): string | null {
    const candidates = [
      path.resolve(process.cwd(), '../onchain/DeploymentValue.txt'),
      path.resolve(process.cwd(), 'onchain/DeploymentValue.txt'),
    ];

    for (const file of candidates) {
      if (!existsSync(file)) {
        continue;
      }
      const text = require('node:fs').readFileSync(file, 'utf8') as string;
      const matched = text.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
      if (matched?.[1]) {
        return matched[1];
      }
    }

    return null;
  }

  private requireAuth(auth: AuthUser | undefined): asserts auth is AuthUser {
    if (!auth?.sub) {
      throw new UnauthorizedException('Authentication required');
    }
  }

  private requireAdmin(auth: AuthUser | undefined) {
    this.requireAuth(auth);
    if (!this.isAdmin(auth)) {
      throw new ForbiddenException('Admin privileges required');
    }
  }

  private isAdmin(auth: AuthUser): boolean {
    if (auth.role === 'admin') {
      return true;
    }

    const adminSubs = (this.env('ADMIN_SUBS') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (adminSubs.includes(auth.sub)) {
      return true;
    }

    const adminEmails = (this.env('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return auth.email ? adminEmails.includes(auth.email.toLowerCase()) : false;
  }

  private env(name: string): string | undefined {
    const value = process.env[name];
    if (!value) {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  private ensureProvider() {
    if (!this.provider) {
      throw new InternalServerErrorException('TEMPO_RPC_URL is required for onchain integration.');
    }
  }

  private ensureDataDir() {
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private normalizeHandle(handle: string): string {
    return handle.trim().toLowerCase();
  }

  private usdToTokenUnits(amountUsd: number, decimals: number): bigint {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
      throw new BadRequestException('amountUsd must be > 0.');
    }
    return parseUnits(amountUsd.toFixed(decimals), decimals);
  }

  private memoToBytes32(memo?: string): string {
    if (!memo || memo.trim().length === 0) {
      return '0x0000000000000000000000000000000000000000000000000000000000000000';
    }

    const utf8 = Buffer.from(memo, 'utf8');
    if (utf8.length > 32) {
      throw new BadRequestException('memo is too long for bytes32. Use 32 bytes or less.');
    }

    const padded = Buffer.alloc(32);
    utf8.copy(padded);
    return `0x${padded.toString('hex')}`;
  }

  private bytes32ToMemo(memoHex: string): string | undefined {
    if (memoHex === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return undefined;
    }

    try {
      return decodeBytes32String(memoHex);
    } catch {
      return undefined;
    }
  }

  private encryptPrivateKey(privateKey: string): string {
    if (!this.encryptionSecret) {
      throw new InternalServerErrorException(
        'CUSTODIAL_KEY_ENCRYPTION_SECRET is required for custodial key encryption.',
      );
    }

    const key = createHash('sha256').update(this.encryptionSecret).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(privateKey, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private async getBlockTimestamp(blockNumber: number): Promise<string> {
    if (!this.provider) {
      return new Date().toISOString();
    }

    const block = await (this.provider as JsonRpcProvider).getBlock(blockNumber);
    return new Date((block?.timestamp ?? 0) * 1000).toISOString();
  }

  private seedDefaultOwner() {
    const walletAddress = this.env('WALLET_ADDRESS');
    const deployerPk = this.env('DEPLOYER_PRIVATE_KEY');
    if (!walletAddress || !deployerPk) {
      return;
    }

    const handle = this.env('DEFAULT_SENDER_HANDLE') ?? 'owner@local';
    const encrypted = this.encryptPrivateKey(deployerPk);
    this.db
      .prepare(
        `INSERT OR IGNORE INTO users (id, handle, wallet_address, chain, privy_user_id, custodial, encrypted_private_key, created_at)
         VALUES ('user_owner', ?, ?, ?, NULL, 1, ?, ?)`,
      )
      .run(handle, walletAddress, this.chainName, encrypted, new Date().toISOString());
  }

  private audit(auth: AuthUser | undefined, action: string, target: string, payload: unknown) {
    this.db
      .prepare(
        `INSERT INTO audit_logs (actor_user_id, action, target, payload_json, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(auth?.sub ?? null, action, target, JSON.stringify(payload), new Date().toISOString());
  }
}
