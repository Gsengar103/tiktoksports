export class StubFrameMatcher {
  match(hint: string | null): { matched: boolean } {
    return { matched: hint !== "mismatch" };
  }
}

export class StubScreener {
  screen(caption: string): { hold: boolean; reason?: string } {
    if (caption.toLowerCase().includes("hold-me")) {
      return { hold: true, reason: "stub-screen" };
    }
    return { hold: false };
  }
}
