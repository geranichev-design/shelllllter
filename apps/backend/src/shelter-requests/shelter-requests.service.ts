import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountingStatus,
  AccessType,
  Prisma,
  RecordStatus,
  ShelterRequestStatus,
  ShelterStatus,
  ShelterType,
  UserRole
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShelterRequestDto } from './dto/create-shelter-request.dto';
import { ReviewDecision, ReviewShelterRequestDto } from './dto/review-shelter-request.dto';
import { UpdateShelterRequestStatusDto } from './dto/update-shelter-request-status.dto';

type CurrentUser = {
  sub: string;
  role: UserRole;
  orgId: string | null;
};

type RequestDataObject = Record<string, unknown>;

function readEnum<T extends string>(
  value: unknown,
  fallback: T,
  allowed: readonly T[]
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function readEnumOrNull<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function getShelterStates(data: Record<string, unknown>) {
  return {
    status: readEnum(data.shelterStatus, ShelterStatus.NEED, Object.values(ShelterStatus)),
    accountingStatus: readEnum(data.accountingStatus, AccountingStatus.NEW, Object.values(AccountingStatus)),
    recordStatus: readEnum(data.recordStatus, RecordStatus.DRAFT, Object.values(RecordStatus))
  };
}

function isRequestDataObject(data: unknown): data is RequestDataObject {
  return typeof data === 'object' && data !== null && !Array.isArray(data);
}

@Injectable()
export class ShelterRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  private getRoleVisibilityWhere(currentUser: CurrentUser): Prisma.ShelterRequestWhereInput | null {
    if (currentUser.role === UserRole.REGIONAL || currentUser.role === UserRole.DSNS) {
      return {};
    }

    return null;
  }

  private getVisibleRequestsWhere(currentUser: CurrentUser): Prisma.ShelterRequestWhereInput {
    const visibleScopes: Prisma.ShelterRequestWhereInput[] = [
      { createdById: currentUser.sub }
    ];
    const roleVisibilityWhere = this.getRoleVisibilityWhere(currentUser);

    if (roleVisibilityWhere !== null) {
      visibleScopes.push(roleVisibilityWhere);
    }

    return visibleScopes.some(scope => Object.keys(scope).length === 0)
      ? {}
      : { OR: visibleScopes };
  }

  private buildShelterData(request: {
    id: string;
    data: Prisma.JsonValue;
    createdBy: { orgId: string | null };
  }): Prisma.ShelterUncheckedCreateInput {
    if (!isRequestDataObject(request.data)) {
      throw new ConflictException('Shelter request data must be an object');
    }

    const data = request.data;
    const ownerOrgId = typeof data.ownerOrgId === 'string' ? data.ownerOrgId : request.createdBy.orgId;
    const states = getShelterStates(data);
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    const type = readEnumOrNull(data.type, Object.values(ShelterType));
    const accessType = readEnumOrNull(data.accessType, Object.values(AccessType));
    const capacity = Number(data.capacity);
    const latitude = Number(data.latitude);
    const longitude = Number(data.longitude);

    if (!name) {
      throw new ConflictException('Shelter request is missing name');
    }

    if (!type || !accessType) {
      throw new ConflictException('Shelter request is missing type or accessType');
    }

    if (!ownerOrgId) {
      throw new ConflictException('Shelter request is missing ownerOrgId');
    }

    if (!Number.isFinite(capacity) || capacity <= 0) {
      throw new ConflictException('Shelter request has an invalid capacity');
    }

    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new ConflictException('Shelter request has an invalid latitude');
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new ConflictException('Shelter request has an invalid longitude');
    }

    return {
      name,
      type,
      accessType,
      capacity,
      latitude,
      longitude,
      status: states.status,
      accountingStatus: states.accountingStatus,
      recordStatus: states.recordStatus,
      ownerOrgId,
      sourceRequestId: request.id
    };
  }

  async create(currentUser: CurrentUser, dto: CreateShelterRequestDto) {
    const data = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined)
    ) as Prisma.JsonObject;

    if (data.ownerOrgId === undefined && currentUser.orgId !== null) {
      data.ownerOrgId = currentUser.orgId;
    }

    return this.prisma.shelterRequest.create({
      data: {
        createdById: currentUser.sub,
        data
      }
    });
  }

  async findAll(currentUser: CurrentUser, status?: ShelterRequestStatus) {
    const visibilityWhere = this.getVisibleRequestsWhere(currentUser);
    const where: Prisma.ShelterRequestWhereInput = {
      ...visibilityWhere
    };

    if (status) {
      where.status = status;
    }

    return this.prisma.shelterRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            orgId: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            email: true,
            role: true
          }
        }
      }
    });
  }

  async findOne(id: string, currentUser: CurrentUser) {
    const request = await this.prisma.shelterRequest.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
            orgId: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            email: true,
            role: true
          }
        },
        shelter: true
      }
    });

    if (!request) {
      throw new NotFoundException('Shelter request not found');
    }

    const isOwner = request.createdById === currentUser.sub;
    const canView = currentUser.role === UserRole.REGIONAL || currentUser.role === UserRole.DSNS || isOwner;

    if (!canView) {
      throw new ForbiddenException('You cannot view this request');
    }

    return request;
  }

  async review(id: string, currentUser: CurrentUser, dto: ReviewShelterRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.shelterRequest.findUnique({
        where: { id },
        include: {
          createdBy: true
        }
      });

      if (!request) {
        throw new NotFoundException('Shelter request not found');
      }

      if (request.status !== ShelterRequestStatus.NEW) {
        throw new ConflictException('Only new requests can be reviewed');
      }

      if (dto.decision === ReviewDecision.REJECT) {
        return tx.shelterRequest.update({
          where: { id },
          data: {
            status: ShelterRequestStatus.REJECTED,
            rejectionReason: dto.rejectionReason,
            reviewedById: currentUser.sub,
            reviewedAt: new Date()
          }
        });
      }

      await tx.shelter.upsert({
        where: {
          sourceRequestId: request.id
        },
        create: this.buildShelterData(request),
        update: this.buildShelterData(request) as Prisma.ShelterUncheckedUpdateInput
      });

      return tx.shelterRequest.update({
        where: { id },
        data: {
          status: ShelterRequestStatus.APPROVED,
          reviewedById: currentUser.sub,
          reviewedAt: new Date()
        },
        include: {
          shelter: true
        }
      });
    });
  }

  async updateStatus(id: string, currentUser: CurrentUser, dto: UpdateShelterRequestStatusDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.shelterRequest.findUnique({
        where: { id },
        include: {
          createdBy: true,
          shelter: true
        }
      });

      if (!request) {
        throw new NotFoundException('Shelter request not found');
      }

      if (request.status === ShelterRequestStatus.APPROVED && dto.status !== ShelterRequestStatus.APPROVED) {
        throw new ConflictException('Approved requests cannot be moved to another status');
      }

      if (request.status === dto.status) {
        return request;
      }

      if (dto.status === ShelterRequestStatus.APPROVED) {
        await tx.shelter.upsert({
        where: {
          sourceRequestId: request.id
        },
        create: this.buildShelterData(request),
        update: this.buildShelterData(request) as Prisma.ShelterUncheckedUpdateInput
      });

        return tx.shelterRequest.update({
          where: { id },
          data: {
            status: ShelterRequestStatus.APPROVED,
            rejectionReason: null,
            reviewedById: currentUser.sub,
            reviewedAt: new Date()
          },
          include: {
            shelter: true
          }
        });
      }

      if (dto.status === ShelterRequestStatus.REJECTED) {
        return tx.shelterRequest.update({
          where: { id },
          data: {
            status: ShelterRequestStatus.REJECTED,
            rejectionReason: dto.rejectionReason ?? request.rejectionReason,
            reviewedById: currentUser.sub,
            reviewedAt: new Date()
          },
          include: {
            shelter: true
          }
        });
      }

      if (dto.status === ShelterRequestStatus.NEW) {
        if (request.shelter) {
          throw new ConflictException('Approved requests with linked shelters cannot be reopened');
        }

        return tx.shelterRequest.update({
          where: { id },
          data: {
            status: ShelterRequestStatus.NEW,
            rejectionReason: null,
            reviewedById: null,
            reviewedAt: null
          },
          include: {
            shelter: true
          }
        });
      }

      throw new ConflictException('Unsupported status transition');
    });
  }
}
