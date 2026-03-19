import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class WithdrawDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;
}
