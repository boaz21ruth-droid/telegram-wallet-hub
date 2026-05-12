import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { StakingService } from "./staking.service";
import { StakeAssetDto } from "./dto/stake-asset.dto";

@Controller("staking")
export class StakingController {
  constructor(private readonly stakingService: StakingService) {}

  @Get("products")
  async listProducts() {
    return this.stakingService.listProducts();
  }

  @Post("orders")
  async stake(@CurrentUser() user: AuthenticatedUser, @Body() body: StakeAssetDto) {
    return this.stakingService.stakeAsset(user.id, body);
  }

  @Post("orders/:id/redeem")
  async redeem(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.stakingService.redeemStaking(user.id, id);
  }

  @Get("orders")
  async myOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.stakingService.listMyOrders(
      user.id,
      limit ? Number(limit) : 20,
      offset ? Number(offset) : 0,
    );
  }
}
