import { IsString, MinLength } from 'class-validator';

export class ResolveRecipientDto {
  @IsString()
  @MinLength(3)
  handle!: string;
}
