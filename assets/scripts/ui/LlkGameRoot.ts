import {
  _decorator,
  Color,
  Component,
  Game,
  Graphics,
  Label,
  Node,
  Tween,
  UIOpacity,
  UITransform,
  Vec3,
  game,
  tween,
  view,
} from 'cc';
import { LlkBoardModel } from '../game/LlkBoardModel';
import { LlkConfig } from '../game/LlkConfig';
import { GameStats, GridPos } from '../game/LlkTypes';
import { LlkBoardView } from './LlkBoardView';
const { ccclass } = _decorator;

type UIButton = {
  node: Node;
  bg: Graphics;
  label: Label;
  baseColor: Color;
};

@ccclass('LlkGameRoot')
export class LlkGameRoot extends Component {
  private model!: LlkBoardModel;
  private boardView!: LlkBoardView;

  private selected: GridPos | null = null;
  private paused = false;
  private finished = false;

  private score = 0;
  private timeLeftSec = LlkConfig.timeLimitSec;
  private hintsLeft = LlkConfig.hintLimit;
  private shufflesLeft = LlkConfig.shuffleLimit;

  private headerNode!: Node;
  private footerNode!: Node;
  private boardNode!: Node;
  private toastNode!: Node;
  private toastLabel!: Label;
  private toastOpacity!: UIOpacity;
  private popupNode!: Node;
  private popupLabel!: Label;

  private scoreLabel!: Label;
  private timeLabel!: Label;
  private progressLabel!: Label;
  private actionLabel!: Label;
  private titleLabel!: Label;

  private headerPanel!: Graphics;
  private footerPanel!: Graphics;
  private buttons: UIButton[] = [];
  private backgroundNode!: Node;
  private backgroundGraphics!: Graphics;
  private lastVisibleW = 0;
  private lastVisibleH = 0;

  protected onLoad(): void {
    this.setupRuntimeUI();
    this.bindLifecycle();
    this.startNewGame();
  }

  protected onDestroy(): void {
    game.off(Game.EVENT_HIDE, this.onAppHide, this);
    game.off(Game.EVENT_SHOW, this.onAppShow, this);
  }

  protected update(dt: number): void {
    this.checkResize();

    if (this.paused || this.finished) {
      return;
    }

    this.timeLeftSec = Math.max(0, this.timeLeftSec - dt);
    this.refreshHud();

    if (this.timeLeftSec <= 0) {
      this.endGame(false, '时间到');
    }
  }

  private bindLifecycle(): void {
    game.on(Game.EVENT_HIDE, this.onAppHide, this);
    game.on(Game.EVENT_SHOW, this.onAppShow, this);
  }

  private onAppHide(): void {
    if (this.finished) {
      return;
    }
    this.paused = true;
    this.showPopup('已暂停\n切到后台已自动暂停');
    this.flashAction('已自动暂停');
  }

  private onAppShow(): void {
    if (this.finished) {
      return;
    }
    this.paused = false;
    this.hidePopup();
    this.flashAction('继续游戏');
  }

  private startNewGame(): void {
    this.model = new LlkBoardModel(LlkConfig.rows, LlkConfig.cols);
    this.model.resetWithRandomPairs(LlkConfig.kindCount);

    this.selected = null;
    this.paused = false;
    this.finished = false;
    this.score = 0;
    this.timeLeftSec = LlkConfig.timeLimitSec;
    this.hintsLeft = LlkConfig.hintLimit;
    this.shufflesLeft = LlkConfig.shuffleLimit;

    const visible = view.getVisibleSize();
    const isLandscape = visible.width / visible.height > 1.08;
    const metrics = this.computeBoardMetrics(visible.width - 26, visible.height - 250, isLandscape);
    this.boardView.build(this.model, metrics.tileSize, metrics.gap, metrics.padding);
    this.layoutRuntimeUI();
    this.refreshHud();
    this.boardView.setSelected(null);
    this.boardView.setHint(null, null);
    this.hidePopup();
    this.flashAction('消除全部图案');
  }

  private handleTileTap = (pos: GridPos): void => {
    if (this.paused || this.finished) {
      return;
    }

    const value = this.model.getValue(pos);
    if (!value) {
      return;
    }

    this.boardView.setHint(null, null);

    if (!this.selected) {
      this.selected = pos;
      this.boardView.setSelected(pos);
      this.flashAction(`已选中图案 ${value}`);
      return;
    }

    if (this.samePos(this.selected, pos)) {
      this.selected = null;
      this.boardView.setSelected(null);
      this.flashAction('已取消选择');
      return;
    }

    if (this.model.getValue(this.selected) !== value) {
      this.selected = pos;
      this.boardView.setSelected(pos);
      this.flashAction('图案不同');
      return;
    }

    const a = this.selected;
    const result = this.model.canLink(a, pos);
    if (!result.ok) {
      this.selected = pos;
      this.boardView.setSelected(pos);
      this.flashAction('路径被阻挡');
      return;
    }

    this.selected = null;
    this.boardView.setSelected(null);
    this.boardView.drawLink(result.path);
    this.scheduleOnce(() => this.boardView.clearLink(), 0.22);

    this.model.removePair(a, pos);
    this.score += LlkConfig.pairScore;
    this.boardView.refreshTiles();

    if (this.model.isCleared()) {
      this.refreshHud();
      this.endGame(true, '通关成功');
      return;
    }

    const hint = this.model.findHint();
    if (!hint) {
      const ok = this.model.shuffleRemaining(LlkConfig.autoReshuffleMaxTries);
      this.boardView.refreshTiles();
      this.flashAction(ok ? '无可消除，已自动洗牌' : '洗牌失败');
      if (!ok) {
        this.endGame(false, '棋盘异常');
        return;
      }
    } else {
      this.flashAction(`+${LlkConfig.pairScore}`);
    }

    this.refreshHud();
  };

  private onHintPressed = (): void => {
    if (this.paused || this.finished) {
      return;
    }
    if (this.hintsLeft <= 0) {
      this.flashAction('提示次数已用完');
      return;
    }

    const hint = this.model.findHint();
    if (!hint) {
      this.flashAction('当前无可消除');
      return;
    }

    this.hintsLeft -= 1;
    this.selected = null;
    this.boardView.setSelected(null);
    this.boardView.setHint(hint.from, hint.to);
    this.boardView.drawLink(hint.path);
    this.scheduleOnce(() => this.boardView.clearLink(), 0.35);
    this.refreshHud();
    this.flashAction('已显示提示');
  };

  private onShufflePressed = (): void => {
    if (this.paused || this.finished) {
      return;
    }
    if (this.shufflesLeft <= 0) {
      this.flashAction('洗牌次数已用完');
      return;
    }

    this.shufflesLeft -= 1;
    this.selected = null;
    this.boardView.setSelected(null);
    this.boardView.setHint(null, null);

    const ok = this.model.shuffleRemaining(LlkConfig.autoReshuffleMaxTries);
    this.boardView.refreshTiles();
    this.refreshHud();
    this.flashAction(ok ? '已洗牌' : '洗牌失败');

    if (!ok) {
      this.endGame(false, '洗牌失败');
    }
  };

  private onPausePressed = (): void => {
    if (this.finished) {
      return;
    }

    this.paused = !this.paused;
    if (this.paused) {
      this.showPopup('已暂停\n点击暂停继续');
      this.flashAction('已暂停');
    } else {
      this.hidePopup();
      this.flashAction('继续游戏');
    }
  };

  private onRestartPressed = (): void => {
    this.startNewGame();
  };

  private endGame(win: boolean, message: string): void {
    this.finished = true;
    this.paused = false;
    this.selected = null;
    this.boardView.setSelected(null);
    this.boardView.setHint(null, null);
    this.refreshHud();

    if (win) {
      this.showPopup(`胜利\n${message}\n点击重新开始`);
      this.flashAction('太棒了');
    } else {
      this.showPopup(`挑战失败\n${message}\n点击重新开始`);
      this.flashAction('挑战失败');
    }
  }

  private refreshHud(): void {
    const stats: GameStats = {
      score: this.score,
      remainingPairs: Math.floor(this.model.getRemainingCount() / 2),
      timeLeftSec: Math.ceil(this.timeLeftSec),
      hintsLeft: this.hintsLeft,
      shufflesLeft: this.shufflesLeft,
    };

    this.scoreLabel.string = `分数  ${stats.score}`;
    this.timeLabel.string = `时间  ${stats.timeLeftSec}秒`;
    this.progressLabel.string = `剩余  ${stats.remainingPairs} 对`;
    this.actionLabel.string = `提示 ${stats.hintsLeft}   洗牌 ${stats.shufflesLeft}`;

    const lowTime = stats.timeLeftSec <= 20;
    this.timeLabel.color = lowTime ? new Color(255, 118, 118, 255) : new Color(255, 234, 188, 255);
  }

  private flashAction(text: string): void {
    this.toastLabel.string = text;
    this.toastNode.active = true;
    this.toastOpacity.opacity = 0;
    Tween.stopAllByTarget(this.toastOpacity);
    tween(this.toastOpacity)
      .to(0.08, { opacity: 235 })
      .delay(0.65)
      .to(0.18, { opacity: 0 })
      .start();
  }

  private showPopup(text: string): void {
    this.popupLabel.string = text;
    this.popupNode.active = true;
  }

  private hidePopup(): void {
    this.popupNode.active = false;
  }

  private setupRuntimeUI(): void {
    const rootTrans = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
    const visible = view.getVisibleSize();
    rootTrans.setContentSize(visible.width, visible.height);

    this.drawRootBackground();

    this.headerNode = new Node('Header');
    this.headerNode.setParent(this.node);
    this.headerNode.addComponent(UITransform);
    this.headerPanel = this.headerNode.addComponent(Graphics);

    this.boardNode = new Node('Board');
    this.boardNode.setParent(this.node);
    this.boardNode.addComponent(UITransform);
    this.boardView = this.boardNode.addComponent(LlkBoardView);
    this.boardView.onTileTap = this.handleTileTap;

    this.footerNode = new Node('Footer');
    this.footerNode.setParent(this.node);
    this.footerNode.addComponent(UITransform);
    this.footerPanel = this.footerNode.addComponent(Graphics);

    this.createHeaderTexts();
    this.createFooterButtons();
    this.createToast();
    this.createPopup();
    this.layoutRuntimeUI();
  }

  private createHeaderTexts(): void {
    this.titleLabel = this.makeText(this.headerNode, '连连看', 30, new Color(71, 45, 40, 255), true);
    this.titleLabel.node.name = 'Title';

    this.scoreLabel = this.makeText(this.headerNode, '', 20, new Color(78, 55, 48, 255));
    this.scoreLabel.node.name = 'Score';

    this.timeLabel = this.makeText(this.headerNode, '', 20, new Color(159, 81, 50, 255));
    this.timeLabel.node.name = 'Time';

    this.progressLabel = this.makeText(this.headerNode, '', 18, new Color(104, 77, 66, 255));
    this.progressLabel.node.name = 'Progress';

    this.actionLabel = this.makeText(this.headerNode, '', 18, new Color(42, 123, 117, 255));
    this.actionLabel.node.name = 'Action';
  }

  private createFooterButtons(): void {
    this.buttons = [
      this.makeButton(this.footerNode, '重开', new Color(47, 143, 255, 255), this.onRestartPressed),
      this.makeButton(this.footerNode, '提示', new Color(255, 175, 33, 255), this.onHintPressed),
      this.makeButton(this.footerNode, '洗牌', new Color(32, 178, 122, 255), this.onShufflePressed),
      this.makeButton(this.footerNode, '暂停', new Color(108, 117, 139, 255), this.onPausePressed),
    ];
  }

  private createToast(): void {
    this.toastNode = new Node('Toast');
    this.toastNode.setParent(this.node);
    this.toastNode.addComponent(UITransform).setContentSize(360, 44);
    this.toastOpacity = this.toastNode.addComponent(UIOpacity);
    const g = this.toastNode.addComponent(Graphics);
    g.fillColor = new Color(90, 55, 47, 220);
    g.strokeColor = new Color(255, 255, 255, 60);
    g.lineWidth = 1.5;
    g.roundRect(-180, -22, 360, 44, 14);
    g.fill();
    g.stroke();
    this.toastLabel = this.makeText(this.toastNode, '', 16, new Color(255, 248, 240, 255), true);
    this.toastNode.active = false;
  }

  private createPopup(): void {
    this.popupNode = new Node('Popup');
    this.popupNode.setParent(this.node);
    this.popupNode.addComponent(UITransform).setContentSize(420, 220);
    const panel = this.popupNode.addComponent(Graphics);
    panel.fillColor = new Color(255, 249, 238, 246);
    panel.strokeColor = new Color(97, 67, 58, 62);
    panel.lineWidth = 2;
    panel.roundRect(-210, -110, 420, 220, 22);
    panel.fill();
    panel.stroke();

    const inner = new Node('PopupInner');
    inner.setParent(this.popupNode);
    inner.addComponent(UITransform).setContentSize(390, 190);
    const innerG = inner.addComponent(Graphics);
    innerG.strokeColor = new Color(97, 67, 58, 20);
    innerG.lineWidth = 1.2;
    innerG.roundRect(-195, -95, 390, 190, 18);
    innerG.stroke();

    this.popupLabel = this.makeText(this.popupNode, '', 24, new Color(78, 51, 44, 255), true);
    this.popupLabel.lineHeight = 34;
    this.popupNode.active = false;
    this.popupNode.on(Node.EventType.TOUCH_END, this.onRestartPressed, this);
  }

  private makeButton(parent: Node, text: string, bgColor: Color, onTap: () => void): UIButton {
    const node = new Node(`Btn_${text}`);
    node.setParent(parent);
    node.addComponent(UITransform).setContentSize(168, 58);
    const bg = node.addComponent(Graphics);
    const label = this.makeText(node, text, 17, new Color(255, 255, 255, 255), true);
    const button: UIButton = { node, bg, label, baseColor: bgColor };

    this.drawButton(button, false);
    node.on(Node.EventType.TOUCH_START, () => this.drawButton(button, true), this);
    node.on(Node.EventType.TOUCH_CANCEL, () => this.drawButton(button, false), this);
    node.on(Node.EventType.TOUCH_END, () => {
      this.drawButton(button, false);
      onTap.call(this);
    }, this);
    return button;
  }

  private drawButton(button: UIButton, pressed: boolean): void {
    const g = button.bg;
    const c = button.baseColor;
    const dark = new Color(Math.max(0, c.r - 35), Math.max(0, c.g - 35), Math.max(0, c.b - 35), 255);
    const trans = button.node.getComponent(UITransform)!;
    const w = trans.contentSize.width;
    const h = trans.contentSize.height;
    const hw = w / 2;
    const hh = h / 2;

    g.clear();
    g.fillColor = new Color(104, 60, 47, 22);
    g.roundRect(-hw - 2, -hh - 2, w + 4, h + 4, 18);
    g.fill();

    g.fillColor = pressed ? dark : c;
    g.strokeColor = new Color(80, 51, 45, pressed ? 120 : 95);
    g.lineWidth = 2.5;
    g.roundRect(-hw, -hh, w, h, 16);
    g.fill();
    g.stroke();

    g.fillColor = new Color(255, 255, 255, pressed ? 18 : 42);
    g.roundRect(-hw + 6, hh * 0.05, w - 12, Math.max(14, h * 0.28), 10);
    g.fill();

    g.strokeColor = new Color(255, 255, 255, 60);
    g.lineWidth = 1;
    g.roundRect(-hw + 5, -hh + 5, w - 10, h - 10, 12);
    g.stroke();

    button.label.node.setPosition(new Vec3(0, pressed ? -1.5 : 0, 0));
  }

  private makeText(parent: Node, text: string, fontSize: number, color: Color, center = false): Label {
    const node = new Node(`Text_${text || fontSize}`);
    node.setParent(parent);
    node.addComponent(UITransform).setContentSize(520, Math.max(32, fontSize + 10));
    const label = node.addComponent(Label);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 6;
    label.color = color;
    label.horizontalAlign = center ? 1 : 0;
    label.verticalAlign = 1;
    label.overflow = Label.Overflow.SHRINK;
    label.enableWrapText = false;
    return label;
  }

  private drawRootBackground(): void {
    this.backgroundNode = new Node('Background');
    this.backgroundNode.setParent(this.node);
    this.backgroundNode.setSiblingIndex(0);
    const visible = view.getVisibleSize();
    this.backgroundNode.addComponent(UITransform).setContentSize(visible.width, visible.height);
    this.backgroundGraphics = this.backgroundNode.addComponent(Graphics);
    this.redrawBackground(visible.width, visible.height);
  }

  private redrawBackground(width: number, height: number): void {
    if (!this.backgroundGraphics || !this.backgroundNode) {
      return;
    }
    this.backgroundNode.getComponent(UITransform)!.setContentSize(width, height);
    const g = this.backgroundGraphics;
    g.clear();
    g.fillColor = new Color(255, 245, 228, 255);
    g.rect(-width / 2, -height / 2, width, height);
    g.fill();

    g.fillColor = new Color(255, 255, 255, 110);
    g.rect(-width / 2, -height / 2, width, height);
    g.fill();

    if (height > width) {
      g.fillColor = new Color(255, 158, 116, 90);
      g.circle(-width * 0.28, height * 0.34, Math.min(180, Math.max(120, width * 0.22)));
      g.fill();
      g.fillColor = new Color(138, 96, 220, 40);
      g.circle(width * 0.18, height * 0.44, Math.min(110, Math.max(76, width * 0.12)));
      g.fill();
      g.fillColor = new Color(72, 189, 188, 62);
      g.circle(width * 0.28, -height * 0.08, Math.min(200, Math.max(140, width * 0.24)));
      g.fill();
      g.fillColor = new Color(255, 196, 72, 54);
      g.circle(-width * 0.32, -height * 0.26, Math.min(170, Math.max(110, width * 0.2)));
      g.fill();
    } else {
      g.fillColor = new Color(255, 166, 122, 85);
      g.circle(-width * 0.18, height * 0.26, Math.min(220, Math.max(140, width * 0.2)));
      g.fill();
      g.fillColor = new Color(74, 193, 192, 70);
      g.circle(width * 0.28, -height * 0.08, Math.min(280, Math.max(160, width * 0.24)));
      g.fill();
      g.fillColor = new Color(154, 119, 227, 38);
      g.circle(width * 0.12, height * 0.36, Math.min(150, Math.max(90, width * 0.12)));
      g.fill();
      g.fillColor = new Color(255, 206, 96, 42);
      g.circle(-width * 0.34, -height * 0.24, Math.min(260, Math.max(120, height * 0.2)));
      g.fill();
    }

    g.strokeColor = new Color(190, 132, 113, 28);
    g.lineWidth = 1;
    const step = width > height ? 42 : 34;
    for (let x = -Math.floor(width / 2); x <= Math.floor(width / 2); x += step) {
      g.moveTo(x, -height / 2);
      g.lineTo(x, height / 2);
    }
    for (let y = -Math.floor(height / 2); y <= Math.floor(height / 2); y += step) {
      g.moveTo(-width / 2, y);
      g.lineTo(width / 2, y);
    }
    g.stroke();

    g.strokeColor = new Color(255, 255, 255, 95);
    g.lineWidth = 2;
    g.roundRect(-width / 2 + 8, -height / 2 + 8, width - 16, height - 16, 24);
    g.stroke();
  }

  private layoutRuntimeUI(): void {
    const visible = view.getVisibleSize();
    this.lastVisibleW = visible.width;
    this.lastVisibleH = visible.height;
    this.node.getComponent(UITransform)!.setContentSize(visible.width, visible.height);
    this.redrawBackground(visible.width, visible.height);

    const isLandscape = visible.width / visible.height > 1.08;
    if (isLandscape) {
      this.layoutLandscape(visible.width, visible.height);
    } else {
      this.layoutPortrait(visible.width, visible.height);
    }

    const boardPos = this.boardNode.position;
    this.popupNode.setPosition(new Vec3(boardPos.x, boardPos.y, 10));
  }

  private layoutPortrait(width: number, height: number): void {
    const margin = 4;
    const topInset = 8;
    const bottomInset = 8;
    const headerH = width < 420 ? 152 : 164;
    const footerH = width < 420 ? 154 : 166;
    const panelW = Math.min(width - margin * 2, 760);

    const boardAvailW = width - margin * 2;
    const boardAvailH = height - headerH - footerH - topInset - bottomInset - 10;
    const metrics = this.computeBoardMetrics(boardAvailW, boardAvailH, false);
    this.boardView.resizeAndRelayout(metrics.tileSize, metrics.gap, metrics.padding);
    const boardSize = this.boardNode.getComponent(UITransform)!.contentSize;

    this.headerNode.getComponent(UITransform)!.setContentSize(panelW, headerH);
    this.footerNode.getComponent(UITransform)!.setContentSize(panelW, footerH);

    const gap1 = 8;
    const gap2 = 8;
    const clusterH = headerH + gap1 + boardSize.height + gap2 + footerH;
    const maxTop = height / 2 - topInset;
    const minBottom = -height / 2 + bottomInset;
    const minCenterY = minBottom + clusterH / 2;
    const maxCenterY = maxTop - clusterH / 2;
    const targetCenterY = -height * 0.03;
    const clusterCenterY = Math.max(minCenterY, Math.min(maxCenterY, targetCenterY));
    const clusterTopY = clusterCenterY + clusterH / 2;
    const headerY = clusterTopY - headerH / 2;
    const boardY = clusterTopY - headerH - gap1 - boardSize.height / 2;
    const footerY = clusterTopY - headerH - gap1 - boardSize.height - gap2 - footerH / 2;

    this.headerNode.setPosition(new Vec3(0, headerY, 0));
    this.boardNode.setPosition(new Vec3(0, boardY, 0));
    this.footerNode.setPosition(new Vec3(0, footerY, 0));

    this.drawHeaderPanel();
    this.drawFooterPanel();
    this.layoutHeaderTexts(false, panelW, headerH);
    this.layoutButtons(false, this.footerNode.getComponent(UITransform)!.contentSize.width);

    this.toastNode.setPosition(new Vec3(0, this.footerNode.position.y + footerH / 2 + 22, 5));
  }

  private layoutLandscape(width: number, height: number): void {
    const margin = 12;
    const sideW = Math.max(280, Math.min(360, width * 0.31));
    const leftX = -width / 2 + margin + sideW / 2;
    const sideGap = 12;
    const rightAreaW = width - sideW - margin * 2 - sideGap;
    const rightAreaH = height - margin * 2;

    const headerH = 150;
    const footerH = Math.max(220, Math.min(300, rightAreaH - headerH - 22));

    this.headerNode.getComponent(UITransform)!.setContentSize(sideW, headerH);
    this.footerNode.getComponent(UITransform)!.setContentSize(sideW, footerH);
    this.headerNode.setPosition(new Vec3(leftX, height / 2 - margin - headerH / 2, 0));
    this.footerNode.setPosition(new Vec3(leftX, this.headerNode.position.y - headerH / 2 - 12 - footerH / 2, 0));

    this.drawHeaderPanel();
    this.drawFooterPanel();
    this.layoutHeaderTexts(true, sideW, headerH);
    this.layoutButtons(true, sideW);

    const metrics = this.computeBoardMetrics(rightAreaW, rightAreaH, true);
    this.boardView.resizeAndRelayout(metrics.tileSize, metrics.gap, metrics.padding);
    const boardSize = this.boardNode.getComponent(UITransform)!.contentSize;
    const rightLeft = -width / 2 + margin + sideW + sideGap;
    const rightCenterX = rightLeft + rightAreaW / 2;
    this.boardNode.setPosition(new Vec3(rightCenterX, 0, 0));

    this.toastNode.setPosition(new Vec3(rightCenterX, -height / 2 + margin + 26, 5));
  }

  private layoutHeaderTexts(isLandscape: boolean, panelW: number, panelH: number): void {
    const titleTrans = this.titleLabel.node.getComponent(UITransform)!;
    const scoreTrans = this.scoreLabel.node.getComponent(UITransform)!;
    const timeTrans = this.timeLabel.node.getComponent(UITransform)!;
    const progressTrans = this.progressLabel.node.getComponent(UITransform)!;
    const actionTrans = this.actionLabel.node.getComponent(UITransform)!;

    if (isLandscape) {
      this.titleLabel.fontSize = panelW < 320 ? 22 : 26;
      this.titleLabel.lineHeight = this.titleLabel.fontSize + 6;
      titleTrans.setContentSize(panelW - 24, 36);
      this.titleLabel.node.setPosition(new Vec3(0, panelH / 2 - 30, 0));

      const textW = Math.max(120, panelW - 28);
      scoreTrans.setContentSize(textW, 24);
      timeTrans.setContentSize(textW, 24);
      progressTrans.setContentSize(textW, 22);
      actionTrans.setContentSize(textW, 22);
      this.scoreLabel.fontSize = panelW < 320 ? 16 : 18;
      this.timeLabel.fontSize = panelW < 320 ? 16 : 18;
      this.progressLabel.fontSize = panelW < 320 ? 15 : 17;
      this.actionLabel.fontSize = panelW < 320 ? 15 : 17;
      this.scoreLabel.lineHeight = this.scoreLabel.fontSize + 4;
      this.timeLabel.lineHeight = this.timeLabel.fontSize + 4;
      this.progressLabel.lineHeight = this.progressLabel.fontSize + 4;
      this.actionLabel.lineHeight = this.actionLabel.fontSize + 4;
      this.scoreLabel.node.setPosition(new Vec3(0, 26, 0));
      this.timeLabel.node.setPosition(new Vec3(0, 1, 0));
      this.progressLabel.node.setPosition(new Vec3(0, -26, 0));
      this.actionLabel.node.setPosition(new Vec3(0, -52, 0));
    } else {
      this.titleLabel.fontSize = panelW < 420 ? 24 : 30;
      this.titleLabel.lineHeight = this.titleLabel.fontSize + 6;
      titleTrans.setContentSize(panelW - 22, 40);
      this.titleLabel.node.setPosition(new Vec3(0, panelH / 2 - 28, 0));

      const innerPad = 16;
      const colGap = 10;
      const colW = Math.max(110, (panelW - innerPad * 2 - colGap) / 2);
      scoreTrans.setContentSize(colW, 28);
      timeTrans.setContentSize(colW, 28);
      progressTrans.setContentSize(colW, 24);
      actionTrans.setContentSize(colW, 24);
      this.scoreLabel.fontSize = panelW < 420 ? 18 : 20;
      this.timeLabel.fontSize = panelW < 420 ? 18 : 20;
      this.progressLabel.fontSize = panelW < 420 ? 16 : 18;
      this.actionLabel.fontSize = panelW < 420 ? 16 : 18;
      this.scoreLabel.lineHeight = this.scoreLabel.fontSize + 4;
      this.timeLabel.lineHeight = this.timeLabel.fontSize + 4;
      this.progressLabel.lineHeight = this.progressLabel.fontSize + 4;
      this.actionLabel.lineHeight = this.actionLabel.fontSize + 4;

      const leftColLeft = -panelW / 2 + innerPad;
      const rightColLeft = leftColLeft + colW + colGap;
      const leftX = leftColLeft + colW / 2;
      const rightX = rightColLeft + colW / 2;
      this.scoreLabel.node.setPosition(new Vec3(leftX, -10, 0));
      this.timeLabel.node.setPosition(new Vec3(rightX, -10, 0));
      this.progressLabel.node.setPosition(new Vec3(leftX, -40, 0));
      this.actionLabel.node.setPosition(new Vec3(rightX, -40, 0));
    }
  }

  private layoutButtons(isLandscape: boolean, panelW: number): void {
    const buttons = this.buttons.map((b) => b.node);
    if (isLandscape) {
      for (const button of buttons) {
        button.setScale(new Vec3(1, 1, 1));
      }
      const startY = 76;
      const stepY = 58;
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].setPosition(new Vec3(0, startY - i * stepY, 0));
      }
    } else {
      const scale = panelW < 420 ? 1.12 : 1.18;
      for (const button of buttons) {
        button.setScale(new Vec3(scale, scale, 1));
      }
      const xOffset = panelW < 420 ? 96 : 108;
      const y1 = 34;
      const y2 = -34;
      const points = [new Vec3(-xOffset, y1, 0), new Vec3(xOffset, y1, 0), new Vec3(-xOffset, y2, 0), new Vec3(xOffset, y2, 0)];
      for (let i = 0; i < buttons.length; i++) {
        buttons[i].setPosition(points[i]);
      }
    }
  }

  private drawHeaderPanel(): void {
    const trans = this.headerNode.getComponent(UITransform)!;
    const w = trans.contentSize.width;
    const h = trans.contentSize.height;
    const g = this.headerPanel;
    g.clear();

    g.fillColor = new Color(255, 250, 241, 242);
    g.strokeColor = new Color(107, 74, 61, 45);
    g.lineWidth = 2.5;
    g.roundRect(-w / 2, -h / 2, w, h, 18);
    g.fill();
    g.stroke();

    g.fillColor = new Color(255, 143, 101, 44);
    g.roundRect(-w / 2 + 10, h / 2 - 38, w - 20, 18, 9);
    g.fill();

    g.fillColor = new Color(73, 195, 190, 26);
    g.roundRect(-w / 2 + 10, -h / 2 + 12, w - 20, h - 58, 12);
    g.fill();

    g.strokeColor = new Color(107, 74, 61, 20);
    g.lineWidth = 1;
    g.roundRect(-w / 2 + 10, -h / 2 + 8, w - 20, h - 16, 14);
    g.stroke();
  }

  private drawFooterPanel(): void {
    const trans = this.footerNode.getComponent(UITransform)!;
    const w = trans.contentSize.width;
    const h = trans.contentSize.height;
    const g = this.footerPanel;
    g.clear();
    g.fillColor = new Color(255, 250, 241, 238);
    g.strokeColor = new Color(107, 74, 61, 36);
    g.lineWidth = 2.5;
    g.roundRect(-w / 2, -h / 2, w, h, 18);
    g.fill();
    g.stroke();

    g.fillColor = new Color(255, 183, 122, 26);
    g.roundRect(-w / 2 + 10, h / 2 - 26, w - 20, 14, 8);
    g.fill();
  }

  private computeBoardMetrics(maxW: number, maxH: number, isLandscape: boolean): { tileSize: number; gap: number; padding: number } {
    const rawGap = LlkConfig.tileGap;
    const rawPadding = LlkConfig.boardPadding;

    const sizeByW = (maxW - rawPadding * 2 - (LlkConfig.cols - 1) * rawGap) / LlkConfig.cols;
    const sizeByH = (maxH - rawPadding * 2 - (LlkConfig.rows - 1) * rawGap) / LlkConfig.rows;
    const dynamicMax = isLandscape ? 74 : 110;
    const tileSize = Math.max(34, Math.floor(Math.min(dynamicMax, sizeByW, sizeByH)));
    const gap = isLandscape
      ? (tileSize <= 42 ? 4 : tileSize <= 52 ? 6 : rawGap)
      : (tileSize <= 42 ? 3 : tileSize <= 56 ? 4 : 5);
    const padding = isLandscape
      ? (tileSize <= 42 ? 10 : rawPadding)
      : (tileSize <= 42 ? 6 : 8);
    return { tileSize, gap, padding };
  }

  private checkResize(): void {
    const visible = view.getVisibleSize();
    if (Math.abs(visible.width - this.lastVisibleW) > 0.5 || Math.abs(visible.height - this.lastVisibleH) > 0.5) {
      this.layoutRuntimeUI();
    }
  }

  private samePos(a: GridPos, b: GridPos): boolean {
    return a.row === b.row && a.col === b.col;
  }
}
