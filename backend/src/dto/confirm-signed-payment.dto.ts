import { IsString, MinLength } from 'class-validator';

export class ConfirmSignedPaymentDto {
  @IsString()
  @MinLength(8)
  paymentId!: string;

  @IsString()
  @MinLength(10)
  txHash!: string;
}
