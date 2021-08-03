import style from 'ansi-styles';

export default class Color {
  static palette = new Map(
    Object.entries(style.color)
      .filter((e) => typeof e[1] !== 'function')
      .map((e) => [e[0], e[1].open ?? e[1]])
  );

  constructor(color = 'close') {
    this.code = '';
    this.setColor(color);
  }

  setColor(color) {
    if (Color.palette.has(color)) {
      this.code = Color.palette.get(color);
    } else if (color[0] === '#') {
      this.code = styles.color.ansi16m(...styles.hexToRgb(color));
    } else if (color.indexOf('rgb(') === 0) {
      const { r, g, b } = color.match(
        /rgb\(?<r>([0-9]+),(?<g>[0-9]+),(?<b>[0-9]+)\)/
      ).groups;
      this.code = styles.color.ansi16m(r, g, b);
    } else {
      this.code = Color.palette.get('close');
    }
  }

  equals(other) {
    return this.code === other.code;
  }
}
