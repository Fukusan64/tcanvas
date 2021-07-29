import ansi from 'ansi';
import style from 'ansi-styles';


class Color {
  constructor(color = 'close') {
    this.palette = new Map(
      Object.entries(style.color)
        .filter(e => typeof e[1] !== 'function')
        .map(e => ([e[0], e[1].open ?? e[1]]))
    );

    this.code = '';
    this.setColor(color);
  }

  setColor(color) {
    if (this.palette.has(color)) {
      this.code = this.palette.get(color);
    } else if (color[0] === '#') {
      this.code = styles.color.ansi16m(...styles.hexToRgb(color));
    } else if(color.indexOf('rgb(') === 0) {
      const {r, g, b} = color.match(/rgb\(?<r>([0-9]+),(?<g>[0-9]+),(?<b>[0-9]+)\)/).groups;
      this.code = styles.color.ansi16m(r, g, b);
    } else {
      this.code = this.palette.get('close');
    }
  }

  equals(other) {
    return this.code === other.code;
  }
}
class TextCell {
  constructor() {
    this.character = '\u2800';
    this.beforeCharacter = undefined;


    this.clearColor = this.color = new Color();
    this.beforeColor = undefined;
  }

  setCharacter(char) {
    this.character = char;
  }

  setColor(color) {
    this.color = color;
  }

  setPixelsFromCode(code) {
    const baseCode = 0x2800;
    this.setCharacter(String.fromCodePoint(baseCode + code));
  }

  update() {
    this.beforeCharacter = this.character;
    this.beforeColor = this.color;
  }

  clear() {
    this.setCharacter('\u2800');
    this.setColor(this.clearColor);
  }

  get isChanged() {
    return this.beforeCharacter !== this.character || !this.beforeColor.equals(this.color);
  }

  get output() {
    return `${this.color.code}${this.character}`;
  }
}

class Point {
  constructor(x, y) {
    Object.assign(this, { x, y });
  }

  conversion(func) {
    return new Point(...func([...this]));
  }

  equals(other) {
    return this.x === other.x && this.y === other.y;
  }

  * [Symbol.iterator]() {
    yield this.x;
    yield this.y;
  }
}

class Line {
  constructor(from = new Point(0, 0), to = new Point(0, 0)) {
    Object.assign(this, { from, to });
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
        (new Point(x + dx * dt, y + dy * dt)).conversion(
          p => p.map((p) => Math.round(p))
        )
      );
    }
    return result;
  }
}

class Path {
  constructor(point) {
    this.points = [point.conversion(p => p.map((p) => Math.round(p)))];
  }

  addPoint(point) {
    this.points.push(point.conversion(p => p.map((p) => Math.round(p))));
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

    this.w = w;
    this.h = h;
  }

  setPixel(point) {
    const cx = Math.floor(point.x / 2);
    const cy = Math.floor(point.y / 4);
    const px = point.x < 0 ? (point.x % 2) + 2 : point.x % 2;
    const py = point.y < 0 ? (point.y % 4) + 4 : point.y % 4;
    const code = this.bitMap.get(`${cx}, ${cy}`) ?? 0;
    this.bitMap.set(`${cx}, ${cy}`, code | this.codeTable[py][px]);
  }

  updatePixels(color) {

    const colorObj = new Color(color);
    this.bitMap.forEach((code, pos) => {
      const [cx, cy] = pos.split(',').map((e) => parseInt(e));
      const target = this.textCells[cy]?.[cx];
      if (target === undefined) return;
      target.setPixelsFromCode(code);
      target.setColor(colorObj);
    });
    this.bitMap = new Map();
  }

  setCharacter (str, point, color) {
    const line = this.textCells[Math.floor(point.y / 4)];
    for (let i = 0; i < str.length; i++) {
      const target = line?.[Math.floor(point.x / 2) + i];
      if (target === undefined) return;
      target.setCharacter(str[i]);
      target.setColor(new Color(color));
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
            .map(({ output }) => output)
            .join('')
        );
      }
    });
    this.cursor.goto(this.w, this.h).write(new Color('reset').code);
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

    this.strokeStyle = this.fillStyle = 'reset';
  }

  moveTo(x, y) {
    this.paths.push(new Path(new Point(x, y)));
  }

  lineTo(x, y) {
    this.paths[this.paths.length - 1].addPoint(new Point(x, y));
  }

  fillRect(x, y, w, h) {
    for (let xi = 0; xi < w; xi++) {
      for (let yi = 0; yi < h; yi++) {
        this.display.setPixel(new Point(x + xi, y + yi));
      }
    }
    this.display.updatePixels(this.fillStyle);
  }

  strokeRect(x, y, w, h) {
    for (let xi = 0; xi < w; xi++) {
      const xp = xi + x;
      this.display.setPixel(new Point(xp, y));
      this.display.setPixel(new Point(xp, y + h - 1));
    }

    for (let yi = 0; yi < h; yi++) {
      const yp = yi + x;
      this.display.setPixel(new Point(x, yp));
      this.display.setPixel(new Point(x + w - 1, yp));
    }

    this.display.updatePixels(this.strokeStyle);
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

  closePath() {
    this.paths[this.paths.length - 1].close();
  }

  stroke() {
    this.paths.forEach((path) =>
      path.getLines().forEach((line) => {
        line.getPoints().forEach((point) => {
          this.display.setPixel(point);
        });
      })
    );
    this.display.updatePixels(this.strokeStyle);
    this.paths = [];
  }

  fill() {
    this.paths.forEach((path) => {
      path.close();
      const lines = path.getLines();
      const xPoint = lines.map(({ from }) => from.x);
      const yPoint = lines.map(({ from }) => from.y);

      // 輪郭も塗ってあげる
      lines.map((line) =>
        line.getPoints().forEach((point) => {
          this.display.setPixel(point);
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
            if (line.from.y <= y && line.to.y > y) {
              const t = (y - line.from.y) / (line.to.y - line.from.y);
              if (x < line.from.x + t * (line.to.x - line.from.x)) {
                count++;
              }
            } else if (line.from.y > y && line.to.y <= y) {
              const t = (y - line.from.y) / (line.to.y - line.from.y);
              if (x < line.from.x + t * (line.to.x - line.from.x)) {
                count--;
              }
            }
          });
          if (count !== 0) {
            this.display.setPixel(new Point(x, y));
          }
        }
      }

      this.display.updatePixels(this.fillStyle);
    });
    this.paths = [];
  }

  clear() {
    this.display.clear();
  }

  printString(str, x, y) {
    this.display.setCharacter(str, new Point(x, y), this.fillStyle);
  }

  update() {
    this.display.updateDisplay();
  }
}
