import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        orgId: true,
        createdAt: true,
        updatedAt: true
      }
    });
  }

  findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email }
    });
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data: {
        ...data,
        password: data.password ? bcrypt.hashSync(data.password, 10) : data.password
      }
    });
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 10);
  }

  async updatePassword(userId: string, password: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        password: await this.hashPassword(password)
      }
    });
  }

  async getById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
