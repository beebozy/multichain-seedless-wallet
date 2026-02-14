import { IsOptional, IsString, IsEthereumAddress } from 'class-validator';

export class PrivyUpsertDto {
  @IsString()
  privyUserId!: string;

  @IsEthereumAddress()
  walletAddress!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
