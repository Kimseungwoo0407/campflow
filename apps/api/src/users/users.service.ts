import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { UpdateProfileInput } from "@campflow/contracts";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        nickname: true,
        locale: true,
        timezone: true,
        status: true,
        emailVerifiedAt: true,
        mustChangePassword: true,
        createdAt: true,
        profile: true,
      },
    });
    if (!user) {
      throw this.notFound();
    }
    return user;
  }

  async update(userId: string, input: UpdateProfileInput) {
    const profileData: Prisma.UserProfileUpdateInput = {};
    if (input.phone !== undefined) profileData.phone = input.phone;
    if (input.allergies !== undefined) profileData.allergies = input.allergies;
    if (input.foodDislikes !== undefined) profileData.foodDislikes = input.foodDislikes;
    if (input.canDrive !== undefined) profileData.canDrive = input.canDrive;
    if (input.notificationPrefs !== undefined) {
      profileData.notificationPrefs = input.notificationPrefs as Prisma.InputJsonValue;
    }
    if (input.privacyPrefs !== undefined) {
      profileData.privacyPrefs = input.privacyPrefs as Prisma.InputJsonValue;
    }

    await this.prisma.$transaction(async (transaction) => {
      if (input.nickname !== undefined) {
        await transaction.user.update({
          where: { id: userId },
          data: { nickname: input.nickname },
        });
      }
      if (Object.keys(profileData).length > 0) {
        const createProfile: Prisma.UserProfileUncheckedCreateInput = {
          userId,
          allergies: input.allergies ?? [],
          foodDislikes: input.foodDislikes ?? [],
          canDrive: input.canDrive ?? false,
          notificationPrefs: (input.notificationPrefs ?? {}) as Prisma.InputJsonValue,
          privacyPrefs: (input.privacyPrefs ?? {}) as Prisma.InputJsonValue,
          ...(input.phone === undefined ? {} : { phone: input.phone }),
        };
        await transaction.userProfile.upsert({
          where: { userId },
          update: profileData,
          create: createProfile,
        });
      }
    });

    await this.audit.record({
      actorId: userId,
      action: "user.profile_updated",
      targetType: "User",
      targetId: userId,
      metadata: { fields: Object.keys(input) },
    });
    return this.me(userId);
  }

  async publicProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: "ACTIVE" },
      select: { id: true, nickname: true, locale: true },
    });
    if (!user) {
      throw this.notFound();
    }
    return user;
  }

  private notFound(): NotFoundException {
    return new NotFoundException({
      code: "USER_NOT_FOUND",
      message: "사용자를 찾을 수 없습니다.",
    });
  }
}
