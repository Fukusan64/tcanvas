import ansi from 'ansi';
import TextCell from './TextCell.mjs';
import Color from './Color.mjs';

export default class Display {
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

  setCharacter(str, point, color) {
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
    this.cursor.goto(this.w, this.h).write(Color.palette.get('close'));
  }
}
