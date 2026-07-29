import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  CreateFileUploadInput,
  CreateMealInput,
  CreateTaskInput,
  CreateVehicleInput,
  UpdateTaskInput,
} from "@campflow/contracts";
import { newId } from "@campflow/domain";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { PointsService } from "../points/points.service";
import { TripAccessService } from "../trips/trip-access.service";

const taskTemplate = [
  ["숙박", "예약 정보와 체크인 시간 확인", "HIGH"],
  ["취사", "바비큐 고기와 채소 준비", "HIGH"],
  ["취사", "물·음료·얼음 준비", "MEDIUM"],
  ["의약", "상비약과 벌레 퇴치제 챙기기", "HIGH"],
  ["전자기기", "멀티탭과 충전기 챙기기", "MEDIUM"],
  ["날씨", "우산과 여벌 옷 확인", "MEDIUM"],
  ["공용", "보드게임과 블루투스 스피커", "LOW"],
  ["공용", "쓰레기봉투와 키친타월", "MEDIUM"],
  ["개인", "세면도구와 수건", "MEDIUM"],
  ["개인", "신분증과 개인 약", "HIGH"],
] as const;

interface Ingredient {
  name: string;
  quantity: number;
  unit: string;
}

@Injectable()
export class PreparationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
    private readonly config: ConfigService,
    private readonly points: PointsService,
  ) {}

  async tasks(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.tripTask.findMany({
      where: { tripId },
      include: {
        assignee: { select: { id: true, nickname: true } },
        createdBy: { select: { id: true, nickname: true } },
      },
      orderBy: [{ completedAt: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    });
  }

  async createTask(userId: string, tripId: string, input: CreateTaskInput) {
    await this.access.requireWriter(userId, tripId);
    if (input.assigneeId) await this.assertTripMember(tripId, input.assigneeId);
    return this.prisma.tripTask.create({
      data: {
        id: newId(),
        tripId,
        createdById: userId,
        category: input.category,
        title: input.title,
        ...(input.note === undefined ? {} : { note: input.note }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ...(input.dueAt === undefined ? {} : { dueAt: new Date(input.dueAt) }),
        priority: input.priority,
        ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
      },
      include: { assignee: { select: { id: true, nickname: true } } },
    });
  }

  async createTaskTemplate(userId: string, tripId: string) {
    await this.access.requireWriter(userId, tripId);
    const existing = await this.prisma.tripTask.count({ where: { tripId } });
    if (existing === 0) {
      await this.prisma.tripTask.createMany({
        data: taskTemplate.map(([category, title, priority]) => ({
          id: newId(),
          tripId,
          createdById: userId,
          category,
          title,
          priority,
          dueAt: new Date("2026-08-28T12:00:00+09:00"),
        })),
      });
    }
    return this.tasks(userId, tripId);
  }

  async updateTask(userId: string, taskId: string, input: UpdateTaskInput) {
    const task = await this.requireTask(taskId);
    await this.access.requireWriter(userId, task.tripId);
    if (input.assigneeId) await this.assertTripMember(task.tripId, input.assigneeId);
    const updated = await this.prisma.tripTask.update({
      where: { id: taskId },
      data: {
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.note === undefined ? {} : { note: input.note }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ...(input.dueAt === undefined ? {} : { dueAt: new Date(input.dueAt) }),
        ...(input.priority === undefined ? {} : { priority: input.priority }),
        ...(input.quantity === undefined ? {} : { quantity: input.quantity }),
        ...(input.completed === undefined
          ? {}
          : { completedAt: input.completed ? new Date() : null }),
      },
      include: { assignee: { select: { id: true, nickname: true } } },
    });
    if (task.completedAt === null && input.completed === true) {
      await this.points.awardActivity(task.tripId, userId, "TASK", task.id);
    }
    return updated;
  }

  async removeTask(userId: string, taskId: string) {
    const task = await this.requireTask(taskId);
    await this.access.requireWriter(userId, task.tripId);
    await this.prisma.tripTask.delete({ where: { id: taskId } });
    return { deleted: true };
  }

  async meals(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.meal.findMany({
      where: { tripId },
      include: { assignee: { select: { id: true, nickname: true } } },
      orderBy: { mealAt: "asc" },
    });
  }

  async createMeal(userId: string, tripId: string, input: CreateMealInput) {
    await this.access.requireWriter(userId, tripId);
    if (input.assigneeId) await this.assertTripMember(tripId, input.assigneeId);
    return this.prisma.meal.create({
      data: {
        id: newId(),
        tripId,
        mealAt: new Date(input.mealAt),
        menu: input.menu,
        ...(input.note === undefined ? {} : { note: input.note }),
        ...(input.assigneeId === undefined ? {} : { assigneeId: input.assigneeId }),
        ingredients: input.ingredients,
      },
      include: { assignee: { select: { id: true, nickname: true } } },
    });
  }

  async removeMeal(userId: string, mealId: string) {
    const meal = await this.prisma.meal.findUnique({ where: { id: mealId } });
    if (!meal) throw this.mealNotFound();
    await this.access.requireWriter(userId, meal.tripId);
    await this.prisma.meal.delete({ where: { id: mealId } });
    return { deleted: true };
  }

  async shoppingList(userId: string, tripId: string) {
    const meals = await this.meals(userId, tripId);
    const merged = new Map<string, Ingredient>();
    for (const meal of meals) {
      const ingredients = meal.ingredients as unknown as Ingredient[];
      for (const ingredient of ingredients) {
        const key = `${ingredient.name.trim().toLocaleLowerCase("ko-KR")}|${ingredient.unit}`;
        const previous = merged.get(key);
        merged.set(key, {
          name: ingredient.name,
          unit: ingredient.unit,
          quantity: (previous?.quantity ?? 0) + ingredient.quantity,
        });
      }
    }
    return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "ko-KR"));
  }

  async vehicles(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.vehicle.findMany({
      where: { tripId },
      include: {
        owner: { select: { id: true, nickname: true } },
        driver: { select: { id: true, nickname: true } },
        passengers: {
          include: { user: { select: { id: true, nickname: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async createVehicle(userId: string, tripId: string, input: CreateVehicleInput) {
    await this.access.requireWriter(userId, tripId);
    await this.assertTripMember(tripId, input.driverId);
    const passengerIds = [...new Set(input.passengerIds)];
    for (const passengerId of passengerIds) {
      await this.assertTripMember(tripId, passengerId);
    }
    if (passengerIds.length > input.seats - 1) {
      throw new ForbiddenException({
        code: "VEHICLE_CAPACITY_EXCEEDED",
        message: "운전자를 제외한 좌석 수보다 탑승자가 많습니다.",
      });
    }
    const vehicle = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.vehicle.create({
        data: {
          id: newId(),
          tripId,
          ownerId: userId,
          driverId: input.driverId,
          name: input.name,
          seats: input.seats,
          departureLocation: input.departureLocation,
          ...(input.departureAt === undefined ? {} : { departureAt: new Date(input.departureAt) }),
          ...(input.note === undefined ? {} : { note: input.note }),
        },
      });
      if (passengerIds.length > 0) {
        await transaction.rideAssignment.createMany({
          data: passengerIds.map((passengerId) => ({
            vehicleId: created.id,
            userId: passengerId,
          })),
        });
      }
      return created;
    });
    return this.prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicle.id },
      include: {
        owner: { select: { id: true, nickname: true } },
        driver: { select: { id: true, nickname: true } },
        passengers: { include: { user: { select: { id: true, nickname: true } } } },
      },
    });
  }

  async removeVehicle(userId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw this.vehicleNotFound();
    const membership = await this.access.requireMembership(userId, vehicle.tripId);
    if (vehicle.ownerId !== userId && membership.role !== "MANAGER") {
      throw new ForbiddenException({
        code: "VEHICLE_OWNER_REQUIRED",
        message: "차량 등록자 또는 여행 관리자만 삭제할 수 있습니다.",
      });
    }
    await this.prisma.vehicle.delete({ where: { id: vehicleId } });
    return { deleted: true };
  }

  async transportValidation(userId: string, tripId: string) {
    const [members, vehicles] = await Promise.all([
      this.access.members(tripId),
      this.vehicles(userId, tripId),
    ]);
    const assigned = new Set<string>();
    vehicles.forEach((vehicle) => {
      assigned.add(vehicle.driver.id);
      vehicle.passengers.forEach((passenger) => assigned.add(passenger.user.id));
    });
    return {
      totalMembers: members.length,
      totalSeats: vehicles.reduce((sum, vehicle) => sum + vehicle.seats, 0),
      assignedCount: assigned.size,
      unassigned: members
        .filter((member) => !assigned.has(member.userId))
        .map((member) => member.user),
      valid: members.every((member) => assigned.has(member.userId)),
    };
  }

  async files(userId: string, tripId: string) {
    await this.access.requireMembership(userId, tripId);
    return this.prisma.fileObject.findMany({
      where: { tripId, status: "READY" },
      include: { owner: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async uploadFile(userId: string, tripId: string, input: CreateFileUploadInput) {
    await this.access.requireWriter(userId, tripId);
    const data = Buffer.from(input.dataBase64, "base64");
    if (data.length === 0 || data.length > 5 * 1024 * 1024) {
      throw new ForbiddenException({
        code: "INVALID_FILE_SIZE",
        message: "파일은 5MB 이하여야 합니다.",
      });
    }
    this.assertFileSignature(input.mime, data);
    const extension = this.extensionForMime(input.mime);
    const fileName = `${randomBytes(24).toString("hex")}${extension}`;
    const directory = this.storageDirectory();
    await mkdir(directory, { recursive: true });
    const filePath = resolve(directory, fileName);
    await writeFile(filePath, data, { flag: "wx" });
    return this.prisma.fileObject.create({
      data: {
        id: newId(),
        tripId,
        ownerId: userId,
        originalName: input.originalName,
        mime: input.mime,
        size: data.length,
        storageKey: fileName,
        metadata: {
          sha256: createHash("sha256").update(data).digest("hex"),
        },
      },
      include: { owner: { select: { id: true, nickname: true } } },
    });
  }

  async fileContent(userId: string, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, status: "READY" },
    });
    if (!file) throw this.fileNotFound();
    await this.access.requireMembership(userId, file.tripId);
    const data = await readFile(resolve(this.storageDirectory(), file.storageKey));
    return {
      originalName: file.originalName,
      mime: file.mime,
      dataBase64: data.toString("base64"),
    };
  }

  async removeFile(userId: string, fileId: string) {
    const file = await this.prisma.fileObject.findFirst({
      where: { id: fileId, status: "READY" },
    });
    if (!file) throw this.fileNotFound();
    const membership = await this.access.requireMembership(userId, file.tripId);
    if (file.ownerId !== userId && membership.role !== "MANAGER") {
      throw new ForbiddenException({
        code: "FILE_OWNER_REQUIRED",
        message: "파일 등록자 또는 여행 관리자만 삭제할 수 있습니다.",
      });
    }
    await this.prisma.fileObject.update({
      where: { id: fileId },
      data: { status: "DELETED" },
    });
    await unlink(resolve(this.storageDirectory(), file.storageKey)).catch(() => undefined);
    return { deleted: true };
  }

  private async requireTask(taskId: string) {
    const task = await this.prisma.tripTask.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new NotFoundException({
        code: "TASK_NOT_FOUND",
        message: "준비 항목을 찾을 수 없습니다.",
      });
    }
    return task;
  }

  private async assertTripMember(tripId: string, userId: string) {
    const membership = await this.prisma.tripMember.findFirst({
      where: { tripId, userId, attendanceStatus: { not: "REMOVED" } },
    });
    if (!membership) {
      throw new NotFoundException({
        code: "TRIP_MEMBER_NOT_FOUND",
        message: "여행 멤버를 찾을 수 없습니다.",
      });
    }
  }

  private storageDirectory() {
    return resolve(this.config.get<string>("STORAGE_LOCAL_PATH", "storage-data/uploads"));
  }

  private extensionForMime(mime: CreateFileUploadInput["mime"]) {
    return {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "application/pdf": ".pdf",
    }[mime];
  }

  private assertFileSignature(mime: CreateFileUploadInput["mime"], data: Buffer) {
    const signatures: Record<CreateFileUploadInput["mime"], boolean> = {
      "image/jpeg": data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])),
      "image/png": data
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/webp":
        data.subarray(0, 4).toString("ascii") === "RIFF" &&
        data.subarray(8, 12).toString("ascii") === "WEBP",
      "application/pdf": data.subarray(0, 5).toString("ascii") === "%PDF-",
    };
    if (!signatures[mime]) {
      throw new ForbiddenException({
        code: "FILE_SIGNATURE_MISMATCH",
        message: "파일 형식과 실제 내용이 일치하지 않습니다.",
      });
    }
  }

  private mealNotFound() {
    return new NotFoundException({
      code: "MEAL_NOT_FOUND",
      message: "식단을 찾을 수 없습니다.",
    });
  }

  private vehicleNotFound() {
    return new NotFoundException({
      code: "VEHICLE_NOT_FOUND",
      message: "차량을 찾을 수 없습니다.",
    });
  }

  private fileNotFound() {
    return new NotFoundException({
      code: "FILE_NOT_FOUND",
      message: "파일을 찾을 수 없습니다.",
    });
  }
}
