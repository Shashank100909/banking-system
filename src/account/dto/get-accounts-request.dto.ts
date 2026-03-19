import { PaginatedDto } from '../../common/dto/paginated.dto';
import { IsOptional, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class GetAccountsRequestDto extends PaginatedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  userId?: number;
}
