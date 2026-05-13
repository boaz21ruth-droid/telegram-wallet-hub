import { Body, Controller, Get, Post, Query } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateSwapDto } from "./dto/create-swap.dto";
import { GetSwapQuoteDto } from "./dto/get-swap-quote.dto";
import { SwapService } from "./swap.service";

@Controller("swap")
export class SwapController {
  constructor(private readonly swapService: SwapService) {}

  @Post("quote")
  async getQuote(@Body() body: GetSwapQuoteDto) {
    return this.swapService.getQuote(body);
  }

  @Post()
  async createSwap(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateSwapDto) {
    return this.swapService.createSwap(user.id, body);
  }

  @Get("orders")
  async listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.swapService.listOrders(user.id, limit ? Number(limit) : 20, offset ? Number(offset) : 0);
  }
}
