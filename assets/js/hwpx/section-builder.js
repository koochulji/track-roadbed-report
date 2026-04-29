// section0.xml 슬롯 치환 + 본문/라벨 subList 생성
import { SECTION_TEMPLATE_XML } from './hwpx-assets.js';
import { PARA, CHAR, LINESEG_PRESET } from './id-map.js';

function xmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function lineseg(preset) {
  const p = LINESEG_PRESET[preset];
  return `<hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="${p.vertsize}" textheight="${p.textheight}" baseline="${p.baseline}" spacing="${p.spacing}" horzpos="${p.horzpos}" horzsize="${p.horzsize}" flags="${p.flags}"/></hp:linesegarray>`;
}

// 단일 run 문단.
// preset:'auto' (기본) → linesegarray 생략하여 한글이 직접 줄바꿈/자간 계산.
//   긴 텍스트가 셀 너비를 넘을 때 자간 압축 또는 다음 줄과 텍스트 겹침 버그 방지.
function P(paraId, charId, text, { preset = 'auto' } = {}) {
  const t = text === '' || text == null
    ? '<hp:t/>'
    : `<hp:t>${xmlEscape(text)}</hp:t>`;
  const seg = preset === 'auto' ? '' : lineseg(preset);
  return `<hp:p id="2147483648" paraPrIDRef="${paraId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`
    + `<hp:run charPrIDRef="${charId}">${t}</hp:run>`
    + seg
    + `</hp:p>`;
}

// 다중 run 문단. (긴 프로젝트 제목 라인 전용)
// preset:'auto' (기본) → linesegarray 생략하여 한글이 직접 줄바꿈 계산.
//   긴 제목이 셀 너비를 넘을 때 다음 줄과 텍스트가 겹치는 버그 방지.
function Pmulti(paraId, runs, { preset = 'auto' } = {}) {
  const runsXml = runs.map(([cid, text]) => {
    const t = text === '' || text == null
      ? '<hp:t/>'
      : `<hp:t>${xmlEscape(text)}</hp:t>`;
    return `<hp:run charPrIDRef="${cid}">${t}</hp:run>`;
  }).join('');
  const seg = preset === 'auto' ? '' : lineseg(preset);
  return `<hp:p id="2147483648" paraPrIDRef="${paraId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`
    + runsXml
    + seg
    + `</hp:p>`;
}

// 라벨 셀 첫 문단 (colPr ctrl + 타이틀)
// linesegarray 는 의도적으로 포함하지 않음 — 짧은 셀 너비에 긴 텍스트가 들어갈 때
// 캐시된 lineseg 1개가 한글 렌더러에 "한 줄에 다 넣어라" 힌트로 작용해 자간이 압축되는
// 문제를 피하기 위해, 라벨 셀 문단만 캐시를 비워 한글이 전적으로 재계산하도록 맡긴다.
function labelHead(text) {
  return `<hp:p id="2147483648" paraPrIDRef="${PARA.LABEL_TITLE}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`
    + `<hp:run charPrIDRef="${CHAR.LABEL_TEXT}">`
    + `<hp:ctrl><hp:colPr id="" type="NEWSPAPER" layout="LEFT" colCount="1" sameSz="1" sameGap="0"/></hp:ctrl>`
    + `</hp:run>`
    + `<hp:run charPrIDRef="${CHAR.LABEL_TEXT}"><hp:t>${xmlEscape(text)}</hp:t></hp:run>`
    + `</hp:p>`;
}

// 라벨 셀 두번째 문단 (날짜 범위) — linesegarray 생략 (위와 동일 이유)
function labelRange(text) {
  const t = text === '' || text == null
    ? '<hp:t/>'
    : `<hp:t>${xmlEscape(text)}</hp:t>`;
  return `<hp:p id="2147483648" paraPrIDRef="${PARA.LABEL_TITLE}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0">`
    + `<hp:run charPrIDRef="${CHAR.LABEL_TEXT}">${t}</hp:run>`
    + `</hp:p>`;
}

// 라벨 셀 subList 내용 생성 (2줄: 제목 + 부제목)
export function buildLabelSubList(title, range) {
  return labelHead(title) + labelRange(range);
}

// 라벨 셀 subList 내용 생성 — 3줄 버전 (제목 + 부제목 + 날짜 범위)
export function buildLabelSubListThree(title, subtitle, range) {
  return labelHead(title) + labelRange(subtitle) + labelRange(range);
}

// 포맷: "오송시험선로 디지털화를 위한 시험선 답사(4/13, ESNT, 박정준)"
export function formatItem(item) {
  const meta = [item.date, item.org, item.person].filter(x => x && String(x).trim()).join(', ');
  const text = (item.text ?? '').trim();
  if (!meta) return text;
  return `${text}(${meta})`;
}

// 본문 셀 — kind별 헤더 구성 헬퍼
// 대분류 그룹의 순서 (샘플 양식 기준). 존재하는 kind만 필터하여 연속 번호 매김.
const KIND_ORDER = ['basic', 'natl_rnd', 'consign', 'etc'];
export const KIND_NAMES = {
  basic: '기본사업',
  natl_rnd: '국가R&D',
  consign: '수탁사업',
  etc: '기타',
};
function kindLabel(kind, idx) {
  return `(${idx}) ${KIND_NAMES[kind] ?? kind}`;
}

// 일반보고 양식의 kind 헤더: "<기본사업>" 형식 (꺽쇠 포함)
function kindHeaderLabel(kind) {
  return `<${KIND_NAMES[kind] ?? kind}>`;
}

// Compat: 기존 past/next 또는 새 단일 배열 모두 처리
function flattenSubmissionEntries(sub) {
  const e = sub?.entries;
  if (Array.isArray(e)) return e;
  if (e && (Array.isArray(e.past) || Array.isArray(e.next))) {
    const map = new Map();
    for (const arr of [e.past ?? [], e.next ?? []]) {
      for (const ent of arr) {
        const key = ent?.categoryId;
        if (!key) continue;
        if (!map.has(key)) map.set(key, { categoryId: key, items: [] });
        map.get(key).items.push(...(ent.items ?? []));
      }
    }
    return [...map.values()];
  }
  return [];
}

// 집계: submissions에서 모든 카테고리별 항목을 모은다.
// 옵션: { onlyImportant: true } → important=true 항목만
export function aggregateItems(submissions, { onlyImportant = false } = {}) {
  /** @returns {Object<string, Array>}  categoryId → items[] */
  const out = {};
  for (const sub of submissions) {
    const entries = flattenSubmissionEntries(sub);
    for (const ce of entries) {
      if (!ce?.categoryId) continue;
      for (const it of (ce.items ?? [])) {
        if (!it) continue;
        const text = (it.text ?? '').trim();
        if (!text) continue;
        if (onlyImportant && !it.important) continue;
        if (!out[ce.categoryId]) out[ce.categoryId] = [];
        out[ce.categoryId].push({
          text,
          date: (it.date ?? '').trim(),
          org: (it.org ?? '').trim(),
          person: (it.person ?? sub.authorName ?? '').trim(),
          important: !!it.important,
        });
      }
    }
  }
  return out;
}

// 일반 보고 본문 셀: 궤도노반연구실 양식
//   [궤도노반연구실]
//   <기본사업>
//   (1) 과제명 (책임자)
//    - 항목 1
//    - 항목 2
//   (2) 과제명 (책임자)
//   <국가R&D>
//   (9) 과제명 ...
export function buildGeneralReportBody(round, submissions, { orgName = '[궤도노반연구실]' } = {}) {
  const categories = round.categoriesSnapshot ?? [];
  const itemsByCat = aggregateItems(submissions);

  const existingKinds = KIND_ORDER.filter(k => categories.some(c => c.kind === k));

  const parts = [];
  parts.push(P(PARA.ORG_LINE, CHAR.ORG_AND_KIND, orgName));

  let projectCounter = 0;
  for (const kind of existingKinds) {
    const kindsCats = categories
      .filter(c => c.kind === kind)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // 대분류 헤더: "<기본사업>"
    parts.push(P(PARA.ORG_LINE, CHAR.ORG_AND_KIND, kindHeaderLabel(kind)));

    for (const cat of kindsCats) {
      const items = itemsByCat[cat.id] ?? [];
      projectCounter += 1;
      const ownerSuffix = cat.owner ? ` (${cat.owner})` : '';
      // 과제 라인: "(N) 과제명 (책임자)"
      parts.push(Pmulti(PARA.PROJECT_LINE, [
        [CHAR.ORG_AND_KIND, `(${projectCounter}) `],
        [CHAR.PROJECT_TITLE, `${cat.title}${ownerSuffix}`],
      ]));
      // 항목 bullet
      for (const it of items) {
        const charId = it.important ? CHAR.BULLET_BOLD : CHAR.BULLET_TEXT;
        parts.push(P(PARA.BULLET, charId, formatItem(it), { preset: 'bullet' }));
      }
    }
  }
  return parts.join('');
}

// 주요 보고 본문 셀: important=true 항목만, kind별 그룹 없이 카테고리 순서대로 출력
export function buildMainReportBody(round, submissions, { orgName = '[궤도노반연구실]' } = {}) {
  const categories = round.categoriesSnapshot ?? [];
  const itemsByCat = aggregateItems(submissions, { onlyImportant: true });

  // 카테고리는 store의 order 순서대로, 항목 있는 것만
  const cats = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const parts = [];
  parts.push(P(PARA.ORG_LINE, CHAR.ORG_AND_KIND, orgName));

  let projectCounter = 0;
  for (const cat of cats) {
    const items = itemsByCat[cat.id] ?? [];
    if (items.length === 0) continue;  // 주요 항목 없는 과제는 출력 생략
    projectCounter += 1;
    const ownerSuffix = cat.owner ? `(${cat.owner})` : '';
    const kindPrefix = `[${KIND_NAMES[cat.kind] ?? cat.kind}]`;
    parts.push(Pmulti(PARA.PROJECT_LINE, [
      [CHAR.ORG_AND_KIND, `(${projectCounter}) ${kindPrefix} `],
      [CHAR.PROJECT_TITLE, `${cat.title}${ownerSuffix}`],
    ]));
    for (const it of items) {
      const charId = CHAR.BULLET_BOLD;  // 주요보고는 모든 항목 굵게
      parts.push(P(PARA.BULLET, charId, formatItem(it), { preset: 'bullet' }));
    }
  }

  // 비어있어도 최소 한 줄은 둠
  if (projectCounter === 0) {
    parts.push(P(PARA.BLANK, CHAR.BULLET_TEXT, '(주요 보고 항목 없음)', { preset: 'bullet' }));
  } else {
    parts.push(P(PARA.BLANK, CHAR.BULLET_TEXT, '', { preset: 'blank' }));
  }
  return parts.join('');
}

// 메인: section0.xml 전체 문자열 생성
export function buildSection0Xml(round, submissions) {
  const orgName = round.orgName || '[궤도노반연구실]';

  // Row 0 (PAST slot, repurposed): "주 요 / 보고사항"
  const mainLabel = buildLabelSubList('주 요', '보고사항');
  const mainBody = buildMainReportBody(round, submissions, { orgName });

  // Row 1 (NEXT slot, repurposed): "일반 보고사항 / 지난 주(달) 실적 / (range)"
  const periodLabel = round.form === 'monthly' ? '지난 달 실적' : '지난 주 실적';
  const periodRange = `(${round.rangeStart} ~ ${round.rangeEnd})`;
  const generalLabelFull = buildLabelSubListThree('일반 보고사항', periodLabel, periodRange);
  const generalBody = buildGeneralReportBody(round, submissions, { orgName });

  return SECTION_TEMPLATE_XML
    .replace('{{PAST_LABEL_SUBLIST}}', mainLabel)
    .replace('{{PAST_BODY_SUBLIST}}', mainBody)
    .replace('{{NEXT_LABEL_SUBLIST}}', generalLabelFull)
    .replace('{{NEXT_BODY_SUBLIST}}', generalBody);
}
