// i18n.js — 軽量な多言語対応(ja / en)。?lang= か config.lang か navigator.language で決定。
// 静的要素は data-i18n / data-i18n-html 属性で差し替え、動的文字列は t(key) を使う。

const DICT = {
  ja: {
    appTitle: "IIIF バーチャル美術館",
    entranceLead: "モードと展示を選んで「入室する」",
    enter: "入室する →",
    back: "← 入口",
    modeThird: "歩く(三人称)",
    modeWalk: "歩く(一人称)",
    modeOrbit: "見回す",
    charMan: "男性",
    charGirl: "女性",
    urlLabel: "自分の IIIF を見る",
    urlPlaceholder: "Curation / Collection / Manifest の URL",
    urlLoad: "読み込む",
    tutWatch: "▶ 使い方を見る",
    panelRights: "利用条件・ライセンス",
    panelMeta: "メタデータ",
    panelSource: "IIIF ソース",
    toWalk: "歩く",
    toLook: "見回す",
    loading: "読み込み中…",
    zoom: "拡大する",
    zoomHintE: "E で拡大",
    helpHtml:
      "見回す: ドラッグ/ホイール ・ 歩く: WASD／矢印（スマホはスティック）<br>作品にカーソル → <b>拡大ボタン</b>（歩行中は<b>E</b>）で拡大 ・ Esc で戻る",
    walkBig: "クリックで歩行開始",
    walkSub: "WASD / 矢印で移動　マウスで見回す　作品を見て E で拡大　Esc で解除",
    close: "閉じる (Esc)",
  },
  en: {
    appTitle: "IIIF Virtual Museum",
    entranceLead: "Choose a mode and an exhibition, then “Enter”",
    enter: "Enter →",
    back: "← Lobby",
    modeThird: "Third-person (walk)",
    modeWalk: "First-person (walk)",
    modeOrbit: "Look around",
    charMan: "Man",
    charGirl: "Girl",
    urlLabel: "View your own IIIF",
    urlPlaceholder: "Curation / Collection / Manifest URL",
    urlLoad: "Load",
    tutWatch: "▶ Watch tutorial",
    panelRights: "Rights & License",
    panelMeta: "Metadata",
    panelSource: "IIIF source",
    toWalk: "Walk",
    toLook: "Look",
    loading: "Loading…",
    zoom: "Zoom",
    zoomHintE: "Press E to zoom",
    helpHtml:
      "Look: drag / wheel ・ Walk: WASD / arrows (stick on mobile)<br>Aim at a work → <b>Zoom button</b> (or <b>E</b> while walking) ・ Esc to exit",
    walkBig: "Click to start walking",
    walkSub: "WASD / arrows to move　mouse to look　aim at a work and press E to zoom　Esc to release",
    close: "Close (Esc)",
  },
};

let LANG = "ja";

export function setLang(l) {
  const code = (l || "").slice(0, 2).toLowerCase();
  LANG = DICT[code] ? code : "ja";
  document.documentElement.lang = LANG;
}

export function getLang() {
  return LANG;
}

export function t(key) {
  return (DICT[LANG] && DICT[LANG][key]) ?? DICT.ja[key] ?? key;
}

// data-i18n(textContent) / data-i18n-html(innerHTML) を持つ静的要素を一括反映
export function applyI18n() {
  document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  document.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.dataset.i18nHtml)));
  document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
}
