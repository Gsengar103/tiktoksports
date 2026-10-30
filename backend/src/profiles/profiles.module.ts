import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { ProfilesController } from "./profiles.controller";

@Module({ imports: [StorageModule], controllers: [ProfilesController] })
export class ProfilesModule {}
