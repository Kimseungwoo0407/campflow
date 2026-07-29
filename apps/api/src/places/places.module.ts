import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { PlacesController } from "./places.controller";
import { PlacesService } from "./places.service";

@Module({
  imports: [TripsModule],
  controllers: [PlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
