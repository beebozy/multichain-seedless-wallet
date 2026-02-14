import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class SendPaymentDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  senderUserId?: string;

  @IsString()
  @MinLength(3)
  recipientHandle!: string;

  @IsNumber()
  @Min(0.01)
  amountUsd!: number;

  @IsString()
  stablecoin!: string;

  @IsOptional()
  @IsString()
  memo?: string;

  @IsString()
  @MinLength(8)
  idempotencyKey!: string;
}
