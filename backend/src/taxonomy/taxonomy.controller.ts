import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PrismaService } from "../prisma/prisma.service";

@Controller("v1/taxonomy")
@UseGuards(JwtAuthGuard)
export class TaxonomyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const [sports, contentTypes, levels] = await Promise.all([
      this.prisma.sport.findMany({ orderBy: { name: "asc" } }),
      this.prisma.contentType.findMany({ orderBy: { name: "asc" } }),
      this.prisma.level.findMany({ orderBy: { name: "asc" } }),
    ]);
    return { sports, contentTypes, levels };
  }
}
