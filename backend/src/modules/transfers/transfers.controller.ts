import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateTransferDto } from "./dto/create-transfer.dto";
import { TransfersService } from "./transfers.service";

@Controller("transfers")
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  async createTransfer(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateTransferDto) {
    return this.transfersService.createTransfer(user.id, user.telegramUserId, body);
  }

  @Get("orders")
  async listOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.transfersService.listOrders(user.id);
  }

  @Get("orders/:id")
  async getOrder(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.transfersService.getOrder(user.id, id);
  }
}
