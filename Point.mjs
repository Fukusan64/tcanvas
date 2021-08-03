export default class Point {
    constructor(x, y) {
      this.x = x;
      this.y = y;
    }

    conversion(func) {
      return new Point(...func([this.x, this.y]));
    }

    equals(other) {
      return this.x === other.x && this.y === other.y;
    }

    * [Symbol.iterator]() {
      yield this.x;
      yield this.y;
    }
  }