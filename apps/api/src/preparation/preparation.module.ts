import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { PreparationController } from "./preparation.controller";
import { PreparationService } from "./preparation.service";

@Module({
  imports: [TripsModule],
  controllers: [PreparationController],
  providers: [PreparationService],
})
export class PreparationModule {}
