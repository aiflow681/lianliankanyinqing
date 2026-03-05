import { _decorator, Color, Component, Graphics, Node, UITransform, Vec3 } from 'cc';
import { LlkBoardModel } from '../game/LlkBoardModel';
import { GridPos } from '../game/LlkTypes';
import { LlkTile } from './LlkTile';
const { ccclass } = _decorator;

@ccclass('LlkBoardView')
export class LlkBoardView extends Component {
  public onTileTap?: (pos: GridPos) => void;

  private boardBg!: Graphics;
  private linkLayer!: Graphics;
  private tileLayer!: Node;
  private tiles = new Map<string, LlkTile>();
  private model: LlkBoardModel | null = null;
  private tileSize = 62;
  private gap = 8;
  private boardPadding = 16;

  protected onLoad(): void {
    const trans = this.getComponent(UITransform) ?? this.addComponent(UITransform);
    trans.setContentSize(600, 800);

    this.boardBg = this.getComponent(Graphics) ?? this.addComponent(Graphics);

    this.linkLayer = new Node('LinkLayer').addComponent(Graphics);
    this.linkLayer.node.addComponent(UITransform);
    this.linkLayer.node.setParent(this.node);
    this.linkLayer.lineWidth = 6;
    this.linkLayer.strokeColor = new Color(255, 250, 204, 255);

    this.tileLayer = new Node('TileLayer');
    this.tileLayer.addComponent(UITransform);
    this.tileLayer.setParent(this.node);
  }

  public build(model: LlkBoardModel, tileSize: number, gap: number, boardPadding: number): void {
    this.model = model;
    this.tileSize = tileSize;
    this.gap = gap;
    this.boardPadding = boardPadding;
    this.tiles.clear();
    this.tileLayer.removeAllChildren();
    this.clearLink();

    const width = model.cols * tileSize + (model.cols - 1) * gap + boardPadding * 2;
    const height = model.rows * tileSize + (model.rows - 1) * gap + boardPadding * 2;
    const trans = this.getComponent(UITransform)!;
    trans.setContentSize(width, height);

    this.drawBoardBg(width, height);

    for (let r = 1; r <= model.rows; r++) {
      for (let c = 1; c <= model.cols; c++) {
        const node = new Node(`Tile_${r}_${c}`);
        node.setParent(this.tileLayer);
        const tile = node.addComponent(LlkTile);
        tile.setup(r, c, model.getValue({ row: r, col: c }), tileSize);
        tile.onTap = (t) => this.onTileTap?.({ row: t.row, col: t.col });
        node.setPosition(this.gridToLocal({ row: r, col: c }));
        this.tiles.set(this.key(r, c), tile);
      }
    }
  }

  public refreshTiles(): void {
    if (!this.model) {
      return;
    }
    for (let r = 1; r <= this.model.rows; r++) {
      for (let c = 1; c <= this.model.cols; c++) {
        this.tiles.get(this.key(r, c))?.setValue(this.model.getValue({ row: r, col: c }));
      }
    }
  }

  public setSelected(pos: GridPos | null): void {
    this.tiles.forEach((tile) => tile.setSelected(false));
    if (pos) {
      this.tiles.get(this.key(pos.row, pos.col))?.setSelected(true);
    }
  }

  public setHint(from: GridPos | null, to: GridPos | null): void {
    this.tiles.forEach((tile) => tile.setHinted(false));
    if (from) {
      this.tiles.get(this.key(from.row, from.col))?.setHinted(true);
    }
    if (to) {
      this.tiles.get(this.key(to.row, to.col))?.setHinted(true);
    }
  }

  public clearLink(): void {
    if (this.linkLayer) {
      this.linkLayer.clear();
    }
  }

  public drawLink(path: GridPos[]): void {
    if (!this.model || path.length < 2) {
      return;
    }
    this.linkLayer.clear();
    const points = path.map((p) => this.gridToLocal(p));
    this.linkLayer.lineWidth = Math.max(7, Math.round(this.tileSize * 0.18));
    this.linkLayer.strokeColor = new Color(255, 94, 136, 90);
    this.tracePath(points);
    this.linkLayer.stroke();

    this.linkLayer.lineWidth = Math.max(4, Math.round(this.tileSize * 0.1));
    this.linkLayer.strokeColor = new Color(255, 255, 255, 250);
    this.tracePath(points);
    this.linkLayer.stroke();

    for (const p of points) {
      this.linkLayer.fillColor = new Color(255, 94, 136, 235);
      this.linkLayer.circle(p.x, p.y, Math.max(4, this.tileSize * 0.1));
      this.linkLayer.fill();
      this.linkLayer.fillColor = new Color(255, 255, 255, 255);
      this.linkLayer.circle(p.x, p.y, Math.max(1.8, this.tileSize * 0.035));
      this.linkLayer.fill();
    }
  }

  public resizeAndRelayout(tileSize: number, gap: number, boardPadding: number): void {
    if (!this.model) {
      return;
    }
    this.tileSize = tileSize;
    this.gap = gap;
    this.boardPadding = boardPadding;
    const width = this.model.cols * tileSize + (this.model.cols - 1) * gap + boardPadding * 2;
    const height = this.model.rows * tileSize + (this.model.rows - 1) * gap + boardPadding * 2;
    this.getComponent(UITransform)!.setContentSize(width, height);
    this.drawBoardBg(width, height);

    for (let r = 1; r <= this.model.rows; r++) {
      for (let c = 1; c <= this.model.cols; c++) {
        const tile = this.tiles.get(this.key(r, c));
        if (!tile) {
          continue;
        }
        tile.setup(r, c, tile.value, tileSize);
        tile.node.setPosition(this.gridToLocal({ row: r, col: c }));
      }
    }
    this.clearLink();
  }

  private drawBoardBg(width: number, height: number): void {
    this.boardBg.clear();
    this.boardBg.fillColor = new Color(255, 248, 234, 250);
    this.boardBg.strokeColor = new Color(58, 43, 36, 45);
    this.boardBg.lineWidth = 3;
    this.boardBg.roundRect(-width / 2, -height / 2, width, height, 26);
    this.boardBg.fill();
    this.boardBg.stroke();

    this.boardBg.fillColor = new Color(255, 138, 92, 36);
    this.boardBg.roundRect(-width / 2 + 10, height / 2 - 34, width - 20, 18, 9);
    this.boardBg.fill();

    this.boardBg.fillColor = new Color(255, 255, 255, 150);
    this.boardBg.roundRect(-width / 2 + 8, -height / 2 + 8, width - 16, height - 16, 20);
    this.boardBg.fill();

    this.boardBg.strokeColor = new Color(74, 52, 44, 24);
    this.boardBg.lineWidth = 1.5;
    this.boardBg.roundRect(-width / 2 + 8, -height / 2 + 8, width - 16, height - 16, 20);
    this.boardBg.stroke();

    const step = this.tileSize + this.gap;
    const playableWidth = this.model ? this.model.cols * this.tileSize + (this.model.cols - 1) * this.gap : 0;
    const playableHeight = this.model ? this.model.rows * this.tileSize + (this.model.rows - 1) * this.gap : 0;
    const left = -playableWidth / 2;
    const top = playableHeight / 2;

    this.boardBg.strokeColor = new Color(210, 144, 120, 35);
    this.boardBg.lineWidth = 1;
    for (let c = 0; c <= (this.model?.cols ?? 0); c++) {
      const x = left + c * step - this.gap / 2;
      this.boardBg.moveTo(x, top + this.gap / 2);
      this.boardBg.lineTo(x, -top - this.gap / 2);
    }
    for (let r = 0; r <= (this.model?.rows ?? 0); r++) {
      const y = top - r * step + this.gap / 2;
      this.boardBg.moveTo(left - this.gap / 2, y);
      this.boardBg.lineTo(-left + this.gap / 2, y);
    }
    this.boardBg.stroke();

    const dotColor = new Color(255, 163, 120, 34);
    this.boardBg.fillColor = dotColor;
    for (let r = 1; r <= (this.model?.rows ?? 0); r++) {
      for (let c = 1; c <= (this.model?.cols ?? 0); c++) {
        const p = this.gridToLocal({ row: r, col: c });
        this.boardBg.circle(p.x, p.y, Math.max(1.2, this.tileSize * 0.03));
        this.boardBg.fill();
      }
    }
  }

  private tracePath(points: Vec3[]): void {
    if (!points.length) {
      return;
    }
    this.linkLayer.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      this.linkLayer.lineTo(points[i].x, points[i].y);
    }
  }

  private gridToLocal(pos: GridPos): Vec3 {
    if (!this.model) {
      return new Vec3();
    }
    const step = this.tileSize + this.gap;
    const playableWidth = this.model.cols * this.tileSize + (this.model.cols - 1) * this.gap;
    const playableHeight = this.model.rows * this.tileSize + (this.model.rows - 1) * this.gap;
    const x = -playableWidth / 2 + this.tileSize / 2 + (pos.col - 1) * step;
    const y = playableHeight / 2 - this.tileSize / 2 - (pos.row - 1) * step;
    return new Vec3(x, y, 0);
  }

  private key(r: number, c: number): string {
    return `${r}_${c}`;
  }
}
