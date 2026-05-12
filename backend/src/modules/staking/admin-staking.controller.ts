import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { PrismaService } from "../../common/prisma/prisma.service";
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { Transform } from "class-transformer";

class CreateProductDto {
  @IsString() name!: string;
  @IsString() @IsOptional() description?: string;
  @IsString() assetCode!: string;
  @IsString() network!: string;
  @IsString() productType!: "FLEXIBLE" | "FIXED";
  @IsString() minAmount!: string;
  @IsString() @IsOptional() maxAmount?: string;
  @IsString() @IsOptional() totalCap?: string;
  @IsNumber() @Min(0) @IsOptional() lockDays?: number;
  @IsString() @IsOptional() currentApy?: string;
}

class UpdateProductDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() currentApy?: string;
  @IsBoolean() @IsOptional() @Transform(({ value }) => value === "true" || value === true) isActive?: boolean;
}

@Controller("admin/staking")
@Public()
@UseGuards(AdminGuard)
export class AdminStakingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("products")
  async listProducts() {
    return this.prisma.stakingProduct.findMany({ orderBy: { createdAt: "asc" } });
  }

  @Post("products")
  async createProduct(@Body() body: CreateProductDto) {
    return this.prisma.stakingProduct.create({ data: body as never });
  }

  @Patch("products/:id")
  async updateProduct(@Param("id") id: string, @Body() body: UpdateProductDto) {
    return this.prisma.stakingProduct.update({ where: { id }, data: body as never });
  }

  @Get("orders")
  async listOrders(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("userId") userId?: string,
    @Query("status") status?: string,
  ) {
    return this.prisma.stakingOrder.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(status ? { status: status as never } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : 50,
      skip: offset ? Number(offset) : 0,
      include: {
        user: { select: { id: true, telegramUserId: true, username: true } },
        product: true,
      },
    });
  }
}
