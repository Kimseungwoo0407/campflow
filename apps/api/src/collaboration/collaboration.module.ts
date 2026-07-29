import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { CollaborationController } from "./collaboration.controller";
import { CollaborationService } from "./collaboration.service";

@Module({
  imports: [TripsModule],
  controllers: [CollaborationController],
  providers: [CollaborationService],
})
export class CollaborationModule {}
