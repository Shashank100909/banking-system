import { IsString, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAccountDto {
  @ApiProperty()
  @IsNumber()
  userId: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;
}
