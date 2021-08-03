import Point from './Point.mjs';
import Line from './Line.mjs';

export default class Path {
  constructor(point) {
    this.points = [point.conversion((p) => p.map((p) => Math.round(p)))];
  }

  addPoint(point) {
    this.points.push(point.conversion((p) => p.map((p) => Math.round(p))));
  }

  isClosed() {
    return this.points[0].equals(this.points[this.points.length - 1]);
  }

  close() {
    if (this.isClosed()) return;
    this.points.push(new Point(...this.points[0]));
  }

  getLines() {
    if (this.points.length <= 1) return [];
    const lines = [];
    for (let i = 1; i < this.points.length; i++) {
      lines.push(new Line(this.points[i - 1], this.points[i]));
    }
    return lines;
  }
}
