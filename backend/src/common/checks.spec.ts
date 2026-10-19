import { StubFrameMatcher, StubScreener } from "./checks";

describe("ingest stubs", () => {
  const matcher = new StubFrameMatcher();
  const screener = new StubScreener();

  it("holds a mismatched fixture and a flagged caption", () => {
    expect(matcher.match("mismatch").matched).toBe(false);
    expect(matcher.match(null).matched).toBe(true);
    expect(screener.screen("please hold-me").hold).toBe(true);
    expect(screener.screen("footwork drill").hold).toBe(false);
  });
});
