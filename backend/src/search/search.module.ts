import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { SearchController } from "./search.controller";

@Module({ imports: [StorageModule], controllers: [SearchController] })
export class SearchModule {}
