// 記事の静的ページ (article/…/index.html) で計算機を動かす入口。
// 静的ページは計算機があるときだけこのスクリプトを読み込む (src/lib/static-pages.js)。
import { mountLoomCalculators } from "./lib/loom/widgets.js";

mountLoomCalculators(document);
