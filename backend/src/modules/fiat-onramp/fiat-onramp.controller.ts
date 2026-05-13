import { Body, Controller, Get, Param, Post, Query, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname } from "path";
import { env } from "../../config/env";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { CreateFiatOrderDto } from "./dto/create-fiat-order.dto";
import { FiatOnrampService } from "./fiat-onramp.service";

@Controller("fiat-onramp")
export class FiatOnrampController {
  constructor(private readonly fiatService: FiatOnrampService) {}

  @Get("quote")
  getQuote(
    @Query("fiatCurrency") fiatCurrency = "CNY",
    @Query("fiatAmount") fiatAmount: string,
    @Query("assetCode") assetCode?: string,
    @Query("network") network?: string,
  ) {
    return this.fiatService.getFiatQuote(fiatCurrency, fiatAmount, assetCode, network);
  }

  @Get("payment-methods")
  getPaymentMethods() {
    return this.fiatService.listPaymentMethods();
  }

  @Post("orders")
  createOrder(@CurrentUser() user: AuthenticatedUser, @Body() body: CreateFiatOrderDto) {
    return this.fiatService.createOrder(user.id, body);
  }

  @Post("orders/:id/proof")
  @UseInterceptors(
    FileInterceptor("proof", {
      storage: diskStorage({
        destination: () => env().UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, `fiat-proof-${crypto.randomUUID()}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  async submitProof(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body("paymentNote") paymentNote?: string,
  ) {
    return this.fiatService.submitPaymentProof(user.id, id, file.path, paymentNote);
  }

  @Post("orders/:id/cancel")
  cancelOrder(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.fiatService.cancelOrder(user.id, id);
  }

  @Get("orders")
  listOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string,
  ) {
    return this.fiatService.listUserOrders(user.id, limit ? Number(limit) : 20, offset ? Number(offset) : 0);
  }
}
