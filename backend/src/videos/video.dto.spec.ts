import { packageProblems } from "./video.dto";
import { AssetRole } from "@prisma/client";

describe("packageProblems", () => {
  const roles = [AssetRole.THUMB_SM, AssetRole.THUMB_LG, AssetRole.PREVIEW, AssetRole.PLAYLIST];

  it("accepts a complete package", () => {
    expect(packageProblems(roles, 10_000)).toBeNull();
  });

  it("accepts any positive duration, including longer than 60 seconds", () => {
    expect(packageProblems(roles, 60_001)).toBeNull();
    expect(packageProblems(roles, 3_600_000)).toBeNull();
  });

  it("rejects a non-positive duration or a package missing a preview", () => {
    expect(packageProblems(roles, 0)).toMatch(/at least 1 ms/);
    expect(packageProblems([AssetRole.THUMB_SM, AssetRole.THUMB_LG, AssetRole.PLAYLIST], 1000)).toMatch(/PREVIEW/);
  });
});
