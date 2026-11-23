import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountingStatus, Prisma, RecordStatus, ShelterRequestStatus, ShelterStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateShelterDto } from './dto/update-shelter.dto';

const SHELTER_STATUS_TRANSITIONS: Record<ShelterStatus, ShelterStatus[]> = {
  NEED: ['PROJECT', 'OPERATION', 'DESTROYED'],
  PROJECT: ['CONSTRUCTION', 'DESTROYED'],
  CONSTRUCTION: ['OPERATION', 'DESTROYED'],
  OPERATION: ['MODERNIZATION', 'REPAIR', 'CONSERVATION', 'MISUSE', 'DESTROYED'],
  MODERNIZATION: ['OPERATION', 'DESTROYED'],
  REPAIR: ['OPERATION', 'DESTROYED'],
  CONSERVATION: ['REPAIR', 'DESTROYED'],
  MISUSE: ['DESTROYED'],
  DESTROYED: []
};

const ACCOUNTING_STATUS_TRANSITIONS: Record<AccountingStatus, AccountingStatus[]> = {
  NEW: ['IN_PROGRESS'],
  IN_PROGRESS: ['ACCOUNTED', 'REJECTED'],
  ACCOUNTED: ['IN_PROGRESS', 'REMOVED'],
  REMOVED: ['ACCOUNTED'],
  REJECTED: []
};

const RECORD_STATUS_TRANSITIONS: Record<RecordStatus, RecordStatus[]> = {
  DRAFT: ['ACTIVE', 'DELETED'],
  ACTIVE: ['SUSPENDED', 'DELETED'],
  SUSPENDED: ['ACTIVE', 'DELETED'],
  DELETED: ['DRAFT']
};

function getShelterAddress(data: Prisma.JsonValue | null | undefined) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.address === 'string' && record.address.trim()) {
    return record.address.trim();
  }

  return null;
}

function getShelterNumber(data: Prisma.JsonValue | null | undefined) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const candidates = [record.accountNumber, record.tempNumber, record.technicalNumber, record.buildingRegistryNumber];
  const number = candidates.find((value) => typeof value === 'string' && value.trim());

  return typeof number === 'string' ? number.trim() : null;
}

type CurrentUser = {
  sub: string;
  role: UserRole;
  orgId: string | null;
};

@Injectable()
export class SheltersService {
  constructor(private readonly prisma: PrismaService) {}

  private assertTransition<T extends string>(kind: string, current: T, next: T, transitions: Record<T, T[]>) {
    if (current === next) {
      return;
    }

    const allowed = transitions[current] ?? [];
    if (!allowed.includes(next)) {
      throw new ConflictException(`Unsupported ${kind} status transition`);
    }
  }

  findAll() {
    return this.prisma.shelter.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sourceRequest: {
          select: {
            data: true
          }
        }
      }
    }).then((shelters) =>
      shelters.map(({ sourceRequest, ...shelter }) => ({
        ...shelter,
        shelterNumber: getShelterNumber(sourceRequest?.data),
        address: getShelterAddress(sourceRequest?.data)
      }))
    );
  }

  async findOne(id: string) {
    const shelter = await this.prisma.shelter.findUnique({
      where: { id },
      include: {
        ownerOrg: true,
        sourceRequest: {
          include: {
            createdBy: true,
            reviewedBy: true
          }
        },
        inspections: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdByUser: true
          }
        }
      }
    });

    if (!shelter) {
      throw new NotFoundException('Shelter not found');
    }

    return shelter;
  }

  async update(id: string, currentUser: CurrentUser, dto: UpdateShelterDto) {
    const shelter = await this.prisma.shelter.findUnique({
      where: { id },
      include: {
        sourceRequest: true
      }
    });

    if (!shelter) {
      throw new NotFoundException('Shelter not found');
    }

    if (dto.ownerOrgId !== undefined) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: dto.ownerOrgId }
      });

      if (!organization) {
        throw new NotFoundException('Organization not found');
      }
    }

    const shelterData: Record<string, unknown> = {};

    if (dto.name !== undefined) shelterData.name = dto.name;
    if (dto.type !== undefined) shelterData.type = dto.type;
    if (dto.accessType !== undefined) shelterData.accessType = dto.accessType;
    if (dto.capacity !== undefined) shelterData.capacity = dto.capacity;
    if (dto.latitude !== undefined) shelterData.latitude = dto.latitude;
    if (dto.longitude !== undefined) shelterData.longitude = dto.longitude;
    if (dto.status !== undefined) {
      this.assertTransition('shelter', shelter.status, dto.status, SHELTER_STATUS_TRANSITIONS);
      shelterData.status = dto.status;
    }
    if (dto.accountingStatus !== undefined) {
      this.assertTransition('accounting', shelter.accountingStatus, dto.accountingStatus, ACCOUNTING_STATUS_TRANSITIONS);
      shelterData.accountingStatus = dto.accountingStatus;
    }
    if (dto.recordStatus !== undefined) {
      this.assertTransition('record', shelter.recordStatus, dto.recordStatus, RECORD_STATUS_TRANSITIONS);
      shelterData.recordStatus = dto.recordStatus;
    }
    if (dto.ownerOrgId !== undefined) shelterData.ownerOrgId = dto.ownerOrgId;

    if (Object.keys(shelterData).length) {
      await this.prisma.shelter.update({
        where: { id },
        data: shelterData
      });
    }

    if (dto.details !== undefined) {
      const currentData = (shelter.sourceRequest?.data ?? {}) as Record<string, unknown>;
      const mergedData: Prisma.InputJsonValue = {
        name: dto.name ?? shelter.name,
        type: dto.type ?? shelter.type,
        accessType: dto.accessType ?? shelter.accessType,
        capacity: dto.capacity ?? shelter.capacity,
        latitude: dto.latitude ?? shelter.latitude,
        longitude: dto.longitude ?? shelter.longitude,
        ownerOrgId: dto.ownerOrgId ?? shelter.ownerOrgId,
        shelterStatus: dto.status ?? shelter.status,
        accountingStatus: dto.accountingStatus ?? shelter.accountingStatus,
        recordStatus: dto.recordStatus ?? shelter.recordStatus,
        ...currentData,
        ...dto.details
      };

      if (shelter.sourceRequestId) {
        await this.prisma.shelterRequest.update({
          where: { id: shelter.sourceRequestId },
          data: {
            data: mergedData
          }
        });
      } else {
        const sourceRequest = await this.prisma.shelterRequest.create({
          data: {
            createdById: currentUser.sub,
            reviewedById: currentUser.sub,
            reviewedAt: new Date(),
            status: ShelterRequestStatus.APPROVED,
            data: mergedData
          }
        });

        await this.prisma.shelter.update({
          where: { id: shelter.id },
          data: {
            sourceRequestId: sourceRequest.id
          }
        });
      }
    }

    return this.findOne(id);
  }

  pendingVerification() {
    return this.prisma.shelter.findMany({
      where: { status: ShelterStatus.NEED },
      orderBy: { createdAt: 'desc' }
    });
  }
}
