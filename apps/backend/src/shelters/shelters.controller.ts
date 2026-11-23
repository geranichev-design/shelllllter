import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SheltersService } from './shelters.service';
import { UpdateShelterDto } from './dto/update-shelter.dto';

@Controller('shelters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SheltersController {
  constructor(private readonly sheltersService: SheltersService) {}

  @Roles(UserRole.DSNS)
  @Get('pending-verification')
  pendingVerification() {
    return this.sheltersService.pendingVerification();
  }

  @Get()
  findAll() {
    return this.sheltersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sheltersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() currentUser: { sub: string; role: UserRole; orgId: string | null },
    @Body() dto: UpdateShelterDto
  ) {
    return this.sheltersService.update(id, currentUser, dto);
  }
}
