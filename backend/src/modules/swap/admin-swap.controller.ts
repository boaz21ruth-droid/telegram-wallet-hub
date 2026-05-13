import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { PrismaService } from "../../common/prisma/prisma.service";

@Controller("admin/swap")
@Public()
@UseGuards(AdminGuard)
export class AdminSwapController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("orders")
  async listOrders(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
    @Query("userId") userId?: string,
  ) {
    return this.prisma.swapOrder.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit ? Number(limit) : 50,
      skip: offset ? Number(offset) : 0,
      include: { user: { select: { id: true, telegramUserId: true, username: true } } },
    });
  }
}
