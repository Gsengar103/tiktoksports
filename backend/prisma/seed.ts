import { AgeBand, PrismaClient, SportRelation, StaffRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const sports = [
  ["sport.football", "Football", "Team ball"],
  ["sport.cricket", "Cricket", "Team ball"],
  ["sport.basketball", "Basketball", "Team ball"],
  ["sport.badminton", "Badminton", "Racket and bat"],
  ["sport.tennis", "Tennis", "Racket and bat"],
  ["sport.table-tennis", "Table tennis", "Racket and bat"],
  ["sport.boxing", "Boxing", "Combat"],
  ["sport.running", "Running", "Athletics and running"],
  ["sport.gym", "Gym and weightlifting", "Strength and fitness"],
  ["sport.swimming", "Swimming", "Water"],
  ["sport.cycling", "Cycling", "Cycling and motorsport"],
];

const contentTypes = [
  ["type.play", "Play and action"],
  ["type.learn", "Learn"],
  ["type.get-started", "Get started"],
  ["type.news", "News and updates"],
  ["type.analysis", "Analysis and opinion"],
  ["type.fan", "Fan culture and fun"],
];

const levels = [
  ["level.beginner", "Beginner"],
  ["level.recreational", "Recreational"],
  ["level.intermediate", "Intermediate or competitive amateur"],
  ["level.elite", "Elite or pro"],
];

async function main(): Promise<void> {
  for (const [id, name, family] of sports) {
    await prisma.sport.upsert({ where: { id }, update: { name, family }, create: { id, name, family } });
  }
  for (const [id, name] of contentTypes) {
    await prisma.contentType.upsert({ where: { id }, update: { name }, create: { id, name } });
  }
  for (const [id, name] of levels) {
    await prisma.level.upsert({ where: { id }, update: { name }, create: { id, name } });
  }

  const password = process.env.SEED_PASSWORD;
  if (!password) {
    console.log("Taxonomy seeded. Set SEED_PASSWORD to also create dev accounts.");
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  await upsertUser("adult@dev.local", "Adult Dev", "2000-01-01", StaffRole.USER, passwordHash);
  await upsertUser("teen@dev.local", "Teen Dev", "2010-01-01", StaffRole.USER, passwordHash);
  await upsertUser("admin@dev.local", "Admin Dev", "1990-01-01", StaffRole.SUPER_ADMIN, passwordHash);
  console.log("Taxonomy and dev accounts seeded.");
}

async function upsertUser(email: string, displayName: string, dob: string, role: StaffRole, passwordHash: string) {
  const dateOfBirth = new Date(dob);
  const ageBand = role === StaffRole.USER && email.startsWith("teen") ? AgeBand.AGE_16_17 : AgeBand.AGE_18_PLUS;
  const user = await prisma.user.upsert({
    where: { email },
    update: { displayName, role, passwordHash },
    create: { email, displayName, dateOfBirth, ageBand, role, passwordHash, profile: { create: { goal: "WATCH" } } },
  });
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id, goal: "WATCH" },
  });
  await prisma.profileSport.upsert({
    where: { profileId_sportId_relation: { profileId: user.id, sportId: "sport.cricket", relation: SportRelation.FOLLOWS } },
    update: {},
    create: { profileId: user.id, sportId: "sport.cricket", relation: SportRelation.FOLLOWS },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
