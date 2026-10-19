import { packageProblems } from "./video.dto";
import { AssetRole } from "@prisma/client";

describe("packageProblems", () => {
  const roles = [AssetRole.THUMB_SM, AssetRole.THUMB_LG, AssetRole.PREVIEW, AssetRole.PLAYLIST];

  it("accepts a complete package", () => {
    expect(packageProblems(roles, 10_000)).toBeNull();
  });

  it("rejects a package over 60 seconds or missing a preview", () => {
    expect(packageProblems(roles, 60_001)).toMatch(/60 seconds/);
    expect(packageProblems([AssetRole.THUMB_SM, AssetRole.THUMB_LG, AssetRole.PLAYLIST], 1000)).toMatch(/PREVIEW/);
  });
});
