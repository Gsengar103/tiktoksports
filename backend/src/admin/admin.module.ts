import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { AdminController } from "./admin.controller";

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [AdminController],
})
export class AdminModule {}
