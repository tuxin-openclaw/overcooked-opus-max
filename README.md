# 手忙脚乱厨房

仿《胡闹厨房（Overcooked）》的 3D 合作做饭游戏。Three.js + React Three Fiber，模型可用 Blender 生成。

在线玩：[tuxin-openclaw.github.io/overcooked-opus-max](https://tuxin-openclaw.github.io/overcooked-opus-max/)

## 运行

```bash
pnpm install
pnpm dev          # 打开 http://127.0.0.1:5188
```

| 命令 | 作用 |
| --- | --- |
| `pnpm test` | 跑玩法逻辑测试（不需要浏览器） |
| `pnpm typecheck` | 类型检查 |
| `pnpm build` | 打包到 `dist/` |

## 玩法

切菜 → 下锅 → 装盘 → 上菜。3 份同样的菜煮一锅汤。越快上菜，小费越多。订单超时扣分。脏盘子会送回来，要洗。锅放太久会糊。

| 动作 | 单人 | 双人：蓝 | 双人：红 |
| --- | --- | --- | --- |
| 移动 | WASD / 方向键 | WASD | 方向键 |
| 拿 / 放 | 空格 / J | 空格 | Enter |
| 切菜 / 洗碗 | E / K | E | 右 Shift |
| 冲刺 | Shift / L | 左 Shift | / |
| 换厨师 | Tab / Q | — | — |
| 暂停 | Esc / P | Esc / P | Esc / P |

也支持手柄：A 拿放，X 切洗，B 冲刺，LB/RB 换人，Start 暂停。

## 用 Blender 做模型

游戏自带用代码搭的模型，所以没有 Blender 也能玩。装了 Blender（4.x）后：

```bash
blender -b -P blender/build_assets.py
```

它会生成：

- `public/models/kitchen.glb`：所有模型
- `public/models/manifest.json`：要替换的部件名单
- `blender/kitchen.blend`：可以手改的工程

刷新页面，游戏就换上 Blender 模型。缺哪个部件，就用自带的那个。想让线上版也用 Blender 模型，把 `public/models/` 一起提交。

可替换的部件：`onion` `tomato` `mushroom` `onion_chopped` `tomato_chopped` `mushroom_chopped` `pot` `plate` `plate_dirty` `chef_body` `chef_head` `chef_head_b` `chef_hat` `chef_hand` `chef_foot`。

手改规则：

1. 物体名就是部件名，别改。
2. 1 个单位 = 1 格地砖。正面朝 Blender 的 -Y。
3. 名叫 `team` 的材质会被染成厨师的队伍色。
4. 改完：文件 → 导出 → glTF 2.0，选 `.glb`，勾“应用修改器”，存到 `public/models/kitchen.glb`。

## 发布到 GitHub Pages

`.github/workflows/pages.yml` 负责发布：

| 时机 | 做什么 |
| --- | --- |
| 开拉取请求 | 测试、打包 |
| 合并到 `main` | 测试、打包、发布 |

线上网址带子路径 `/overcooked-opus-max/`。它由 `BASE_PATH` 决定，工作流会自动设好。本地按线上的样子试：

```bash
BASE_PATH=/overcooked-opus-max/ pnpm build
BASE_PATH=/overcooked-opus-max/ pnpm preview   # 打开 http://127.0.0.1:5189/overcooked-opus-max/
```

## 代码结构

| 目录 | 内容 |
| --- | --- |
| `src/game/` | 纯逻辑：地图、移动碰撞、切菜煮汤、订单计分。没有 3D，可单测 |
| `src/scene/` | 3D：厨房、厨师、食物、特效、镜头、主循环 |
| `src/ui/` | 界面：标题、订单、计时、暂停、结算 |
| `src/input/` | 键盘和手柄 |
| `src/audio/` | 音效（WebAudio 现场合成，没有音频文件） |
| `blender/` | Blender 建模导出脚本 |

加关卡：在 `src/game/levels.ts` 里画一张字符地图，图例写在文件里。
