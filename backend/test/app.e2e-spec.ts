import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AssetRole, PrismaClient, StaffRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/main";

const prisma = new PrismaClient();
const password = "dev-password-1";

describe("API", () => {
  let app: INestApplication;
  let adultToken = "";
  let adminToken = "";

  beforeAll(async () => {
    await prisma.sport.upsert({
      where: { id: "sport.cricket" },
      update: {},
      create: { id: "sport.cricket", name: "Cricket", family: "Team ball" },
    });
    await prisma.contentType.upsert({
      where: { id: "type.learn" },
      update: {},
      create: { id: "type.learn", name: "Learn" },
    });
    await prisma.level.upsert({
      where: { id: "level.beginner" },
      update: {},
      create: { id: "level.beginner", name: "Beginner" },
    });
    const admin = await prisma.user.upsert({
      where: { email: "admin-e2e@dev.local" },
      update: { role: StaffRole.SUPER_ADMIN, passwordHash: await bcrypt.hash(password, 4) },
      create: {
        email: "admin-e2e@dev.local",
        displayName: "E2E Admin",
        dateOfBirth: new Date("1990-01-01"),
        ageBand: "AGE_18_PLUS",
        role: StaffRole.SUPER_ADMIN,
        passwordHash: await bcrypt.hash(password, 4),
        profile: { create: {} },
      },
    });
    expect(admin.role).toBe(StaffRole.SUPER_ADMIN);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const registered = await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: "adult-e2e@dev.local", password, displayName: "Adult", dateOfBirth: "2000-01-01" });
    if (registered.status !== 201) {
      throw new Error(`Adult register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
    }
    adultToken = registered.body.accessToken;
  }, 30_000);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("reports health", async () => {
    const res = await request(app.getHttpServer()).get("/health").expect(200);
    expect(res.body.postgres).toBe("up");
    expect(res.body.redis).toBe("up");
  });

  it("blocks under 13", async () => {
    await request(app.getHttpServer())
      .post("/v1/auth/register")
      .send({ email: "child@dev.local", password, displayName: "Child", dateOfBirth: "2020-01-01" })
      .expect(403);
  });

  it("saves a profile and publishes a clean video", async () => {
    await request(app.getHttpServer())
      .put("/v1/me/profile")
      .set("authorization", `Bearer ${adultToken}`)
      .send({
        cityVisible: false,
        goal: "PLAY_MORE",
        sports: [{ sportId: "sport.cricket", relation: "FOLLOWS", levelId: "level.beginner" }],
      })
      .expect(200);

    const created = await request(app.getHttpServer())
      .post("/v1/videos")
      .set("authorization", `Bearer ${adultToken}`)
      .send({
        caption: "first drill",
        sportId: "sport.cricket",
        contentTypeId: "type.learn",
        levelId: "level.beginner",
        durationMs: 8000,
      })
      .expect(201);

    const urls = await request(app.getHttpServer())
      .post(`/v1/videos/${created.body.id}/upload-urls`)
      .set("authorization", `Bearer ${adultToken}`)
      .send({
        assets: [
          { role: AssetRole.THUMB_SM, contentType: "image/webp" },
          { role: AssetRole.THUMB_LG, contentType: "image/webp" },
          { role: AssetRole.PREVIEW, contentType: "video/mp4" },
          { role: AssetRole.PLAYLIST, contentType: "application/vnd.apple.mpegurl" },
        ],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/videos/${created.body.id}/complete`)
      .set("authorization", `Bearer ${adultToken}`)
      .send({
        durationMs: 8000,
        fixture: "clean",
        assets: urls.body.assets.map((asset: { role: string; key: string }) => ({ role: asset.role, key: asset.key })),
      })
      .expect(201);

    const live = await waitForStatus(created.body.id, "LIVE");
    expect(live.status).toBe("LIVE");

    const feed = await request(app.getHttpServer()).get("/v1/feed").set("authorization", `Bearer ${adultToken}`).expect(200);
    expect(feed.body.videos.some((video: { id: string }) => video.id === created.body.id)).toBe(true);

    const pub = await request(app.getHttpServer()).get(`/v1/public/videos/${created.body.id}`).expect(200);
    expect(pub.body.creator.displayName).toBe("Adult");
  });

  it("holds a mismatch and lets an admin remove a held video from the public route", async () => {
    const created = await request(app.getHttpServer())
      .post("/v1/videos")
      .set("authorization", `Bearer ${adultToken}`)
      .send({
        caption: "hold-me later",
        sportId: "sport.cricket",
        contentTypeId: "type.learn",
        levelId: "level.beginner",
        durationMs: 4000,
      })
      .expect(201);
    const urls = await request(app.getHttpServer())
      .post(`/v1/videos/${created.body.id}/upload-urls`)
      .set("authorization", `Bearer ${adultToken}`)
      .send({
        assets: [
          { role: "THUMB_SM", contentType: "image/jpeg" },
          { role: "THUMB_LG", contentType: "image/jpeg" },
          { role: "PREVIEW", contentType: "video/mp4" },
          { role: "PROGRESSIVE", contentType: "video/mp4" },
        ],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/videos/${created.body.id}/complete`)
      .set("authorization", `Bearer ${adultToken}`)
      .send({
        durationMs: 4000,
        fixture: "mismatch",
        assets: urls.body.assets.map((asset: { role: string; key: string }) => ({ role: asset.role, key: asset.key })),
      })
      .expect(201);

    await waitForStatus(created.body.id, "HELD");
    const feed = await request(app.getHttpServer()).get("/v1/feed").set("authorization", `Bearer ${adultToken}`).expect(200);
    expect(feed.body.videos.some((video: { id: string }) => video.id === created.body.id)).toBe(false);

    const login = await request(app.getHttpServer())
      .post("/admin/auth/login")
      .send({ email: "admin-e2e@dev.local", password })
      .expect(201);
    adminToken = login.body.accessToken;
    const queue = await request(app.getHttpServer()).get("/admin/queue").set("authorization", `Bearer ${adminToken}`).expect(200);
    const found = queue.body.cases.find((item: { videoId: string }) => item.videoId === created.body.id);
    expect(found).toBeTruthy();

    await request(app.getHttpServer())
      .post(`/admin/cases/${found.id}/decision`)
      .set("authorization", `Bearer ${adminToken}`)
      .send({ action: "REMOVE", reason: "fixture mismatch" })
      .expect(201);
    await request(app.getHttpServer()).get(`/v1/public/videos/${created.body.id}`).expect(404);
  });

  async function waitForStatus(id: string, status: string) {
    const started = Date.now();
    while (Date.now() - started < 10_000) {
      const res = await request(app.getHttpServer()).get(`/v1/videos/${id}`).set("authorization", `Bearer ${adultToken}`);
      if (res.body.status === status) return res.body as { status: string };
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Video ${id} did not reach ${status}`);
  }
});
