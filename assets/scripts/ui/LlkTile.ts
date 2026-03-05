import { _decorator, Color, Component, Graphics, Node, Tween, UITransform, Vec3, tween } from 'cc';
const { ccclass } = _decorator;

const TILE_PALETTES = [
  ['#FF8E72', '#FFF6EC', '#8A3C2B'],
  ['#54C6B7', '#EEFFFC', '#175E56'],
  ['#F4BD4A', '#FFF8E7', '#7A5310'],
  ['#6D8DF2', '#F1F4FF', '#2D4493'],
  ['#78D47B', '#F1FFF1', '#2C6B31'],
  ['#F59D65', '#FFF3EA', '#87461F'],
  ['#EE7C96', '#FFF0F4', '#8D2B44'],
  ['#AED96A', '#F8FFE9', '#53731D'],
  ['#7CB7E8', '#F1F8FF', '#2F5F87'],
  ['#E879C6', '#FFF2FB', '#7C2E66'],
  ['#7586F7', '#F1F3FF', '#2D358D'],
  ['#4CB0D9', '#EDF9FF', '#1B5D77'],
  ['#BBB4D7', '#F7F5FF', '#5B537A'],
  ['#FF7686', '#FFF0F2', '#8E3140'],
  ['#3FBFD3', '#ECFDFF', '#145E69'],
  ['#A36AF2', '#F5EFFF', '#56318A'],
  ['#F5AE45', '#FFF5E8', '#835310'],
  ['#39C59E', '#ECFFF8', '#14604C'],
];

@ccclass('LlkTile')
export class LlkTile extends Component {
  public row = 0;
  public col = 0;
  public value = 0;
  public onTap?: (tile: LlkTile) => void;

  private bg!: Graphics;
  private icon!: Graphics;
  private selected = false;
  private hinted = false;
  private tileSize = 64;

  protected onLoad(): void {
    const trans = this.getComponent(UITransform) ?? this.addComponent(UITransform);
    trans.setContentSize(64, 64);

    this.bg = this.getComponent(Graphics) ?? this.addComponent(Graphics);

    const iconNode = new Node('Icon');
    iconNode.setParent(this.node);
    iconNode.setPosition(Vec3.ZERO);
    iconNode.addComponent(UITransform).setContentSize(64, 64);
    this.icon = iconNode.addComponent(Graphics);

    this.node.on(Node.EventType.TOUCH_END, this.handleTap, this);
    this.redraw();
  }

  public setup(row: number, col: number, value: number, size: number): void {
    this.row = row;
    this.col = col;
    this.value = value;
    this.tileSize = size;
    this.selected = false;
    this.hinted = false;
    this.node.setScale(Vec3.ONE);

    const trans = this.getComponent(UITransform)!;
    trans.setContentSize(size, size);
    const iconTrans = this.icon.node.getComponent(UITransform)!;
    iconTrans.setContentSize(size, size);

    this.redraw();
  }

  public setValue(value: number): void {
    this.value = value;
    this.selected = false;
    this.hinted = false;
    this.node.setScale(Vec3.ONE);
    this.redraw();
  }

  public setSelected(selected: boolean): void {
    this.selected = selected;
    Tween.stopAllByTarget(this.node);
    tween(this.node).to(0.08, { scale: selected ? new Vec3(1.06, 1.06, 1) : Vec3.ONE }).start();
    this.redraw();
  }

  public setHinted(hinted: boolean): void {
    this.hinted = hinted;
    this.redraw();
  }

  private handleTap(): void {
    if (!this.node.active || !this.value) {
      return;
    }
    Tween.stopAllByTarget(this.icon.node);
    this.icon.node.setScale(Vec3.ONE);
    tween(this.icon.node)
      .to(0.05, { scale: new Vec3(0.92, 0.92, 1) })
      .to(0.08, { scale: Vec3.ONE })
      .start();
    this.onTap?.(this);
  }

  private redraw(): void {
    if (!this.bg || !this.icon) {
      return;
    }

    this.node.active = this.value !== 0;
    this.bg.clear();
    this.icon.clear();
    if (!this.value) {
      return;
    }

    const size = this.tileSize;
    const half = size / 2;
    const radius = Math.max(8, Math.floor(size * 0.2));
    const [bgHex, iconHex, lineHex] = TILE_PALETTES[(this.value - 1) % TILE_PALETTES.length];
    const bgColor = Color.fromHEX(new Color(), bgHex);
    const iconColor = Color.fromHEX(new Color(), iconHex);
    const lineColor = Color.fromHEX(new Color(), lineHex);

    const basePaper = new Color(255, 250, 240, 255);
    const shadowColor = new Color(143, 81, 62, 26);
    const borderColor = this.selected
      ? new Color(255, 94, 136, 255)
      : this.hinted
        ? new Color(255, 171, 64, 255)
        : new Color(92, 66, 56, 48);

    this.bg.fillColor = shadowColor;
    this.bg.roundRect(-half, -half + 3, size, size, radius);
    this.bg.fill();

    this.bg.fillColor = basePaper;
    this.bg.strokeColor = borderColor;
    this.bg.lineWidth = this.selected ? 3 : 2;
    this.bg.roundRect(-half, -half, size, size, radius);
    this.bg.fill();
    this.bg.stroke();

    this.bg.fillColor = bgColor;
    this.bg.roundRect(-half + 4, half - Math.max(12, size * 0.24), size - 8, Math.max(10, size * 0.2), Math.max(5, radius - 6));
    this.bg.fill();

    this.bg.fillColor = new Color(bgColor.r, bgColor.g, bgColor.b, 22);
    this.bg.roundRect(-half + 5, -half + 5, size - 10, size - 10, Math.max(5, radius - 5));
    this.bg.fill();

    this.bg.strokeColor = new Color(255, 255, 255, 85);
    this.bg.lineWidth = 1;
    this.bg.roundRect(-half + 4, -half + 4, size - 8, size - 8, Math.max(5, radius - 4));
    this.bg.stroke();

    this.icon.fillColor = iconColor;
    this.icon.strokeColor = lineColor;
    this.drawPattern(this.icon, (this.value - 1) % 18, size, iconColor, lineColor);

    if (this.selected || this.hinted) {
      this.bg.strokeColor = this.selected ? new Color(255, 94, 136, 255) : new Color(255, 171, 64, 235);
      this.bg.lineWidth = 2;
      this.bg.roundRect(-half - 2, -half - 2, size + 4, size + 4, radius + 2);
      this.bg.stroke();
    }
  }

  private drawPattern(g: Graphics, patternIndex: number, size: number, fill: Color, stroke: Color): void {
    const s = size;
    const k = s / 64;
    const r = s * 0.22;
    g.clear();
    g.fillColor = fill;
    g.strokeColor = stroke;
    g.lineWidth = Math.max(1.2, 1.6 * k);

    switch (patternIndex) {
      case 0:
        this.drawStar(g, 0, 0, r, r * 0.48, 5);
        break;
      case 1:
        this.drawFlower(g, 0, 0, r * 0.36);
        break;
      case 2:
        this.drawDiamond(g, 0, 0, r * 0.95, r * 1.05);
        break;
      case 3:
        this.drawLeaf(g, 0, 0, r * 1.05, r * 0.72);
        break;
      case 4:
        this.drawMoon(g, 0, 0, r);
        break;
      case 5:
        this.drawDrop(g, 0, 0, r * 0.85);
        break;
      case 6:
        this.drawClover(g, 0, 0, r * 0.42);
        break;
      case 7:
        this.drawSun(g, 0, 0, r * 0.6, r * 1.05);
        break;
      case 8:
        this.drawKite(g, 0, 0, r * 0.95);
        break;
      case 9:
        this.drawCandy(g, 0, 0, r * 0.85);
        break;
      case 10:
        this.drawBolt(g, 0, 0, r * 0.95);
        break;
      case 11:
        this.drawHexGem(g, 0, 0, r * 0.95);
        break;
      case 12:
        this.drawCrown(g, 0, 0, r * 1.0);
        break;
      case 13:
        this.drawCrossPetal(g, 0, 0, r * 0.42);
        break;
      case 14:
        this.drawRingPlanet(g, 0, 0, r * 0.62);
        break;
      case 15:
        this.drawShell(g, 0, 0, r * 0.9);
        break;
      case 16:
        this.drawPinwheel(g, 0, 0, r * 0.88);
        break;
      case 17:
      default:
        this.drawSpark(g, 0, 0, r * 0.9);
        break;
    }
  }

  private drawStar(g: Graphics, x: number, y: number, outer: number, inner: number, points: number): void {
    const verts: Vec3[] = [];
    const step = Math.PI / points;
    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const ang = -Math.PI / 2 + i * step;
      verts.push(new Vec3(x + Math.cos(ang) * rad, y + Math.sin(ang) * rad, 0));
    }
    this.fillPolygon(g, verts);
  }

  private drawFlower(g: Graphics, x: number, y: number, petalR: number): void {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      g.circle(x + Math.cos(a) * petalR * 1.5, y + Math.sin(a) * petalR * 1.5, petalR);
      g.fill();
      g.stroke();
    }
    g.circle(x, y, petalR * 0.9);
    g.fill();
    g.stroke();
  }

  private drawDiamond(g: Graphics, x: number, y: number, w: number, h: number): void {
    this.fillPolygon(g, [
      new Vec3(x, y + h, 0),
      new Vec3(x + w, y, 0),
      new Vec3(x, y - h, 0),
      new Vec3(x - w, y, 0),
    ]);
    g.moveTo(x - w * 0.55, y);
    g.lineTo(x + w * 0.55, y);
    g.moveTo(x, y + h * 0.55);
    g.lineTo(x, y - h * 0.55);
    g.stroke();
  }

  private drawLeaf(g: Graphics, x: number, y: number, w: number, h: number): void {
    g.moveTo(x, y + h);
    g.bezierCurveTo(x + w, y + h * 0.55, x + w, y - h * 0.55, x, y - h);
    g.bezierCurveTo(x - w, y - h * 0.55, x - w, y + h * 0.55, x, y + h);
    g.close();
    g.fill();
    g.stroke();
    g.moveTo(x, y + h * 0.8);
    g.lineTo(x, y - h * 0.75);
    g.stroke();
  }

  private drawMoon(g: Graphics, x: number, y: number, r: number): void {
    g.circle(x, y, r);
    g.fill();
    g.stroke();
    g.fillColor = new Color(255, 255, 255, 220);
    g.circle(x + r * 0.45, y - r * 0.1, r * 0.85);
    g.fill();
  }

  private drawDrop(g: Graphics, x: number, y: number, r: number): void {
    g.moveTo(x, y + r * 1.35);
    g.bezierCurveTo(x + r * 1.05, y + r * 0.95, x + r * 1.05, y - r * 0.1, x, y - r * 1.15);
    g.bezierCurveTo(x - r * 1.05, y - r * 0.1, x - r * 1.05, y + r * 0.95, x, y + r * 1.35);
    g.close();
    g.fill();
    g.stroke();
  }

  private drawClover(g: Graphics, x: number, y: number, r: number): void {
    g.circle(x - r, y + r * 0.25, r);
    g.fill();
    g.stroke();
    g.circle(x + r, y + r * 0.25, r);
    g.fill();
    g.stroke();
    g.circle(x, y + r * 1.2, r);
    g.fill();
    g.stroke();
    g.moveTo(x, y + r * 0.4);
    g.lineTo(x + r * 0.8, y - r * 1.4);
    g.lineTo(x + r * 0.2, y - r * 1.55);
    g.lineTo(x - r * 0.5, y - r * 0.2);
    g.close();
    g.fill();
    g.stroke();
  }

  private drawSun(g: Graphics, x: number, y: number, inner: number, outer: number): void {
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI * 2 * i) / 8;
      const x1 = x + Math.cos(a) * (inner + 2);
      const y1 = y + Math.sin(a) * (inner + 2);
      const x2 = x + Math.cos(a) * outer;
      const y2 = y + Math.sin(a) * outer;
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    }
    g.circle(x, y, inner);
    g.fill();
    g.stroke();
  }

  private drawKite(g: Graphics, x: number, y: number, r: number): void {
    this.fillPolygon(g, [
      new Vec3(x, y + r, 0),
      new Vec3(x + r * 0.75, y, 0),
      new Vec3(x, y - r * 1.05, 0),
      new Vec3(x - r * 0.75, y, 0),
    ]);
    g.moveTo(x, y - r * 0.95);
    g.lineTo(x + r * 0.75, y - r * 1.45);
    g.lineTo(x + r * 0.5, y - r * 1.65);
    g.stroke();
  }

  private drawCandy(g: Graphics, x: number, y: number, r: number): void {
    g.moveTo(x - r * 1.45, y);
    g.lineTo(x - r * 0.95, y + r * 0.52);
    g.lineTo(x - r * 0.95, y - r * 0.52);
    g.close();
    g.fill();
    g.stroke();

    g.roundRect(x - r * 0.9, y - r * 0.65, r * 1.8, r * 1.3, r * 0.45);
    g.fill();
    g.stroke();

    g.moveTo(x + r * 1.45, y);
    g.lineTo(x + r * 0.95, y + r * 0.52);
    g.lineTo(x + r * 0.95, y - r * 0.52);
    g.close();
    g.fill();
    g.stroke();
  }

  private drawBolt(g: Graphics, x: number, y: number, r: number): void {
    this.fillPolygon(g, [
      new Vec3(x - r * 0.2, y + r, 0),
      new Vec3(x + r * 0.35, y + r * 0.1, 0),
      new Vec3(x + r * 0.05, y + r * 0.1, 0),
      new Vec3(x + r * 0.25, y - r, 0),
      new Vec3(x - r * 0.45, y - r * 0.05, 0),
      new Vec3(x - r * 0.12, y - r * 0.05, 0),
    ]);
  }

  private drawHexGem(g: Graphics, x: number, y: number, r: number): void {
    const verts: Vec3[] = [];
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / 6;
      verts.push(new Vec3(x + Math.cos(a) * r, y + Math.sin(a) * r, 0));
    }
    this.fillPolygon(g, verts);
    g.moveTo(verts[0].x, verts[0].y);
    g.lineTo(x, y);
    g.lineTo(verts[3].x, verts[3].y);
    g.moveTo(verts[1].x, verts[1].y);
    g.lineTo(x, y);
    g.lineTo(verts[4].x, verts[4].y);
    g.stroke();
  }

  private drawCrown(g: Graphics, x: number, y: number, r: number): void {
    this.fillPolygon(g, [
      new Vec3(x - r * 1.1, y - r * 0.55, 0),
      new Vec3(x - r * 0.75, y + r * 0.7, 0),
      new Vec3(x - r * 0.15, y - r * 0.05, 0),
      new Vec3(x, y + r * 0.95, 0),
      new Vec3(x + r * 0.15, y - r * 0.05, 0),
      new Vec3(x + r * 0.75, y + r * 0.7, 0),
      new Vec3(x + r * 1.1, y - r * 0.55, 0),
      new Vec3(x + r * 1.1, y - r * 0.95, 0),
      new Vec3(x - r * 1.1, y - r * 0.95, 0),
    ]);
  }

  private drawCrossPetal(g: Graphics, x: number, y: number, r: number): void {
    g.circle(x - r * 1.1, y, r);
    g.fill();
    g.stroke();
    g.circle(x + r * 1.1, y, r);
    g.fill();
    g.stroke();
    g.circle(x, y + r * 1.1, r);
    g.fill();
    g.stroke();
    g.circle(x, y - r * 1.1, r);
    g.fill();
    g.stroke();
    g.circle(x, y, r * 0.9);
    g.fill();
    g.stroke();
  }

  private drawRingPlanet(g: Graphics, x: number, y: number, r: number): void {
    g.circle(x, y, r);
    g.fill();
    g.stroke();

    g.moveTo(x - r * 1.6, y - r * 0.15);
    g.bezierCurveTo(x - r * 0.7, y - r * 0.9, x + r * 0.7, y + r * 0.9, x + r * 1.6, y + r * 0.15);
    g.moveTo(x - r * 1.6, y - r * 0.45);
    g.bezierCurveTo(x - r * 0.7, y - r * 1.2, x + r * 0.7, y + r * 0.6, x + r * 1.6, y - r * 0.15);
    g.stroke();
  }

  private drawShell(g: Graphics, x: number, y: number, r: number): void {
    g.moveTo(x - r, y - r * 0.6);
    g.bezierCurveTo(x - r * 0.9, y + r * 0.8, x + r * 0.9, y + r * 0.8, x + r, y - r * 0.6);
    g.lineTo(x - r, y - r * 0.6);
    g.close();
    g.fill();
    g.stroke();
    for (let i = -2; i <= 2; i++) {
      g.moveTo(x + i * r * 0.33, y - r * 0.55);
      g.lineTo(x, y + r * 0.6);
      g.stroke();
    }
  }

  private drawPinwheel(g: Graphics, x: number, y: number, r: number): void {
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI / 2) * i;
      const p1 = new Vec3(x, y, 0);
      const p2 = new Vec3(x + Math.cos(a) * r, y + Math.sin(a) * r, 0);
      const p3 = new Vec3(x + Math.cos(a + Math.PI / 4) * r * 0.85, y + Math.sin(a + Math.PI / 4) * r * 0.85, 0);
      this.fillPolygon(g, [p1, p2, p3]);
    }
    g.circle(x, y, r * 0.26);
    g.fill();
    g.stroke();
  }

  private drawSpark(g: Graphics, x: number, y: number, r: number): void {
    this.fillPolygon(g, [
      new Vec3(x, y + r, 0),
      new Vec3(x + r * 0.28, y + r * 0.28, 0),
      new Vec3(x + r, y, 0),
      new Vec3(x + r * 0.28, y - r * 0.28, 0),
      new Vec3(x, y - r, 0),
      new Vec3(x - r * 0.28, y - r * 0.28, 0),
      new Vec3(x - r, y, 0),
      new Vec3(x - r * 0.28, y + r * 0.28, 0),
    ]);
    g.circle(x + r * 0.85, y + r * 0.75, r * 0.22);
    g.fill();
    g.stroke();
  }

  private fillPolygon(g: Graphics, points: Vec3[]): void {
    if (points.length < 3) {
      return;
    }
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.close();
    g.fill();
    g.stroke();
  }
}
