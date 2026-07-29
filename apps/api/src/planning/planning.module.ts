import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { PlanningController } from "./planning.controller";
import { PlanningService } from "./planning.service";

@Module({
  imports: [TripsModule],
  controllers: [PlanningController],
  providers: [PlanningService],
})
export class PlanningModule {}
