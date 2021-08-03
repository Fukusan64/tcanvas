import Color from './Color.mjs';

export default class TextCell {
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
