import { AgeBand } from "@prisma/client";
import { ageBandFromDob } from "./age";

const now = new Date("2026-10-19T00:00:00.000Z");

describe("ageBandFromDob", () => {
  it("blocks under 13", () => {
    expect(ageBandFromDob(new Date("2014-10-20T00:00:00.000Z"), now)).toBeNull();
    expect(ageBandFromDob(new Date("2013-10-19T00:00:00.000Z"), now)).toBe(AgeBand.AGE_13_15);
  });

  it("splits the teen bands and adults", () => {
    expect(ageBandFromDob(new Date("2011-01-01T00:00:00.000Z"), now)).toBe(AgeBand.AGE_13_15);
    expect(ageBandFromDob(new Date("2009-06-01T00:00:00.000Z"), now)).toBe(AgeBand.AGE_16_17);
    expect(ageBandFromDob(new Date("2000-01-01T00:00:00.000Z"), now)).toBe(AgeBand.AGE_18_PLUS);
  });
});
