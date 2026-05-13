import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { CurrentAdmin } from "../../common/decorators/current-admin.decorator";
import { AuthenticatedAdmin } from "../../common/types/authenticated-admin";
import { ReviewFiatOrderDto } from "./dto/review-fiat-order.dto";
import { FiatOnrampService } from "./fiat-onramp.service";

class CreatePaymentMethodDto {
  @IsString() @IsNotEmpty() code!: string;
  @IsString() @IsNotEmpty() displayName!: string;
  @IsString() @IsNotEmpty() accountName!: string;
  @IsString() @IsNotEmpty() accountNumber!: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsNumber() @IsOptional() sortOrder?: number;
}

class UpdatePaymentMethodDto {
  @IsString() @IsOptional() displayName?: string;
  @IsString() @IsOptional() accountName?: string;
  @IsString() @IsOptional() accountNumber?: string;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsNumber() @IsOptional() sortOrder?: number;
}

@Controller("admin/fiat-onramp")
@Public()
@UseGuards(AdminGuard)
export class AdminFiatOnrampController {
  constructor(private readonly fiatService: FiatOnrampService) {}

  @Get("orders")
  listOrders(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("status") status?: string,
  ) {
    return this.fiatService.listAdminOrders(
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
      status,
    );
  }

  @Post("orders/:id/review-start")
  startReview(@CurrentAdmin() admin: AuthenticatedAdmin, @Param("id") id: string) {
    return this.fiatService.startReview(admin.id, id);
  }

  @Post("orders/:id/approve")
  approve(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param("id") id: string,
    @Body() body: ReviewFiatOrderDto,
  ) {
    return this.fiatService.approveOrder(admin.id, id, body.reviewerNote);
  }

  @Post("orders/:id/reject")
  reject(
    @CurrentAdmin() admin: AuthenticatedAdmin,
    @Param("id") id: string,
    @Body() body: ReviewFiatOrderDto,
  ) {
    return this.fiatService.rejectOrder(admin.id, id, body.reviewerNote);
  }

  @Get("payment-methods")
  listPaymentMethods() {
    return this.fiatService.adminListPaymentMethods();
  }

  @Post("payment-methods")
  createPaymentMethod(@Body() body: CreatePaymentMethodDto) {
    return this.fiatService.adminCreatePaymentMethod(body);
  }

  @Patch("payment-methods/:id")
  updatePaymentMethod(@Param("id") id: string, @Body() body: UpdatePaymentMethodDto) {
    return this.fiatService.adminUpdatePaymentMethod(id, body);
  }

  @Delete("payment-methods/:id")
  deletePaymentMethod(@Param("id") id: string) {
    return this.fiatService.adminDeletePaymentMethod(id);
  }
}
