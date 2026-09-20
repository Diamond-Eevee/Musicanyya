export class FakeClock {
  public nowMs = 0;
  advance(ms: number) {
    this.nowMs += ms;
  }
  now() {
    return this.nowMs;
  }
}
