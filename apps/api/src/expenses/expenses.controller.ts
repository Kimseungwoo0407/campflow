import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  createExpenseSchema,
  updatePaymentSchema,
  type CreateExpenseInput,
  type UpdatePaymentInput,
} from "@campflow/contracts";
import { CurrentUser } from "../common/auth/current-user.decorator";
import type { AuthenticatedUser } from "../common/http/request-context";
import { ZodValidationPipe } from "../common/validation/zod-validation.pipe";
import { ExpensesService } from "./expenses.service";

@ApiTags("Expenses & Settlements")
@ApiBearerAuth()
@Controller()
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get("trips/:tripId/expenses")
  list(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.expenses.list(user.id, tripId);
  }

  @Post("trips/:tripId/expenses")
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("tripId") tripId: string,
    @Body(new ZodValidationPipe(createExpenseSchema)) input: CreateExpenseInput,
  ) {
    return this.expenses.create(user.id, tripId, input);
  }

  @Delete("expenses/:id")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") expenseId: string) {
    return this.expenses.remove(user.id, expenseId);
  }

  @Post("trips/:tripId/settlements/calculate")
  calculate(@CurrentUser() user: AuthenticatedUser, @Param("tripId") tripId: string) {
    return this.expenses.calculate(user.id, tripId);
  }

  @Post("settlements/:id/lock")
  lock(@CurrentUser() user: AuthenticatedUser, @Param("id") settlementId: string) {
    return this.expenses.lock(user.id, settlementId);
  }

  @Patch("settlement-payments/:id")
  updatePayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") paymentId: string,
    @Body(new ZodValidationPipe(updatePaymentSchema)) input: UpdatePaymentInput,
  ) {
    return this.expenses.updatePayment(user.id, paymentId, input);
  }
}
