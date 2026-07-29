import { Module } from "@nestjs/common";
import { TripsController } from "./trips.controller";
import { TripAccessService } from "./trip-access.service";
import { TripsService } from "./trips.service";

@Module({
  controllers: [TripsController],
  providers: [TripsService, TripAccessService],
  exports: [TripsService, TripAccessService],
})
export class TripsModule {}
