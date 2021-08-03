import Point from './Point.mjs';

export default class Line {
  constructor(from = new Point(0, 0), to = new Point(0, 0)) {
    this.from = from;
    this.to = to;
  }

  getPoints() {
    const result = [];
    const t = Math.sqrt(
      (this.from.x - this.to.x) ** 2 + (this.from.y - this.to.y) ** 2
    );
    if (t === 0) return result;
    let [x, y] = this.from;
    const [dx, dy] = [this.to.x - this.from.x, this.to.y - this.from.y].map(
      (d) => d / t
    );
    for (let dt = 0; dt <= t; dt++) {
      result.push(
        new Point(x + dx * dt, y + dy * dt).conversion((p) =>
          p.map((p) => Math.round(p))
        )
      );
    }
    return result;
  }
}
