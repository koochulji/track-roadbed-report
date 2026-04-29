// HTML 미리보기 렌더러 — HWPX 출력(section-builder.js)과 같은 구조로 화면에 표시.
// Row 0: 주요 보고사항 (important=true 항목만, past+next 통합)
// Row 1: 일반 보고사항 — 지난 X 실적 (past) + 이번 X 계획 (next), 같은 셀 안 두 섹션

import { aggregateItems, KIND_NAMES, formatItem } from '../hwpx/section-builder.js';

const KIND_ORDER = ['basic', 'natl_rnd', 'consign', 'etc'];

function escape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(s) {
  if (!s) return '';
  // YYYY-MM-DD → YYYY. MM. DD.
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[1]}. ${m[2]}. ${m[3]}.`;
}

function formatRange(a, b) {
  if (!a && !b) return '';
  // YYYY-MM-DD → MM.DD.
  const compact = s => {
    const m = String(s ?? '').match(/^\d{4}-(\d{2})-(\d{2})/);
    return m ? `${m[1]}.${m[2]}.` : (s ?? '');
  };
  return `${compact(a)} ~ ${compact(b)}`;
}

function renderMainBody(orgName, categories, itemsByCat) {
  const cats = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  let html = `<div class="org">${escape(orgName)}</div>`;
  let counter = 0;
  for (const cat of cats) {
    const items = itemsByCat[cat.id] ?? [];
    if (items.length === 0) continue;
    counter += 1;
    const kindPrefix = `[${KIND_NAMES[cat.kind] ?? cat.kind}]`;
    const ownerSuffix = cat.owner ? `(${escape(cat.owner)})` : '';
    html += `<div class="project">(${counter}) ${escape(kindPrefix)} ${escape(cat.title)} <span class="muted">${ownerSuffix}</span></div>`;
    html += '<ul class="items">';
    for (const it of items) {
      html += `<li class="important">${escape(formatItem(it))}</li>`;
    }
    html += '</ul>';
  }
  if (counter === 0) {
    html += '<div class="muted">(주요 보고 항목 없음)</div>';
  }
  return html;
}

// kind > category 그룹핑된 본문 렌더 (단일 시점 — past 또는 next)
function renderKindGroupedBody(categories, itemsByCat, counterStart = 0) {
  let html = '';
  const existingKinds = KIND_ORDER.filter(k => categories.some(c => c.kind === k));
  let counter = counterStart;
  for (const kind of existingKinds) {
    const kindsCats = categories
      .filter(c => c.kind === kind)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const kindHasAny = kindsCats.some(c => (itemsByCat[c.id] ?? []).length > 0);
    if (!kindHasAny) continue;
    html += `<div class="kind">&lt;${escape(KIND_NAMES[kind] ?? kind)}&gt;</div>`;
    for (const cat of kindsCats) {
      const items = itemsByCat[cat.id] ?? [];
      if (items.length === 0) continue;
      counter += 1;
      const ownerSuffix = cat.owner ? ` (${escape(cat.owner)})` : '';
      html += `<div class="project">(${counter}) ${escape(cat.title)}<span class="muted">${ownerSuffix}</span></div>`;
      html += '<ul class="items">';
      for (const it of items) {
        const cls = it.important ? 'important' : '';
        html += `<li class="${cls}">${escape(formatItem(it))}</li>`;
      }
      html += '</ul>';
    }
  }
  return html;
}

// 일반보고 본문: 지난 X 실적 + 이번 X 계획 합본
function renderGeneralBody(orgName, categories, pastByCat, nextByCat, periodWord, pastRange, nextRange) {
  let html = `<div class="org">${escape(orgName)}</div>`;
  // ■ 지난 X 실적
  const pastTitle = pastRange
    ? `■ 지난 ${periodWord} 실적 (${pastRange})`
    : `■ 지난 ${periodWord} 실적`;
  html += `<div class="period-title" style="font-weight:700;margin:6px 0 2px">${escape(pastTitle)}</div>`;
  const pastBody = renderKindGroupedBody(categories, pastByCat);
  html += pastBody || '<div class="muted">(항목 없음)</div>';
  // ■ 이번 X 계획
  const nextTitle = nextRange
    ? `■ 이번 ${periodWord} 계획 (${nextRange})`
    : `■ 이번 ${periodWord} 계획`;
  html += `<div class="period-title" style="font-weight:700;margin:10px 0 2px">${escape(nextTitle)}</div>`;
  const nextBody = renderKindGroupedBody(categories, nextByCat);
  html += nextBody || '<div class="muted">(항목 없음)</div>';
  return html;
}

// Public: round + submissions → HTML 문자열
export function renderPreviewHtml(round, submissions) {
  const orgName = round?.orgName || '[궤도노반연구실]';
  const categories = round?.categoriesSnapshot ?? [];
  const importantByCat = aggregateItems(submissions, { onlyImportant: true });
  const pastByCat = aggregateItems(submissions, { side: 'past' });
  const nextByCat = aggregateItems(submissions, { side: 'next' });
  const periodWord = round?.form === 'monthly' ? '달' : '주';
  const pastRange = formatRange(round?.rangeStart, round?.rangeEnd);
  const nextRange = formatRange(round?.nextRangeStart, round?.nextRangeEnd);
  const baseDateStr = formatDate(round?.baseDate);

  return `
    <div class="preview-doc">
      <div class="preview-page">
        <div class="preview-tail">
          <strong>${escape(orgName)}</strong>
          <span class="muted">${escape(baseDateStr)}</span>
        </div>
        <table class="preview-table">
          <colgroup>
            <col style="width:14%"/><col style="width:72%"/><col style="width:14%"/>
          </colgroup>
          <tbody>
            <tr>
              <td class="label">
                <div class="label-title">주 요</div>
                <div class="label-title">보고사항</div>
              </td>
              <td class="body">${renderMainBody(orgName, categories, importantByCat)}</td>
              <td class="empty"></td>
            </tr>
            <tr>
              <td class="label">
                <div class="label-title">일반 보고사항</div>
                <div class="label-range">지난 ${periodWord} 실적</div>
                <div class="label-range">+ 이번 ${periodWord} 계획</div>
              </td>
              <td class="body">${renderGeneralBody(orgName, categories, pastByCat, nextByCat, periodWord, pastRange, nextRange)}</td>
              <td class="empty"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// 호환 API: HTML 문자열을 DOM Element 로 감싸 반환 (기존 caller가 appendChild 사용).
export function renderPreview(round, submissions) {
  const html = renderPreviewHtml(round, submissions);
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  // 첫 번째 자식(.preview-doc)을 반환
  return wrap.firstElementChild ?? wrap;
}

// 호환을 위해 default export도 제공
export default renderPreviewHtml;
