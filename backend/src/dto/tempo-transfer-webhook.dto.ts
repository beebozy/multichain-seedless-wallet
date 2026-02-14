import { IsEthereumAddress, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class TempoTransferWebhookDto {
  @IsEthereumAddress()
  tokenAddress!: string;

  @IsString()
  txHash!: string;

  @IsInt()
  @Min(0)
  blockNumber!: number;

  @IsInt()
  @Min(0)
  logIndex!: number;

  @IsEthereumAddress()
  from!: string;

  @IsEthereumAddress()
  to!: string;

  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  memoHex?: string;
}
