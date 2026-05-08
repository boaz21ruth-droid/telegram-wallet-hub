import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";

import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AuthenticatedUser } from "../../common/types/authenticated-user";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { UpdateUserStatusDto } from "./dto/update-user-status.dto";
import { UsersService } from "./users.service";

@Controller("admin/users")
@UseGuards(AdminGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.usersService.listUsers(query.limit, query.offset);
  }

  @Get(":id")
  async getUser(@Param("id") id: string) {
    return this.usersService.getUser(id);
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateUserStatusDto,
    @CurrentUser() admin: AuthenticatedUser,
  ) {
    return this.usersService.updateUserStatus(id, body.status, admin);
  }
}
