import Point from './Point.mjs';
import Path from './Path.mjs';
import Display from './Display.mjs';

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

    this.strokeStyle = this.fillStyle = 'close';
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
      lines.forEach((line) =>
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
          lines.forEach((line) => {
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
