import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { TransferDto } from './dto/transfer.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { GetAccountsRequestDto } from './dto/get-accounts-request.dto';
import { DepositDto } from './dto/deposit.dto';
import {
  JwtAuthGuard,
  AccessGuard,
  RolesGuard,
  Roles,
  AuthenticatedRequest,
  UserType,
  UserRole,
} from '../common';
import { WithdrawDto } from './dto/withdraw.dto';

@UseGuards(JwtAuthGuard, AccessGuard, RolesGuard)
@Controller('account')
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Roles(UserType.Admin, UserRole.Employee)
  @Post()
  async create(@Body() dto: CreateAccountDto): Promise<ApiResponseDto> {
    const account = await this.accountService.createAccount(dto);
    return new ApiResponseDto('Account created successfully', {
      id: account.id,
    });
  }

  @Roles(UserType.Admin, UserRole.Employee, UserRole.Customer)
  @Get()
  async getAccounts(
    @Query() query: GetAccountsRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseDto> {
    console.log('req.user:', req.user);
    const { role, id } = req.user;

    if (role === UserRole.Customer) {
      const account = await this.accountService.getAccount(id);
      return new ApiResponseDto('Account fetched successfully', {
        data: account,
      });
    }

    if (query.userId) {
      const account = await this.accountService.getAccount(query.userId);
      return new ApiResponseDto('Account fetched successfully', {
        data: account,
      });
    }

    const result = await this.accountService.getAll({
      skip: query.skip,
      take: query.take,
    });
    return new ApiResponseDto('Accounts fetched successfully', {
      data: result,
    });
  }

  @Roles(UserRole.Customer)
  @Post('deposit')
  async deposit(
    @Body() dto: DepositDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseDto> {
    const account = await this.accountService.deposit(dto.amount, req.user.id);
    return new ApiResponseDto('Amount deposited successfully', {
      data: account,
    });
  }

  @Roles(UserRole.Customer)
  @Post('withdraw')
  async withdraw(
    @Body() dto: WithdrawDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseDto> {
    const result = await this.accountService.withdraw(dto.amount, req.user.id);
    return new ApiResponseDto('Amount withdrawn successfully', {
      data: result,
    });
  }

  @Roles(UserRole.Customer)
  @Post('transfer')
  async transfer(
    @Body() dto: TransferDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseDto> {
    const result = await this.accountService.transfer(
      dto.amount,
      req.user.id,
      dto.receiverUserId,
    );
    return new ApiResponseDto('Amount transferred successfully', {
      data: result,
    });
  }

  @Roles(UserType.Admin, UserRole.Employee, UserRole.Customer)
  @Get('transactions')
  async getTransactions(
    @Query() query: GetAccountsRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiResponseDto> {
    const { role, type, id } = req.user;

    if (role === UserRole.Customer) {
      const result = await this.accountService.getTransactionHistory(id, {
        skip: query.skip,
        take: query.take,
      });
      return new ApiResponseDto('Transactions fetched successfully', {
        data: result,
      });
    }

    if (query.userId) {
      const result = await this.accountService.getTransactionHistory(
        query.userId,
        { skip: query.skip, take: query.take },
      );
      return new ApiResponseDto('Transactions fetched successfully', {
        data: result,
      });
    }

    const result = await this.accountService.getAllTransactions({
      skip: query.skip,
      take: query.take,
    });
    return new ApiResponseDto('Transactions fetched successfully', {
      data: result,
    });
  }
}
