import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { ShelterRequestsModule } from './shelter-requests/shelter-requests.module';
import { SheltersModule } from './shelters/shelters.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    ShelterRequestsModule,
    SheltersModule
  ],
  controllers: [AppController]
})
export class AppModule {}
