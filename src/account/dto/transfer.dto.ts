import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class TransferDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  receiverUserId: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;
}
