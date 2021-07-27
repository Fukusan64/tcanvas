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

export default class TCanvas {
  constructor(
    pixelLines = process.stdout.rows * 4,
    pixelColumns = process.stdout.columns * 2
  ) {
    this.cursor = ansi(process.stdout);
    this.textCells = [];
    const [ch, cw] = [pixelLines / 4, pixelColumns / 2].map((e) =>
      Math.floor(e)
    );
    this.h = pixelLines;
    this.w = pixelColumns;
    this.ch = ch;
    this.cw = cw;
    for (let y = 0; y < ch; y++) {
      this.textCells[y] = [];
      for (let x = 0; x < cw; x++) {
        this.textCells[y][x] = new TextCell();
      }
    }
    this.paths = [];
  }

  moveTo(x, y) {
    this.paths.push(new Path(x, y));
  }

  lineTo(x, y) {
    this.paths[this.paths.length - 1].addPoint(x, y);
  }

  fillRect(x, y, w, h) {
    const codeTable = [[], [], [], []];
    codeTable[0][0] = 2 ** 0;
    codeTable[1][0] = 2 ** 1;
    codeTable[2][0] = 2 ** 2;
    codeTable[0][1] = 2 ** 3;
    codeTable[1][1] = 2 ** 4;
    codeTable[2][1] = 2 ** 5;
    codeTable[3][0] = 2 ** 6;
    codeTable[3][1] = 2 ** 7;

    const bitMap = new Map();

    for (let xi = 0; xi < w; xi++) {
      for (let yi = 0; yi < h; yi++) {
        const [xp, yp] = [xi + x, yi + y];

        const cx = Math.floor(xp / 2);
        const cy = Math.floor(yp / 4);
        const px = xp < 0 ? (xp % 2) + 2 : xp % 2;
        const py = yp < 0 ? (yp % 4) + 4 : yp % 4;

        const code = bitMap.get(`${cx}, ${cy}`) ?? 0;
        bitMap.set(`${cx}, ${cy}`, code | codeTable[py][px]);
      }
    }

    bitMap.forEach((code, pos) => {
      const [cx, cy] = pos.split(',').map((e) => parseInt(e));
      const target = this.textCells[cy]?.[cx];
      if (target === undefined) return;
      target.setPixelsFromCode(code);
    });
  }

  strokeRect(x, y, w, h) {
    const codeTable = [[], [], [], []];
    codeTable[0][0] = 2 ** 0;
    codeTable[1][0] = 2 ** 1;
    codeTable[2][0] = 2 ** 2;
    codeTable[0][1] = 2 ** 3;
    codeTable[1][1] = 2 ** 4;
    codeTable[2][1] = 2 ** 5;
    codeTable[3][0] = 2 ** 6;
    codeTable[3][1] = 2 ** 7;

    const bitMap = new Map();

    for (let xi = 0; xi < w; xi++) {
      const xp = xi + x;
      [y, y + h - 1].map((yp) => {
        const cx = Math.floor(xp / 2);
        const cy = Math.floor(yp / 4);
        const px = xp < 0 ? (xp % 2) + 2 : xp % 2;
        const py = yp < 0 ? (yp % 4) + 4 : yp % 4;

        const code = bitMap.get(`${cx}, ${cy}`) ?? 0;
        bitMap.set(`${cx}, ${cy}`, code | codeTable[py][px]);
      });
    }

    for (let yi = 0; yi < h; yi++) {
      const yp = yi + x;
      [x, x + w - 1].map((xp) => {
        const cx = Math.floor(xp / 2);
        const cy = Math.floor(yp / 4);
        const px = xp < 0 ? (xp % 2) + 2 : xp % 2;
        const py = yp < 0 ? (yp % 4) + 4 : yp % 4;

        const code = bitMap.get(`${cx}, ${cy}`) ?? 0;
        bitMap.set(`${cx}, ${cy}`, code | codeTable[py][px]);
      });
    }

    bitMap.forEach((code, pos) => {
      const [cx, cy] = pos.split(',').map((e) => parseInt(e));
      const target = this.textCells[cy]?.[cx];
      if (target === undefined) return;
      target.setPixelsFromCode(code);
    });
  }

  arc(x, y, radius, startAngle, endAngle, anticlockwise = false) {
    if (radius === 0) {
      this.moveTo(x, y);
      return;
    }

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
    const codeTable = [[], [], [], []];
    codeTable[0][0] = 2 ** 0;
    codeTable[1][0] = 2 ** 1;
    codeTable[2][0] = 2 ** 2;
    codeTable[0][1] = 2 ** 3;
    codeTable[1][1] = 2 ** 4;
    codeTable[2][1] = 2 ** 5;
    codeTable[3][0] = 2 ** 6;
    codeTable[3][1] = 2 ** 7;

    const bitMap = new Map();
    this.paths.forEach((path) =>
      path.getLines().forEach((line) => {
        line.getPoints().forEach((point) => {
          const cx = Math.floor(point[0] / 2);
          const cy = Math.floor(point[1] / 4);
          const px = point[0] % 2 < 0 ? (point[0] % 2) + 2 : point[0] % 2;
          const py = point[1] % 4 < 0 ? (point[1] % 4) + 4 : point[1] % 4;
          const code = bitMap.get(`${cx}, ${cy}`) ?? 0;
          bitMap.set(`${cx}, ${cy}`, code | codeTable[py][px]);
        });
      })
    );
    bitMap.forEach((code, pos) => {
      const [cx, cy] = pos.split(',').map((e) => parseInt(e));
      const target = this.textCells[cy]?.[cx];
      if (target === undefined) return;
      target.setPixelsFromCode(code);
    });
    this.paths = [];
  }

  fill() {
    const codeTable = [[], [], [], []];
    codeTable[0][0] = 2 ** 0;
    codeTable[1][0] = 2 ** 1;
    codeTable[2][0] = 2 ** 2;
    codeTable[0][1] = 2 ** 3;
    codeTable[1][1] = 2 ** 4;
    codeTable[2][1] = 2 ** 5;
    codeTable[3][0] = 2 ** 6;
    codeTable[3][1] = 2 ** 7;

    const bitMap = new Map();

    this.paths.forEach((path) => {
      path.close();
      const lines = path.getLines();
      const xPoint = lines.map(({ from }) => from[0]);
      const yPoint = lines.map(({ from }) => from[1]);

      // //輪郭も塗ってあげる
      lines.map((line) =>
        line.getPoints().forEach((point) => {
          const cx = Math.floor(point[0] / 2);
          const cy = Math.floor(point[1] / 4);
          const px = point[0] < 0 ? (point[0] % 2) + 2 : point[0] % 2;
          const py = point[1] < 0 ? (point[1] % 4) + 4 : point[1] % 4;
          const code = bitMap.get(`${cx}, ${cy}`) ?? 0;
          bitMap.set(`${cx}, ${cy}`, code | codeTable[py][px]);
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
            const cx = Math.floor(x / 2);
            const cy = Math.floor(y / 4);
            const px = x < 0 ? (x % 2) + 2 : x % 2;
            const py = y < 0 ? (y % 4) + 4 : y % 4;
            const code = bitMap.get(`${cx}, ${cy}`) ?? 0;
            bitMap.set(`${cx}, ${cy}`, code | codeTable[py][px]);
          }
        }
      }

      bitMap.forEach((code, pos) => {
        const [cx, cy] = pos.split(',').map((e) => parseInt(e));
        const target = this.textCells[cy]?.[cx];
        if (target === undefined) return;
        target.setPixelsFromCode(code);
      });
    });
    this.paths = [];
  }

  clear() {
    this.textCells.forEach((line) => line.forEach((cell) => cell.clear()));
  }

  printString(str, x, y) {
    const line = this.textCells[Math.floor(y / 4)];
    for (let i = 0; i < str.length; i++) {
      const target = line?.[Math.floor(x / 2) + i];
      if (target === undefined) return;
      target.setCharacter(str[i]);
    }
  }

  update() {
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
