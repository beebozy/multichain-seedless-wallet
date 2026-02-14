import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class AdminBootstrapDto {
  @IsOptional()
  @IsString()
  tokenSymbol?: string;

  @IsOptional()
  @IsString()
  feeTokenAddress?: string;

  @IsOptional()
  @IsBoolean()
  grantIssuer?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  mintAmount?: number;
}
