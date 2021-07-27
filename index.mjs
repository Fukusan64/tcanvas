import ansi from 'ansi';

class TextCell {
  constructor() {
    this.character = '\u2800';
    this.beforeCharacter = undefined;
  }

  setCharacter(char) {
    this.character = char;
  }

  setPixelsFromCode(code) {
    const baseCode = 0x2800;
    this.setCharacter(String.fromCodePoint(baseCode + code));
  }

  update() {
    this.beforeCharacter = this.character;
  }

  clear() {
    this.setCharacter('\u2800');
  }

  get isChanged() {
    return this.beforeCharacter !== this.character;
  }
}

class Line {
  constructor(from = [0, 0], to = [0, 0]) {
    Object.assign(this, { from, to });
  }

  getPoints() {
    const result = [];
    const t = Math.sqrt(
      (this.from[0] - this.to[0]) ** 2 + (this.from[1] - this.to[1]) ** 2
    );
    if (t === 0) return result;
    let [x, y] = this.from;
    const [dx, dy] = [this.to[0] - this.from[0], this.to[1] - this.from[1]].map(
      (d) => d / t
    );
    for (let dt = 0; dt <= t; dt++) {
      result.push([x + dx * dt, y + dy * dt].map((p) => Math.round(p)));
    }
    return result;
  }
}

class Path {
  constructor(x, y) {
    this.points = [[x, y].map((p) => Math.round(p))];
  }

  addPoint(x, y) {
    this.points.push([x, y].map((p) => Math.round(p)));
  }

  isClosed() {
    return (
      this.points[0][0] === this.points[this.points.length - 1][0] &&
      this.points[0][1] === this.points[this.points.length - 1][1]
    );
  }

  close() {
    if (this.isClosed()) return;
    const [x, y] = this.points[0];
    this.points.push([x, y]);
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

class Display {
  constructor(w, h) {
    this.textCells = [];
    for (let y = 0; y < h; y++) {
      this.textCells[y] = [];
      for (let x = 0; x < w; x++) {
        this.textCells[y][x] = new TextCell();
      }
    }

    this.cursor = ansi(process.stdout);

    this.codeTable = [[], [], [], []];
    this.codeTable[0][0] = 2 ** 0;
    this.codeTable[1][0] = 2 ** 1;
    this.codeTable[2][0] = 2 ** 2;
    this.codeTable[0][1] = 2 ** 3;
    this.codeTable[1][1] = 2 ** 4;
    this.codeTable[2][1] = 2 ** 5;
    this.codeTable[3][0] = 2 ** 6;
    this.codeTable[3][1] = 2 ** 7;

    this.bitMap = new Map();
  }

  setPixel(x, y) {
    const cx = Math.floor(x / 2);
    const cy = Math.floor(y / 4);
    const px = x < 0 ? (x % 2) + 2 : x % 2;
    const py = y < 0 ? (y % 4) + 4 : y % 4;
    const code = this.bitMap.get(`${cx}, ${cy}`) ?? 0;
    this.bitMap.set(`${cx}, ${cy}`, code | this.codeTable[py][px]);
  }

  updatePixels() {
    this.bitMap.forEach((code, pos) => {
      const [cx, cy] = pos.split(',').map((e) => parseInt(e));
      const target = this.textCells[cy]?.[cx];
      if (target === undefined) return;
      target.setPixelsFromCode(code);
    });
    this.bitMap = new Map();
  }

  setCharacter (str, x, y) {
    const line = this.textCells[Math.floor(y / 4)];
    for (let i = 0; i < str.length; i++) {
      const target = line?.[Math.floor(x / 2) + i];
      if (target === undefined) return;
      target.setCharacter(str[i]);
    }
  }

  clear() {
    this.textCells.forEach((line) => line.forEach((cell) => cell.clear()));
  }

  updateDisplay() {
    this.textCells.forEach((line, y) => {
      for (let xStart = 0; xStart < line.length; xStart++) {
        if (!line[xStart].isChanged) continue;
        let xEnd = xStart;
        do {
          line[xEnd].update();
          xEnd++;
        } while ((line[xEnd] ?? { isChanged: false }).isChanged);
        this.cursor.goto(xStart + 1, y + 1).write(
          line
            .slice(xStart, xEnd)
            .map(({ beforeCharacter }) => beforeCharacter)
            .join('')
        );
      }
    });
    this.cursor.goto(this.cw, this.ch);
  }
}

export default class TCanvas {
  constructor(
    pixelLines = process.stdout.rows * 4,
    pixelColumns = process.stdout.columns * 2
  ) {
    const [ch, cw] = [pixelLines / 4, pixelColumns / 2].map((e) =>
      Math.floor(e)
    );
    this.h = pixelLines;
    this.w = pixelColumns;
    this.ch = ch;
    this.cw = cw;
    this.display = new Display(cw, ch);
    this.paths = [];
  }

  moveTo(x, y) {
    this.paths.push(new Path(x, y));
  }

  lineTo(x, y) {
    this.paths[this.paths.length - 1].addPoint(x, y);
  }

  fillRect(x, y, w, h) {
    for (let xi = 0; xi < w; xi++) {
      for (let yi = 0; yi < h; yi++) {
        this.display.setPixel(x + xi, y + yi);
      }
    }
    this.display.updatePixels();
  }

  strokeRect(x, y, w, h) {
    for (let xi = 0; xi < w; xi++) {
      const xp = xi + x;
      [y, y + h - 1].map((yp) => this.display.setPixel(xp, yp));
    }

    for (let yi = 0; yi < h; yi++) {
      const yp = yi + x;
      [x, x + w - 1].map((xp) => this.display.setPixel(xp, yp));
    }

    this.display.updatePixels();
  }

  arc(x, y, radius, startAngle, endAngle, anticlockwise = false) {
    if (radius === 0) {
      this.moveTo(x, y);
      return;
    }

    // 正規化
    [startAngle, endAngle] = [startAngle, endAngle]
      .map((angle) => angle % (Math.PI * 2))
      .map((angle) => (angle < 0 ? angle + Math.PI * 2 : angle));

    this.moveTo(
      x + Math.cos(startAngle) * radius,
      y + Math.sin(startAngle) * radius
    );

    const dTheta = (Math.PI * 2) / Math.abs(radius);
    if (anticlockwise) {
      if (startAngle <= endAngle) {
        endAngle -= Math.PI * 2;
      }
      for (let theta = startAngle; theta >= endAngle; theta -= dTheta) {
        this.lineTo(x + Math.cos(theta) * radius, y + Math.sin(theta) * radius);
      }
    } else {
      if (startAngle >= endAngle) {
        endAngle += Math.PI * 2;
      }
      for (let theta = startAngle; theta <= endAngle; theta += dTheta) {
        this.lineTo(x + Math.cos(theta) * radius, y + Math.sin(theta) * radius);
      }
    }
  }

  close() {
    this.paths[this.paths.length - 1].close();
  }

  stroke() {
    this.paths.forEach((path) =>
      path.getLines().forEach((line) => {
        line.getPoints().forEach((point) => {
          this.display.setPixel(point[0], point[1]);
        });
      })
    );
    this.display.updatePixels();
    this.paths = [];
  }

  fill() {
    this.paths.forEach((path) => {
      path.close();
      const lines = path.getLines();
      const xPoint = lines.map(({ from }) => from[0]);
      const yPoint = lines.map(({ from }) => from[1]);

      // 輪郭も塗ってあげる
      lines.map((line) =>
        line.getPoints().forEach((point) => {
          this.display.setPixel(point[0], point[1]);
        })
      );

      const [minX, maxX] = [
        Math.max(Math.min(...xPoint), 0),
        Math.min(Math.max(...xPoint), this.w - 1),
      ];
      const [minY, maxY] = [
        Math.max(Math.min(...yPoint), 0),
        Math.min(Math.max(...yPoint), this.h - 1),
      ];
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          let count = 0;
          lines.map((line) => {
            if (line.from[1] <= y && line.to[1] > y) {
              const t = (y - line.from[1]) / (line.to[1] - line.from[1]);
              if (x < line.from[0] + t * (line.to[0] - line.from[0])) {
                count++;
              }
            } else if (line.from[1] > y && line.to[1] <= y) {
              const t = (y - line.from[1]) / (line.to[1] - line.from[1]);
              if (x < line.from[0] + t * (line.to[0] - line.from[0])) {
                count--;
              }
            }
          });
          if (count !== 0) {
            this.display.setPixel(x, y);
          }
        }
      }

      this.display.updatePixels();
    });
    this.paths = [];
  }

  clear() {
    this.display.clear();
  }

  printString(str, x, y) {
    this.display.setCharacter(str, x, y);
  }

  update() {
    this.display.updateDisplay();
  }
}
