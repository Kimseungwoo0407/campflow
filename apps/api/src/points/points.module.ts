import { Global, Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { PointsController } from "./points.controller";
import { PointsService } from "./points.service";

@Global()
@Module({
  imports: [TripsModule],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
