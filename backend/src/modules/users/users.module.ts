import { Module } from "@nestjs/common";

import { AdminGuard } from "../../common/guards/admin.guard";
import { AdminUsersController } from "./admin-users.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController, AdminUsersController],
  providers: [UsersService, AdminGuard],
  exports: [UsersService],
})
export class UsersModule {}
