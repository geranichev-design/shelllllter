import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateShelterRequestDto } from './dto/create-shelter-request.dto';
import { ListShelterRequestsQueryDto } from './dto/list-shelter-requests.query';
import { ReviewShelterRequestDto } from './dto/review-shelter-request.dto';
import { UpdateShelterRequestStatusDto } from './dto/update-shelter-request-status.dto';
import { ShelterRequestsService } from './shelter-requests.service';

@Controller('shelter-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShelterRequestsController {
  constructor(private readonly shelterRequestsService: ShelterRequestsService) {}

  @Roles(UserRole.BALANCE_HOLDER, UserRole.GOV_ORG, UserRole.DSNS)
  @Post()
  create(
    @CurrentUser() currentUser: { sub: string; role: UserRole; orgId: string | null },
    @Body() dto: CreateShelterRequestDto
  ) {
    return this.shelterRequestsService.create(currentUser, dto);
  }

  @Roles(UserRole.BALANCE_HOLDER, UserRole.GOV_ORG, UserRole.REGIONAL, UserRole.DSNS)
  @Get()
  findAll(
    @CurrentUser() currentUser: { sub: string; role: UserRole; orgId: string | null },
    @Query() query: ListShelterRequestsQueryDto
  ) {
    return this.shelterRequestsService.findAll(currentUser, query.status);
  }

  @Roles(UserRole.BALANCE_HOLDER, UserRole.GOV_ORG, UserRole.REGIONAL, UserRole.DSNS)
  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() currentUser: { sub: string; role: UserRole; orgId: string | null }) {
    return this.shelterRequestsService.findOne(id, currentUser);
  }

  @Roles(UserRole.REGIONAL)
  @Patch(':id/review')
  review(
    @Param('id') id: string,
    @CurrentUser() currentUser: { sub: string; role: UserRole; orgId: string | null },
    @Body() dto: ReviewShelterRequestDto
  ) {
    return this.shelterRequestsService.review(id, currentUser, dto);
  }

  @Roles(UserRole.REGIONAL, UserRole.DSNS)
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() currentUser: { sub: string; role: UserRole; orgId: string | null },
    @Body() dto: UpdateShelterRequestStatusDto
  ) {
    return this.shelterRequestsService.updateStatus(id, currentUser, dto);
  }
}
