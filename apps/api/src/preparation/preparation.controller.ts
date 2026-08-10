import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createFileUploadSchema,
  createMealSchema,
  createTaskSchema,
  createVehicleSchema,
  updateMealSchema,
  updateTaskSchema,
  updateVehicleSchema,
  type CreateFileUploadInput,
  type CreateMealInput,
  type CreateTaskInput,
  type CreateVehicleInput,
  type UpdateMealInput,
  type UpdateTaskInput,
  type UpdateVehicleInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { PreparationService } from "./preparation.service";

@ApiTags("Tasks, Meals, Transport & Files")
@ApiBearerAuth()
@Controller()
export class PreparationController {
  constructor(private readonly preparation: PreparationService) {}

  @Get("trips/:tripId/tasks")
  tasks(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.preparation.tasks(user.id, tripId);
  }

  @Post("trips/:tripId/tasks")
  createTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createTaskSchema)) input: CreateTaskInput,
  ) {
    return this.preparation.createTask(user.id, tripId, input);
  }

  @Post("trips/:tripId/tasks/from-template")
  createTaskTemplate(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.preparation.createTaskTemplate(user.id, tripId);
  }

  @Patch("tasks/:id")
  updateTask(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") taskId: string,
    @Body(new ZodValidationPipe(updateTaskSchema)) input: UpdateTaskInput,
  ) {
    return this.preparation.updateTask(user.id, taskId, input);
  }

  @Delete("tasks/:id")
  removeTask(@CurrentUser() user: AuthenticatedUser, @Param("id") taskId: string) {
    return this.preparation.removeTask(user.id, taskId);
  }

  @Get("trips/:tripId/meals")
  meals(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.preparation.meals(user.id, tripId);
  }

  @Post("trips/:tripId/meals")
  createMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createMealSchema)) input: CreateMealInput,
  ) {
    return this.preparation.createMeal(user.id, tripId, input);
  }

  @Patch("meals/:id")
  updateMeal(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") mealId: string,
    @Body(new ZodValidationPipe(updateMealSchema)) input: UpdateMealInput,
  ) {
    return this.preparation.updateMeal(user.id, mealId, input);
  }

  @Delete("meals/:id")
  removeMeal(@CurrentUser() user: AuthenticatedUser, @Param("id") mealId: string) {
    return this.preparation.removeMeal(user.id, mealId);
  }

  @Get("trips/:tripId/shopping-list")
  shoppingList(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.preparation.shoppingList(user.id, tripId);
  }

  @Get("trips/:tripId/vehicles")
  vehicles(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.preparation.vehicles(user.id, tripId);
  }

  @Post("trips/:tripId/vehicles")
  createVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createVehicleSchema)) input: CreateVehicleInput,
  ) {
    return this.preparation.createVehicle(user.id, tripId, input);
  }

  @Patch("vehicles/:id")
  updateVehicle(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") vehicleId: string,
    @Body(new ZodValidationPipe(updateVehicleSchema)) input: UpdateVehicleInput,
  ) {
    return this.preparation.updateVehicle(user.id, vehicleId, input);
  }

  @Delete("vehicles/:id")
  removeVehicle(@CurrentUser() user: AuthenticatedUser, @Param("id") vehicleId: string) {
    return this.preparation.removeVehicle(user.id, vehicleId);
  }

  @Get("trips/:tripId/transport/validation")
  transportValidation(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.preparation.transportValidation(user.id, tripId);
  }

  @Get("trips/:tripId/files")
  files(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.preparation.files(user.id, tripId);
  }

  @Post("trips/:tripId/files")
  uploadFile(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createFileUploadSchema)) input: CreateFileUploadInput,
  ) {
    return this.preparation.uploadFile(user.id, tripId, input);
  }

  @Get("files/:id/content")
  fileContent(@CurrentUser() user: AuthenticatedUser, @Param("id") fileId: string) {
    return this.preparation.fileContent(user.id, fileId);
  }

  @Delete("files/:id")
  removeFile(@CurrentUser() user: AuthenticatedUser, @Param("id") fileId: string) {
    return this.preparation.removeFile(user.id, fileId);
  }
}
