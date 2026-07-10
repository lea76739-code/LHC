const ZODIAC_MAP = {
  "鼠": [7, 19, 31, 43],
  "牛": [6, 18, 30, 42],
  "虎": [5, 17, 29, 41],
  "兔": [4, 16, 28, 40],
  "龙": [3, 15, 27, 39],
  "蛇": [2, 14, 26, 38],
  "马": [1, 13, 25, 37, 49],
  "羊": [12, 24, 36, 48],
  "猴": [11, 23, 35, 47],
  "鸡": [10, 22, 34, 46],
  "狗": [9, 21, 33, 45],
  "猪": [8, 20, 32, 44],
};

const WAVE_MAP = {
  "红波": [1, 2, 7, 8, 12, 13, 18, 19, 23, 24, 29, 30, 34, 35, 40, 45, 46],
  "蓝波": [3, 4, 9, 10, 14, 15, 20, 25, 26, 31, 36, 37, 41, 42, 47, 48],
  "绿波": [5, 6, 11, 16, 17, 21, 22, 27, 28, 32, 33, 38, 39, 43, 44, 49],
};

const PREFIXES = ["新奥", "新澳门", "新奥彩", "香港"];
const DEFAULT_MIN_PICK = 5;
const DEFAULT_MAX_PICK = 15;
const DEFAULT_GROUP_COUNT = 10;
const DEFAULT_SEPARATORS = "-/.，*。~";
const STORAGE_KEY = "countplus-state-v9";
const MANUAL_GROUPS = [
  { input: "mainAttackNumbers", status: "mainAttackStatus", className: "role-main", label: "主", title: "主攻" },
  { input: "secondAttackNumbers", status: "secondAttackStatus", className: "role-second", label: "次", title: "次攻" },
  { input: "defenseNumbers", status: "defenseStatus", className: "role-defense", label: "防", title: "防守" },
];
const TIER_BASE_BUDGET = 10000;
const STAKE_UNIT = 10;
const STAKE_STYLE_VALUES = [10, 20, 30, 50, 100, 150, 200, 500];
const TIER_RULES = {
  defense: { min: 200, max: 240, title: "第一档" },
  second: { min: 300, max: 350, title: "第二档" },
  main: { min: 400, max: 450, title: "第三档" },
};
const TIER_PRIORITY = ["main", "second", "defense"];

const state = {
  selectedNumbers: new Set(),
  lastPlan: null,
  autoRandomSelection: false,
  usageCount: 0,
  hasGeneratedOutput: false,
  profitVisible: false,
};

const els = {};
let autoPreviewTimer = null;

function twoDigit(num) {
  return String(num).padStart(2, "0");
}

function numberZodiac(num) {
  return Object.keys(ZODIAC_MAP).find((name) => ZODIAC_MAP[name].includes(num)) || "";
}

function numberWave(num) {
  return Object.keys(WAVE_MAP).find((name) => WAVE_MAP[name].includes(num)) || "";
}

function waveClass(wave) {
  if (wave === "红波") return "wave-red";
  if (wave === "蓝波") return "wave-blue";
  return "wave-green";
}

function parseDigits(text, min, max) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const values = trimmed
    .split(/[.\s,，、/|]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number)
    .filter((num) => Number.isInteger(num) && num >= min && num <= max);
  return values.length ? new Set(values) : new Set();
}

function getCheckedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map((input) => input.value);
}

function normalizedDigits(text, min, max) {
  const set = parseDigits(text, min, max);
  if (set === null) return null;
  return [...set].sort((a, b) => a - b).join(".");
}

function parseNumbers(text) {
  const values = text
    .trim()
    .split(/[.\s,，、/|;；-]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(Number)
    .filter((num) => Number.isInteger(num) && num >= 1 && num <= 49);
  return [...new Set(values)].sort((a, b) => a - b);
}

function formatNumbers(numbers) {
  return numbers.map(twoDigit).join(".");
}

function isAttackInput(input) {
  return ["mainAttackNumbers", "secondAttackNumbers"].includes(input.id);
}

function cursorAfterDigitCount(text, digitCount) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (/\d/.test(text[index])) seen += 1;
    if (seen >= digitCount) return index + 1;
  }
  return text.length;
}

function formatAttackInput(input, event = null) {
  const raw = input.value;
  const cursor = input.selectionStart ?? raw.length;
  const digitsBeforeCursor = (raw.slice(0, cursor).match(/\d/g) || []).length;
  const digits = raw.replace(/\D/g, "").slice(0, 98);
  const groups = digits.match(/.{1,2}/g) || [];
  const isTypingForward =
    event?.inputType?.startsWith("insert") &&
    event.inputType !== "insertFromPaste" &&
    /\d$/.test(raw) &&
    cursor === raw.length;
  let formatted = groups.join(".");

  if (isTypingForward && digits.length > 0 && digits.length % 2 === 0) {
    formatted += ".";
  }

  if (input.value !== formatted) {
    input.value = formatted;
    const nextCursor = isTypingForward ? formatted.length : cursorAfterDigitCount(formatted, digitsBeforeCursor);
    input.setSelectionRange(nextCursor, nextCursor);
  }
}

function finalizeAttackInput(input) {
  const digits = input.value.replace(/\D/g, "").slice(0, 98);
  input.value = (digits.match(/.{1,2}/g) || []).join(".");
}

function sameNumberList(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  return left.every((num, index) => num === right[index]);
}

function syncDefenseNumbers() {
  if (!els.defenseNumbers) return;
  const reserved = new Set([
    ...parseNumbers(els.mainAttackNumbers.value),
    ...parseNumbers(els.secondAttackNumbers.value),
  ]);
  const defense = [...state.selectedNumbers]
    .filter((num) => !reserved.has(num))
    .sort((a, b) => a - b);
  els.defenseNumbers.value = formatNumbers(defense);
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sampleUnique(items, count) {
  const pool = [...items];
  const output = [];
  while (pool.length && output.length < count) {
    const index = randInt(0, pool.length - 1);
    output.push(pool.splice(index, 1)[0]);
  }
  return output.sort((a, b) => a - b);
}

function randomItem(items) {
  if (!items.length) return "";
  return items[randInt(0, items.length - 1)];
}

function shuffleNumbers(numbers) {
  const output = numbers.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = randInt(0, index);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function activeSeparators() {
  const text = els.separators.value.trim();
  return text ? Array.from(text) : Array.from(DEFAULT_SEPARATORS);
}

function matchesFilters(num) {
  const headSet = parseDigits(els.headDigits.value, 0, 4);
  const tailSet = parseDigits(els.tailDigits.value, 0, 9);
  const zodiacs = getCheckedValues("zodiac");
  const waves = getCheckedValues("wave");
  const odd = els.oddOnly.checked;
  const even = els.evenOnly.checked;
  const limitParity = odd !== even;

  if (limitParity && odd && num % 2 === 0) return false;
  if (limitParity && even && num % 2 !== 0) return false;
  if (headSet && !headSet.has(Math.floor(num / 10))) return false;
  if (tailSet && !tailSet.has(num % 10)) return false;
  if (zodiacs.length && !zodiacs.includes(numberZodiac(num))) return false;
  if (waves.length && !waves.includes(numberWave(num))) return false;
  return true;
}

function activeCandidates() {
  return [...state.selectedNumbers].sort((a, b) => a - b);
}

function hasActiveSelectionFilter() {
  const head = normalizedDigits(els.headDigits.value, 0, 4);
  const tail = normalizedDigits(els.tailDigits.value, 0, 9);
  return (
    els.oddOnly.checked ||
    els.evenOnly.checked ||
    getCheckedValues("zodiac").length > 0 ||
    getCheckedValues("wave").length > 0 ||
    head !== null ||
    tail !== null
  );
}

function isSelectionFilterControl(input) {
  return (
    ["oddOnly", "evenOnly", "headDigits", "tailDigits"].includes(input.id) ||
    input.name === "zodiac" ||
    input.name === "wave"
  );
}

function applySelectionFilters() {
  state.autoRandomSelection = false;
  if (!hasActiveSelectionFilter()) {
    state.selectedNumbers.clear();
    return;
  }
  state.selectedNumbers = new Set(
    Array.from({ length: 49 }, (_, index) => index + 1).filter((num) => matchesFilters(num))
  );
}

function pickRange(maxAvailable) {
  let minPick = Math.max(1, Number(els.minPickCount.value) || DEFAULT_MIN_PICK);
  let maxPick = Math.max(1, Number(els.pickCount.value) || DEFAULT_MAX_PICK);
  if (minPick > maxPick) [minPick, maxPick] = [maxPick, minPick];
  minPick = Math.min(minPick, maxAvailable);
  maxPick = Math.min(maxPick, maxAvailable);
  return { minPick, maxPick };
}

function divisorsInRange(total, minPick, maxPick) {
  const divisors = [];
  for (let n = minPick; n <= maxPick; n += 1) {
    if (total % n === 0) divisors.push(n);
  }
  return divisors;
}

function roundedStake(value) {
  if (value <= 10) return Math.max(1, Math.round(value));
  return Math.max(5, Math.round(value / 5) * 5);
}

function referenceStake(total, groups) {
  const slots = groups.reduce((sum, group) => sum + group.numbers.length, 0);
  if (!slots) return 1;
  const average = total / slots;
  if (average < 10) return Math.max(1, Math.round(average));
  return Math.max(10, Math.round(average / 10) * 10);
}

function originalStakeLadder(reference, target, groups) {
  const maxStake = Math.max(reference * 2, reference + 200, 10);
  const values = new Set();

  if (reference < 10) {
    for (let value = 1; value <= maxStake; value += 1) values.add(value);
  } else {
    for (let value = 10; value <= maxStake; value += 10) values.add(value);
    for (let value = 15; value <= Math.max(reference, 15); value += 10) values.add(value);
  }

  return [...values].sort((a, b) => a - b);
}

function chooseOriginalStake(feasible, reference, index) {
  if (!feasible.length) return null;
  if (reference < 10) return randomItem(feasible);

  const low = feasible.filter((value) => value <= reference);
  const high = feasible.filter((value) => value >= reference);
  const near = feasible.filter((value) => Math.abs(value - reference) <= Math.max(20, reference * 0.35));

  if (index % 3 === 0 && low.length) return randomItem(low);
  if (index % 3 === 1 && high.length) return randomItem(high);
  if (near.length) return randomItem(near);
  return randomItem(feasible);
}

function canFinishWithLadder(groups, startIndex, remain, ladder, minStake, maxStake) {
  const futureSizes = groups.slice(startIndex).map((group) => group.numbers.length);
  const minTotal = futureSizes.reduce((sum, size) => sum + size * minStake, 0);
  const maxTotal = futureSizes.reduce((sum, size) => sum + size * maxStake, 0);
  return remain >= minTotal && remain <= maxTotal;
}

function lineText(numbers, each, prefix, cumulative = null) {
  const separator = randomItem(activeSeparators());
  const numberText = shuffleNumbers(numbers).map(twoDigit).join(separator);
  const total = numbers.length * each;
  const tag = prefix ? `${prefix} ` : "";
  const tail = cumulative === null ? "" : `****   ${cumulative}`;
  return `${tag}${numberText} 各${each}  总${total}${tail}`;
}

function compactLineText(line, prefix = "", suffix = "") {
  const separator = randomItem(activeSeparators());
  const numberText = shuffleNumbers(line.numbers).map(twoDigit).join(separator);
  const tag = prefix ? `${prefix} ` : "";
  return `${tag}${numberText} 各${moneyText(line.each)}${suffix}`;
}

function shuffledItems(items) {
  const output = items.slice();
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = randInt(0, index);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function orderLinesByDifferentAmounts(lines) {
  const pool = shuffledItems(lines);
  const output = [];
  let previousEach = null;

  while (pool.length) {
    const choices = pool.filter((line) => line.each !== previousEach);
    const chosen = randomItem(choices.length ? choices : pool);
    const index = pool.indexOf(chosen);
    output.push(chosen);
    previousEach = chosen.each;
    pool.splice(index, 1);
  }

  return output;
}

function groupedLinesText(lines) {
  const output = [];
  const orderedLines = orderLinesByDifferentAmounts(lines);
  orderedLines.forEach((line) => {
    const lineTotal = line.numbers.length * line.each;
    output.push(compactLineText(line, line.prefix || "", `  总${moneyText(lineTotal)}`));
  });

  return output.join("\n");
}

function emptyAllocations(candidates) {
  return Object.fromEntries(candidates.map((num) => [num, 0]));
}

function applyAllocation(allocations, numbers, each) {
  numbers.forEach((num) => {
    allocations[num] += each;
  });
}

function makeGroups(count, candidates, minPick, maxPick) {
  return Array.from({ length: count }, () => {
    const size = randInt(minPick, maxPick);
    return {
      numbers: sampleUnique(candidates, size),
      each: 0,
    };
  });
}

function assignFixedEach(groups) {
  const fixedEach = 1;
  groups.forEach((group) => {
    group.each = fixedEach;
  });
  return true;
}

function assignBudgetEach(groups, target, range) {
  const reference = referenceStake(target, groups);
  const ladder = originalStakeLadder(reference, target, groups);
  const minStake = reference >= 10 ? 10 : 1;
  const maxStake = ladder[ladder.length - 1] || Math.max(reference, 1);
  let remain = target;
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const size = group.numbers.length;
    const groupsLeft = groups.length - index;

    if (groupsLeft === 1) {
      if (remain <= 0 || remain % size !== 0) return false;
      group.each = remain / size;
      remain = 0;
      return true;
    }

    const feasible = ladder.filter((each) => {
      const nextRemain = remain - each * size;
      return each > 0 && nextRemain > 0 && canFinishWithLadder(groups, index + 1, nextRemain, ladder, minStake, maxStake);
    });
    const each = chooseOriginalStake(feasible, reference, index);
    if (!each) return false;

    group.each = each;
    remain -= each * size;
  }
  return remain === 0;
}

function computeAllocations(groups, candidates) {
  const allocations = emptyAllocations(candidates);
  groups.forEach((group) => applyAllocation(allocations, group.numbers, group.each));
  return allocations;
}

function amountLimits(total, count, range) {
  if (!total || !count) return null;
  let base = Math.floor(total / count);
  if (String(base).length > 1) {
    base = Math.trunc(base / 10) * 10;
  }
  return {
    base,
    min: Math.max(0, base - range),
    max: base + range,
  };
}

function tryMoveNumber(groups, allocations, high, low, limits) {
  for (const group of groups) {
    if (!group.numbers.includes(high) || group.numbers.includes(low)) continue;
    const before =
      Math.abs(allocations[high] - limits.max) +
      Math.abs(allocations[low] - limits.min);
    const nextHigh = allocations[high] - group.each;
    const nextLow = allocations[low] + group.each;
    const after =
      Math.abs(nextHigh - limits.max) +
      Math.abs(nextLow - limits.min);
    if (after > before && nextHigh > limits.max && nextLow < limits.min) continue;

    group.numbers = group.numbers.map((num) => (num === high ? low : num)).sort((a, b) => a - b);
    allocations[high] = nextHigh;
    allocations[low] = nextLow;
    return true;
  }
  return false;
}

function balanceAllocations(groups, candidates, allocations, limits) {
  if (!limits || limits.max <= 0) return;
  for (let loop = 0; loop < 800; loop += 1) {
    const highs = candidates
      .filter((num) => allocations[num] > limits.max)
      .sort((a, b) => allocations[b] - allocations[a]);
    const lows = candidates
      .filter((num) => allocations[num] < limits.min)
      .sort((a, b) => allocations[a] - allocations[b]);

    if (!highs.length || !lows.length) break;

    let moved = false;
    for (const high of highs) {
      for (const low of lows) {
        if (tryMoveNumber(groups, allocations, high, low, limits)) {
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
    if (!moved) break;
  }
}

function finalizePlan(groups, candidates, prefixes, limits = null) {
  let cumulative = 0;
  const lines = groups.map((group) => {
    const prefix = randomItem(prefixes);
    const total = group.numbers.length * group.each;
    cumulative += total;
    return {
      numbers: group.numbers.slice(),
      each: group.each,
      total,
      cumulative,
      prefix,
      text: lineText(group.numbers, group.each, prefix, cumulative),
    };
  });
  const allocations = computeAllocations(groups, candidates);
  return { lines, allocations, candidates, total: cumulative, limits };
}

function planLimitMiss(plan) {
  if (!plan || !plan.limits) return 0;
  return plan.candidates.reduce((miss, num) => {
    const amount = plan.allocations[num] || 0;
    if (amount < plan.limits.min) return Math.max(miss, plan.limits.min - amount);
    if (amount > plan.limits.max) return Math.max(miss, amount - plan.limits.max);
    return miss;
  }, 0);
}

function tryMakeBudgetPlan(count, candidates, prefixes, minPick, maxPick, target, range) {
  const groups = makeGroups(count, candidates, minPick, maxPick);
  if (!assignBudgetEach(groups, target, range)) return null;

  const limits = amountLimits(target, candidates.length, range);
  const allocations = computeAllocations(groups, candidates);
  balanceAllocations(groups, candidates, allocations, limits);
  return finalizePlan(groups, candidates, prefixes, limits);
}

function makePlanWithoutBudget(count, candidates, prefixes, minPick, maxPick) {
  const groups = makeGroups(count, candidates, minPick, maxPick);
  assignFixedEach(groups);
  return finalizePlan(groups, candidates, prefixes);
}

function generatePlan(count) {
  const candidates = ensureGenerationCandidates();
  const { minPick, maxPick } = pickRange(candidates.length);
  const prefixes = getCheckedValues("prefix");

  if (!candidates.length) {
    setNotice("当前条件没有可用号码");
    return null;
  }

  if (candidates.length < Number(els.pickCount.value || 1)) {
    setNotice(`可用号码只有 ${candidates.length} 个，已自动降低最多位数`);
  } else {
    setNotice("");
  }

  const target = Math.max(0, Number(els.budgetAmount.value) || 0);
  const range = Math.max(0, Number(els.budgetRange.value) || 0);
  if (!target) return makePlanWithoutBudget(count, candidates, prefixes, minPick, maxPick);

  let bestPlan = null;
  let bestMiss = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const plan = tryMakeBudgetPlan(count, candidates, prefixes, minPick, maxPick, target, range);
    if (!plan) continue;
    const miss = planLimitMiss(plan);
    if (miss < bestMiss) {
      bestPlan = plan;
      bestMiss = miss;
    }
    if (miss === 0) return plan;
  }

  if (bestPlan) {
    setNotice(bestMiss > 0 ? `已生成，部分号码偏离预算区间 ${bestMiss}` : "");
    return bestPlan;
  }

  setNotice("当前预算不容易按位数整除，已放宽位数重试");
  for (let attempt = 0; attempt < 300; attempt += 1) {
    const plan = tryMakeBudgetPlan(count, candidates, prefixes, 1, maxPick, target, range);
    if (plan) return plan;
  }
  return null;
}

function renderManualProfitPanel(plan, force = false) {
  if (!els.manualProfitPanel) return;

  if (!state.selectedNumbers.size) {
    els.manualProfitPanel.innerHTML = `<span class="profit-empty">选择号码后显示中奖利润</span>`;
    return;
  }

  if (!force) {
    els.manualProfitPanel.innerHTML = state.hasGeneratedOutput
      ? `<span class="profit-empty">点击“计算利润”查看每个号码中奖利润</span>`
      : `<span class="profit-empty">生成结果后可计算中奖利润</span>`;
    return;
  }

  if (!plan || !plan.candidates?.length) {
    els.manualProfitPanel.innerHTML = `<span class="profit-empty">生成分配后显示每个号码中奖利润</span>`;
    return;
  }

  const total = actualPlanTotal(plan);
  const odds = currentOdds();
  const candidateSet = new Set(plan.candidates);

  els.manualProfitPanel.innerHTML = MANUAL_GROUPS.map((group) => {
    const numbers = parseNumbers(els[group.input].value).filter((num) => candidateSet.has(num));
    const chips = numbers
      .map((num) => {
        const amount = plan.allocations[num] || 0;
        const profit = amount * odds - total;
        const sign = profit >= 0 ? "+" : "";
        const className = profit >= 0 ? "profit-chip" : "profit-chip loss";
        return `<span class="${className}"><b>${twoDigit(num)}</b>${sign}${moneyText(profit)}</span>`;
      })
      .join("");

    return `
      <div class="manual-profit-section">
        <strong>${group.title}</strong>
        <div class="profit-chips">${chips || `<span class="profit-empty">暂无号码</span>`}</div>
      </div>
    `;
  }).join("");
}

function updateStats(plan = null) {
  syncDefenseNumbers();
  const candidates = activeCandidates();
  const candidateSet = new Set(candidates);
  const planCandidateSet = new Set(plan ? plan.candidates : []);
  const manualMarks = new Map();
  els.selectedCount.textContent = `选中 ${state.selectedNumbers.size} 个｜分配 ${candidates.length} 个`;
  els.candidateText.textContent = `可用号码 ${candidates.length} 个`;

  MANUAL_GROUPS.forEach((group) => {
    const values = parseNumbers(els[group.input].value);
    const found = values.filter((num) => state.selectedNumbers.has(num));
    const missing = values.filter((num) => !state.selectedNumbers.has(num));
    found.forEach((num) => {
      if (!manualMarks.has(num)) manualMarks.set(num, group);
    });
    const status = els[group.status];
    if (!values.length) {
      status.textContent = "";
      status.classList.remove("warn");
    } else {
      status.textContent = missing.length
        ? `找到${found.length} 未选${missing.map(twoDigit).join(".")}`
        : `找到${found.length}`;
      status.classList.toggle("warn", missing.length > 0);
    }
  });

  document.querySelectorAll(".num-btn").forEach((btn) => {
    const num = Number(btn.dataset.num);
    const money = btn.querySelector(".num-money");
    const showAmount = Boolean(plan && planCandidateSet.has(num));
    const mark = manualMarks.get(num);
    btn.classList.toggle("selected", state.selectedNumbers.has(num));
    btn.classList.toggle("candidate", candidateSet.has(num));
    btn.classList.toggle("with-amount", showAmount);
    btn.classList.toggle("role-main", mark?.className === "role-main");
    btn.classList.toggle("role-second", mark?.className === "role-second");
    btn.classList.toggle("role-defense", mark?.className === "role-defense");
    btn.dataset.role = mark ? mark.label : "";
    btn.classList.toggle("blocked", state.selectedNumbers.has(num) && !candidateSet.has(num));
    if (money) money.textContent = showAmount ? String(plan.allocations[num] || 0) : "";
  });

  if (plan) {
    const amounts = plan.candidates.map((num) => plan.allocations[num] || 0);
    const sum = actualPlanTotal(plan);
    const max = amounts.length ? Math.max(...amounts) : 0;
    const min = amounts.length ? Math.min(...amounts) : 0;
    els.totalText.textContent = `总分配: ${sum}`;
    els.rangeText.textContent = `区间最大: ${max} ｜ 区间最小: ${min}`;
  } else {
    els.totalText.textContent = "总分配: 0";
    els.rangeText.textContent = "区间最大: 0 ｜ 区间最小: 0";
  }
  renderManualProfitPanel(plan, state.profitVisible);
  renderAllocationPanel(plan);
}

function setNotice(text) {
  els.noticeText.textContent = text;
}

function updateUsageCountText() {
  if (!els.usageCountText) return;
  els.usageCountText.textContent = `累计使用次数：${state.usageCount}次`;
}

function incrementUsageCount() {
  state.usageCount += 1;
  updateUsageCountText();
  saveState();
}

function updateProfitButton() {
  if (!els.profitBtn) return;
  els.profitBtn.hidden = !state.hasGeneratedOutput;
  els.profitBtn.disabled = !state.hasGeneratedOutput || !state.lastPlan;
}

function resetProfitState() {
  state.profitVisible = false;
  state.hasGeneratedOutput = false;
  updateProfitButton();
}

function currentGroupCount() {
  return Math.max(1, Number(els.groupCount.value) || DEFAULT_GROUP_COUNT);
}

function hasBudgetAmount() {
  return Math.max(0, Number(els.budgetAmount.value) || 0) > 0;
}

function requireBudgetAmount() {
  if (hasBudgetAmount()) return true;
  state.lastPlan = null;
  resetProfitState();
  els.resultOutput.value = "";
  setNotice("预算不可空，请先输入你的预算");
  updateStats();
  els.budgetAmount.focus();
  return false;
}

function currentBudget() {
  return Math.max(0, Math.round(Number(els.budgetAmount.value) || 0));
}

function currentOdds() {
  return Math.max(1, Number(els.oddsAmount.value) || 47);
}

function moneyText(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

function numberKey(numbers) {
  return numbers
    .slice()
    .sort((a, b) => a - b)
    .join(".");
}

function currentPlanSignature(candidates = activeCandidates()) {
  const { minPick, maxPick } = pickRange(Math.max(1, candidates.length || 49));
  return [
    numberKey(candidates),
    currentGroupCount(),
    currentBudget(),
    currentOdds(),
    minPick,
    maxPick,
    Math.max(0, Number(els.budgetRange.value) || 0),
    getCheckedValues("prefix").join("|"),
  ].join("::");
}

function actualPlanTotal(plan) {
  if (!plan) return 0;
  if (Array.isArray(plan.lines) && plan.lines.length) return planTotalFromLines(plan.lines);
  if (Number.isFinite(plan.total)) return plan.total;
  return plan.candidates.reduce((sum, num) => sum + (plan.allocations[num] || 0), 0);
}

function canReuseCurrentPlan(plan) {
  if (!plan || plan.type !== "optimized") return false;
  if (state.autoRandomSelection && !hasActiveSelectionFilter()) return false;
  return plan.signature === currentPlanSignature();
}

function randomDefaultCandidates() {
  const { minPick, maxPick } = pickRange(49);
  return sampleUnique(Array.from({ length: 49 }, (_, index) => index + 1), randInt(minPick, maxPick));
}

function ensureGenerationCandidates() {
  let candidates = activeCandidates();
  const shouldRandomize = !hasActiveSelectionFilter() && (!candidates.length || state.autoRandomSelection);
  if (!shouldRandomize) return candidates;
  candidates = randomDefaultCandidates();
  state.selectedNumbers = new Set(candidates);
  state.autoRandomSelection = true;
  syncDefenseNumbers();
  updateStats();
  setNotice(`未选择条件，已随机生成 ${candidates.length} 个号码`);
  return candidates;
}

function selectedManualNumbers(inputId, candidates, excluded = new Set()) {
  const candidateSet = new Set(candidates);
  return parseNumbers(els[inputId].value)
    .filter((num) => candidateSet.has(num) && !excluded.has(num));
}

function distributeBudget(numbers, budget) {
  const output = Object.fromEntries(numbers.map((num) => [num, 0]));
  if (!numbers.length || budget <= 0) return output;
  const base = Math.floor(budget / numbers.length);
  let remain = budget - base * numbers.length;
  numbers.forEach((num) => {
    output[num] = base + (remain > 0 ? 1 : 0);
    remain -= 1;
  });
  return output;
}

function netRangeFor(numbers, allocations, total, odds) {
  if (!numbers.length) return { min: -total, max: -total };
  const nets = numbers.map((num) => (allocations[num] || 0) * odds - total);
  return {
    min: Math.min(...nets),
    max: Math.max(...nets),
  };
}

function netText(range) {
  const min = moneyText(range.min);
  const max = moneyText(range.max);
  return min === max ? min : `${min}~${max}`;
}

function tierStakeText(numbers, allocations) {
  if (!numbers.length) return "0";
  const stakes = [...new Set(numbers.map((num) => allocations[num] || 0))].sort((a, b) => a - b);
  return stakes.length === 1 ? String(stakes[0]) : `${stakes[0]}~${stakes[stakes.length - 1]}`;
}

function roundedByReference(value, reference) {
  if (reference >= 10) return Math.max(10, Math.round(value / 10) * 10);
  if (reference >= 5) return Math.max(1, Math.round(value / 5) * 5);
  return Math.max(1, Math.round(value));
}

function roundedStakeUnit(value) {
  return Math.max(STAKE_UNIT, Math.round(value / STAKE_UNIT) * STAKE_UNIT);
}

function stakeLadder(maxValue) {
  const ladder = new Set(STAKE_STYLE_VALUES);
  const max = Math.max(500, Math.ceil(maxValue / 500) * 500);
  for (let value = 1000; value <= max; value += 500) {
    ladder.add(value);
  }
  return [...ladder].sort((a, b) => a - b);
}

function nextStakeValue(value) {
  return value + STAKE_UNIT;
}

function previousStakeValue(value) {
  const previous = value - STAKE_UNIT;
  return previous >= STAKE_UNIT ? previous : null;
}

function scaledTierRange(key, total) {
  const rule = TIER_RULES[key];
  const scale = total > 0 ? total / TIER_BASE_BUDGET : 1;
  const min = roundedByReference(rule.min * scale, rule.min * scale);
  const max = roundedByReference(rule.max * scale, rule.max * scale);
  return {
    min: Math.max(1, Math.min(min, max)),
    max: Math.max(1, Math.max(min, max)),
    title: rule.title,
  };
}

function randomStakeInRange(range, remain) {
  const high = Math.min(range.max, remain);
  if (high < range.min) return 0;
  const step = range.min >= 10 ? 10 : 1;
  const minStep = Math.ceil(range.min / step);
  const maxStep = Math.floor(high / step);
  return randInt(minStep, maxStep) * step;
}

function makeTierAllocations(activeTiers, total, candidates) {
  const allocations = emptyAllocations(candidates);
  const budgets = { defense: 0, second: 0, main: 0 };
  const ranges = {};
  const prioritizedTiers = TIER_PRIORITY.map((key) => activeTiers.find((tier) => tier.key === key)).filter(Boolean);

  activeTiers.forEach((tier) => {
    ranges[tier.key] = scaledTierRange(tier.key, total);
  });

  const minTotal = activeTiers.reduce((sum, tier) => sum + ranges[tier.key].min * tier.numbers.length, 0);
  const maxTotal = total;
  let remain = total;
  let roundCount = 0;
  let tailRemainder = 0;

  while (remain > 0 && roundCount < 500) {
    let progressed = false;
    roundCount += 1;

    prioritizedTiers.forEach((tier) => {
      const range = ranges[tier.key];
      const order = sampleUnique(tier.numbers, tier.numbers.length);

      order.forEach((num) => {
        const amount = randomStakeInRange(range, remain);
        if (!amount) return;
        allocations[num] += amount;
        budgets[tier.key] += amount;
        remain -= amount;
        progressed = true;
      });
    });

    if (!progressed) {
      const tailTier = prioritizedTiers.find((tier) => tier.numbers.length);
      if (tailTier) {
        const num = randomItem(tailTier.numbers);
        allocations[num] += remain;
        budgets[tailTier.key] += remain;
        tailRemainder = remain;
        remain = 0;
      }
      break;
    }
  }

  return {
    allocations,
    budgets,
    ranges,
    unallocated: Math.max(0, remain),
    roundCount,
    tailRemainder,
    minTotal,
    maxTotal,
  };
}

function applyLineAllocations(lines, candidates) {
  const allocations = emptyAllocations(candidates);
  lines.forEach((line) => {
    applyAllocation(allocations, line.numbers, line.each);
  });
  return allocations;
}

function refreshLineTotals(lines, prefixes) {
  let cumulative = 0;
  lines.forEach((line) => {
    const prefix = line.prefix ?? randomItem(prefixes);
    line.numbers = line.numbers.slice().sort((a, b) => a - b);
    line.total = line.numbers.length * line.each;
    cumulative += line.total;
    line.cumulative = cumulative;
    line.prefix = prefix;
    line.text = lineText(line.numbers, line.each, prefix, cumulative);
  });
  return lines;
}

function splitTierLine(line) {
  if (line.numbers.length > 1) {
    const midpoint = Math.ceil(line.numbers.length / 2);
    return [
      { ...line, numbers: line.numbers.slice(0, midpoint) },
      { ...line, numbers: line.numbers.slice(midpoint) },
    ];
  }

  if (line.each > 1) {
    const firstEach = roundedByReference(line.each / 2, line.each);
    const safeFirst = Math.max(1, Math.min(line.each - 1, firstEach));
    return [
      { ...line, each: safeFirst },
      { ...line, each: line.each - safeFirst },
    ];
  }

  return [line];
}

function mergeTierLines(left, right) {
  const total = left.numbers.length * left.each + right.numbers.length * right.each;
  const numbers = [...new Set([...left.numbers, ...right.numbers])].sort((a, b) => a - b);
  const each = Math.max(1, roundedByReference(total / numbers.length, total / numbers.length));
  return {
    tier: left.tier || right.tier,
    numbers,
    each,
  };
}

function tierLineTotal(line) {
  return line.numbers.length * line.each;
}

function normalizeTierLineCount(lines, desiredCount, prefixes) {
  if (!desiredCount || desiredCount <= 0) return refreshLineTotals(lines, prefixes);
  const output = lines.map((line) => ({ ...line, numbers: line.numbers.slice() }));

  while (output.length < desiredCount) {
    const index = output
      .map((line, lineIndex) => ({ line, lineIndex }))
      .filter(({ line }) => line.numbers.length > 1 || line.each > 1)
      .sort((a, b) => tierLineTotal(b.line) - tierLineTotal(a.line))[0]?.lineIndex;
    if (index === undefined) break;
    const replacement = splitTierLine(output[index]);
    if (replacement.length < 2) break;
    output.splice(index, 1, ...replacement);
  }

  while (output.length > desiredCount) {
    let bestIndex = 0;
    let bestScore = Number.POSITIVE_INFINITY;
    for (let index = 0; index < output.length - 1; index += 1) {
      const score = tierLineTotal(output[index]) + tierLineTotal(output[index + 1]);
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    output.splice(bestIndex, 2, mergeTierLines(output[bestIndex], output[bestIndex + 1]));
  }

  return refreshLineTotals(output, prefixes);
}

function tierLinesFromAllocations(tiers, allocations, prefixes, desiredCount) {
  const lines = [];

  tiers.forEach((tier) => {
    const remaining = Object.fromEntries(
      tier.numbers.map((num) => [num, Math.max(0, allocations[num] || 0)])
    );
    let guard = 0;

    while (Object.values(remaining).some((amount) => amount > 0) && guard < 200) {
      guard += 1;
      const available = tier.numbers.filter((num) => remaining[num] > 0);
      const amounts = available.map((num) => remaining[num]).sort((a, b) => a - b);
      const median = amounts[Math.floor(amounts.length / 2)] || 1;
      const maxRemaining = amounts[amounts.length - 1] || 1;
      const reference = Math.max(1, median * (available.length > 1 ? 0.55 : 1));
      const each = Math.min(maxRemaining, roundedByReference(reference, median));
      const eligible = available.filter((num) => remaining[num] >= each);
      const { minPick, maxPick } = pickRange(eligible.length || 1);
      const size = Math.min(eligible.length, randInt(minPick, maxPick));
      const selected = sampleUnique(eligible, Math.max(1, size));

      selected.forEach((num) => {
        remaining[num] -= each;
      });

      const sortedNumbers = selected.slice().sort((a, b) => a - b);
      lines.push({
        tier: tier.key,
        numbers: sortedNumbers,
        each,
      });
    }

    const leftovers = new Map();
    tier.numbers.forEach((num) => {
      const amount = remaining[num] || 0;
      if (!amount) return;
      if (!leftovers.has(amount)) leftovers.set(amount, []);
      leftovers.get(amount).push(num);
    });

    [...leftovers.entries()]
      .sort(([amountA], [amountB]) => amountB - amountA)
      .forEach(([each, numbers]) => {
        const sortedNumbers = numbers.slice().sort((a, b) => a - b);
        lines.push({
          tier: tier.key,
          numbers: sortedNumbers,
          each,
        });
      });
  });

  return normalizeTierLineCount(lines, desiredCount, prefixes);
}

function tierBudgetFromAllocations(tier, allocations) {
  return tier.numbers.reduce((sum, num) => sum + (allocations[num] || 0), 0);
}

// 旧版固定区间三档逻辑保留在这里，当前“多导出”不再调用它。
function makeTierPlan(candidates, prefixes) {
  const total = currentBudget();
  if (!total || !candidates.length) return null;

  const odds = currentOdds();
  const main = selectedManualNumbers("mainAttackNumbers", candidates);
  const mainSet = new Set(main);
  const second = selectedManualNumbers("secondAttackNumbers", candidates, mainSet);
  const reserved = new Set([...main, ...second]);
  const defense = candidates.filter((num) => !reserved.has(num));
  const tiers = [
    { key: "defense", name: "防守", numbers: defense },
    { key: "second", name: "次攻", numbers: second },
    { key: "main", name: "主攻", numbers: main },
  ];

  const activeTiers = tiers.filter((tier) => tier.numbers.length > 0);
  if (!activeTiers.length) return null;

  const tierBudgetPlan = makeTierAllocations(activeTiers, total, candidates);
  const { allocations, ranges } = tierBudgetPlan;
  tiers.forEach((tier) => {
    const range = ranges[tier.key] || scaledTierRange(tier.key, total);
    tier.range = range;
    tier.title = `${range.title} 每轮${range.min}-${range.max}`;
  });
  const prioritizedTiers = TIER_PRIORITY.map((key) => activeTiers.find((tier) => tier.key === key)).filter(Boolean);

  const lines = tierLinesFromAllocations(prioritizedTiers, allocations, prefixes, currentGroupCount());
  const lineAllocations = applyLineAllocations(lines, candidates);
  const allocatedTotal = candidates.reduce((sum, num) => sum + (lineAllocations[num] || 0), 0);
  const summaries = tiers.map((tier) => {
    const netRange = netRangeFor(tier.numbers, lineAllocations, allocatedTotal, odds);
    return {
      ...tier,
      budget: tierBudgetFromAllocations(tier, lineAllocations),
      perNumber: tierStakeText(tier.numbers, lineAllocations),
      netRange,
    };
  });

  return {
    type: "tier",
    lines,
    allocations: lineAllocations,
    candidates,
    total: allocatedTotal,
    targetTotal: total,
    unallocated: Math.max(0, total - allocatedTotal),
    overAllocated: Math.max(0, allocatedTotal - total),
    roundCount: tierBudgetPlan.roundCount,
    tailRemainder: tierBudgetPlan.tailRemainder,
    minTotal: tierBudgetPlan.minTotal,
    maxTotal: tierBudgetPlan.maxTotal,
    limits: null,
    odds,
    tiers: summaries,
    prefix: randomItem(prefixes),
  };
}

function planTotalFromLines(lines) {
  return lines.reduce((sum, line) => sum + line.numbers.length * line.each, 0);
}

function optimizationTolerance(total) {
  return Math.max(1, Math.round(total * 0.0005));
}

function classifyOptimizedTiers(candidates, originalAllocations) {
  const sorted = candidates
    .slice()
    .sort((left, right) => (originalAllocations[right] || 0) - (originalAllocations[left] || 0) || left - right);
  const count = sorted.length;
  const mainCount = count <= 1 ? count : Math.max(1, Math.round(count * 0.2));
  const secondCount = count <= 2 ? Math.max(0, count - mainCount) : Math.max(1, Math.round(count * 0.3));
  const main = sorted.slice(0, mainCount);
  const second = sorted.slice(mainCount, Math.min(count, mainCount + secondCount));
  const defense = sorted.slice(mainCount + second.length);
  const tierByNumber = new Map();

  main.forEach((num) => tierByNumber.set(num, "main"));
  second.forEach((num) => tierByNumber.set(num, "second"));
  defense.forEach((num) => tierByNumber.set(num, "defense"));

  return [
    { key: "main", name: "A档 主攻", title: "原始金额最高约20%", numbers: main },
    { key: "second", name: "B档 次攻", title: "原始金额中间约30%", numbers: second },
    { key: "defense", name: "C档 防守", title: "原始金额较低约50%", numbers: defense },
  ].map((tier) => ({ ...tier, tierByNumber }));
}

function tierWeight(key) {
  if (key === "main") return 7;
  if (key === "second") return 3;
  return 1;
}

function distributeIntegerRemainder(targets, numbers, amount, weightForNumber) {
  if (amount <= 0 || !numbers.length) return;
  const weights = numbers.map((num) => Math.max(0.01, weightForNumber(num)));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let assigned = 0;
  const shares = numbers.map((num, index) => {
    const raw = (amount * weights[index]) / weightTotal;
    const whole = Math.floor(raw);
    targets[num] += whole;
    assigned += whole;
    return { num, rest: raw - whole };
  });

  shares
    .sort((left, right) => right.rest - left.rest || left.num - right.num)
    .slice(0, amount - assigned)
    .forEach(({ num }) => {
      targets[num] += 1;
    });
}

function makeOptimizedTargets(candidates, tiers, originalAllocations, total, odds) {
  const breakEven = total / odds;
  const safeMinimum = Math.floor(breakEven) + 1;
  const targets = Object.fromEntries(candidates.map((num) => [num, 0]));
  const tierByNumber = new Map();
  tiers.forEach((tier) => tier.numbers.forEach((num) => tierByNumber.set(num, tier.key)));

  const cAmount = Math.max(safeMinimum, Math.round(breakEven * 1.18));
  const bAmount = Math.max(cAmount + 1, Math.round(cAmount * 1.45));
  const aAmount = Math.max(bAmount + 1, Math.round(cAmount * 1.9));
  const tierBase = { main: aAmount, second: bAmount, defense: cAmount };
  const baseTotal = candidates.reduce((sum, num) => sum + tierBase[tierByNumber.get(num)], 0);
  const noLossFloorTotal = safeMinimum * candidates.length;
  const impossibleNoLoss = noLossFloorTotal > total;
  let relaxedRatio = false;

  if (impossibleNoLoss) {
    const base = Math.max(1, Math.floor(total / candidates.length));
    candidates.forEach((num) => {
      targets[num] = base;
    });
    distributeIntegerRemainder(targets, candidates, total - base * candidates.length, (num) => tierWeight(tierByNumber.get(num)));
  } else if (baseTotal > total) {
    relaxedRatio = true;
    candidates.forEach((num) => {
      targets[num] = safeMinimum;
    });
    distributeIntegerRemainder(
      targets,
      candidates,
      total - noLossFloorTotal,
      (num) => tierWeight(tierByNumber.get(num)) * Math.max(1, originalAllocations[num] || 1)
    );
  } else {
    candidates.forEach((num) => {
      targets[num] = tierBase[tierByNumber.get(num)];
    });
    distributeIntegerRemainder(
      targets,
      candidates,
      total - baseTotal,
      (num) => tierWeight(tierByNumber.get(num)) * Math.max(1, originalAllocations[num] || 1)
    );
  }

  return {
    targets,
    breakEven,
    safeMinimum,
    tierBase,
    relaxedRatio,
    impossibleNoLoss,
  };
}

function lineTierScore(line, tierByNumber) {
  if (!line.numbers.length) return 0;
  return line.numbers.reduce((sum, num) => sum + tierWeight(tierByNumber.get(num)), 0) / line.numbers.length;
}

function seedOptimizedLines(baseLines, targets) {
  const occurrences = {};
  baseLines.forEach((line) => {
    line.numbers.forEach((num) => {
      occurrences[num] = (occurrences[num] || 0) + 1;
    });
  });

  return baseLines.map((line) => {
    const desiredEach =
      line.numbers.reduce((sum, num) => sum + (targets[num] || 0) / Math.max(1, occurrences[num] || 1), 0) /
      Math.max(1, line.numbers.length);
    return {
      ...line,
      numbers: line.numbers.slice(),
      each: roundedStakeUnit(desiredEach),
    };
  });
}

function lineCanDecrease(line, allocations, minimum, nextEach = previousStakeValue(line.each)) {
  if (!nextEach || nextEach >= line.each) return false;
  const delta = line.each - nextEach;
  return line.numbers.every((num) => (allocations[num] || 0) - delta >= minimum);
}

function adjustOptimizedTotalByPairs(lines, candidates, total, tierByNumber, minimum) {
  const tolerance = optimizationTolerance(total);
  let guard = 0;

  while (Math.abs(planTotalFromLines(lines) - total) > tolerance && guard < 5000) {
    guard += 1;
    const currentTotal = planTotalFromLines(lines);
    const currentMiss = Math.abs(currentTotal - total);
    const allocations = applyLineAllocations(lines, candidates);
    let best = null;

    lines.forEach((increaseLine) => {
      lines.forEach((decreaseLine) => {
        if (increaseLine === decreaseLine) return;
        const nextIncrease = nextStakeValue(increaseLine.each);
        const nextDecrease = previousStakeValue(decreaseLine.each);
        if (!lineCanDecrease(decreaseLine, allocations, minimum, nextDecrease)) return;
        const delta =
          increaseLine.numbers.length * (nextIncrease - increaseLine.each) -
          decreaseLine.numbers.length * (decreaseLine.each - nextDecrease);
        if (!delta) return;
        const nextTotal = currentTotal + delta;
        const nextMiss = Math.abs(nextTotal - total);
        if (nextMiss >= currentMiss) return;
        const score = nextMiss * 1000 - lineTierScore(increaseLine, tierByNumber) + lineTierScore(decreaseLine, tierByNumber);
        if (!best || score < best.score) {
          best = { increaseLine, decreaseLine, score };
        }
      });
    });

    if (!best) break;
    best.increaseLine.each = nextStakeValue(best.increaseLine.each);
    best.decreaseLine.each = previousStakeValue(best.decreaseLine.each);
  }
}

function adjustOptimizedTotal(lines, candidates, total, tierByNumber, minimum) {
  const tolerance = optimizationTolerance(total);
  let guard = 0;

  while (Math.abs(planTotalFromLines(lines) - total) > tolerance && guard < 60000) {
    guard += 1;
    const currentTotal = planTotalFromLines(lines);
    if (currentTotal < total) {
      const lineChoices = lines
        .map((line, index) => {
          const nextEach = nextStakeValue(line.each);
          const nextTotal = currentTotal + line.numbers.length * (nextEach - line.each);
          return {
            line,
            index,
            nextEach,
            nextTotal,
            score: lineTierScore(line, tierByNumber),
            miss: Math.abs(nextTotal - total),
          };
        })
        .sort((left, right) => left.miss - right.miss || right.score - left.score || left.line.numbers.length - right.line.numbers.length);
      if (!lineChoices.length || lineChoices[0].miss >= Math.abs(currentTotal - total)) break;
      lineChoices[0].line.each = lineChoices[0].nextEach;
    } else {
      const allocations = applyLineAllocations(lines, candidates);
      const lineChoices = lines
        .map((line, index) => ({ line, index, score: lineTierScore(line, tierByNumber) }))
        .map((item) => ({ ...item, nextEach: previousStakeValue(item.line.each) }))
        .filter(({ line, nextEach }) => lineCanDecrease(line, allocations, minimum, nextEach))
        .map((item) => {
          const nextTotal = currentTotal - item.line.numbers.length * (item.line.each - item.nextEach);
          return {
            ...item,
            nextTotal,
            miss: Math.abs(nextTotal - total),
          };
        })
        .sort((left, right) => left.miss - right.miss || left.score - right.score || right.line.each - left.line.each);
      if (!lineChoices.length || lineChoices[0].miss >= Math.abs(currentTotal - total)) break;
      lineChoices[0].line.each = lineChoices[0].nextEach;
    }
  }

  adjustOptimizedTotalByPairs(lines, candidates, total, tierByNumber, minimum);
}

function ensureOptimizedProfit(lines, candidates, total, odds, tierByNumber) {
  const tolerance = optimizationTolerance(total);
  let guard = 0;

  while (guard < 10000) {
    guard += 1;
    const actualTotal = planTotalFromLines(lines);
    const allocations = applyLineAllocations(lines, candidates);
    const losing = candidates
      .map((num) => ({ num, amount: allocations[num] || 0, profit: (allocations[num] || 0) * odds - actualTotal }))
      .filter((item) => item.profit <= 0)
      .sort((left, right) => left.profit - right.profit)[0];

    if (!losing) return;

    const boost = lines
      .filter((line) => line.numbers.includes(losing.num))
      .sort((left, right) => lineTierScore(right, tierByNumber) - lineTierScore(left, tierByNumber))[0];
    if (!boost) return;
    boost.each = nextStakeValue(boost.each);

    while (planTotalFromLines(lines) - total > tolerance) {
      const nextAllocations = applyLineAllocations(lines, candidates);
      const reducers = lines
        .map((line) => ({ line, nextEach: previousStakeValue(line.each) }))
        .filter(({ line, nextEach }) => !line.numbers.includes(losing.num) && lineCanDecrease(line, nextAllocations, Math.floor(total / odds) + 1, nextEach))
        .sort((left, right) => lineTierScore(left.line, tierByNumber) - lineTierScore(right.line, tierByNumber));
      if (!reducers.length) break;
      reducers[0].line.each = reducers[0].nextEach;
    }
  }
}

function optimizedFinalCheck(candidates, allocations, total, odds, tiers) {
  const profits = Object.fromEntries(candidates.map((num) => [num, (allocations[num] || 0) * odds - total]));
  const losingNumbers = candidates.filter((num) => profits[num] <= 0);
  const amountList = candidates.map((num) => allocations[num] || 0);
  return {
    total,
    breakEven: total / odds,
    max: amountList.length ? Math.max(...amountList) : 0,
    min: amountList.length ? Math.min(...amountList) : 0,
    profits,
    losingNumbers,
    tiers: Object.fromEntries(tiers.map((tier) => [tier.key, tier.numbers.slice()])),
    budgetError: total - currentBudget(),
  };
}

function makeOptimizedBettingPlan() {
  const basePlan = generatePlan(currentGroupCount());
  if (!basePlan) return null;

  const total = currentBudget();
  const odds = currentOdds();
  const prefixes = getCheckedValues("prefix");
  const candidates = basePlan.candidates.slice();
  const originalAllocations = { ...basePlan.allocations };
  const tiers = classifyOptimizedTiers(candidates, originalAllocations);
  const tierByNumber = tiers[0]?.tierByNumber || new Map();
  const targetPlan = makeOptimizedTargets(candidates, tiers, originalAllocations, total, odds);
  const lines = seedOptimizedLines(basePlan.lines, targetPlan.targets);

  adjustOptimizedTotal(lines, candidates, total, tierByNumber, targetPlan.safeMinimum);
  ensureOptimizedProfit(lines, candidates, total, odds, tierByNumber);
  adjustOptimizedTotal(lines, candidates, total, tierByNumber, targetPlan.safeMinimum);
  refreshLineTotals(lines, prefixes);

  const allocations = applyLineAllocations(lines, candidates);
  const actualTotal = planTotalFromLines(lines);
  const finalTiers = classifyOptimizedTiers(candidates, allocations);
  const finalCheck = optimizedFinalCheck(candidates, allocations, actualTotal, odds, finalTiers);
  const summaries = finalTiers.map((tier) => {
    const netRange = netRangeFor(tier.numbers, allocations, actualTotal, odds);
    return {
      ...tier,
      budget: tierBudgetFromAllocations(tier, allocations),
      perNumber: tierStakeText(tier.numbers, allocations),
      netRange,
      tierByNumber: undefined,
    };
  });

  return {
    ...basePlan,
    type: "optimized",
    lines,
    allocations,
    candidates,
    total: actualTotal,
    targetTotal: total,
    odds,
    tiers: summaries,
    limits: null,
    optimization: {
      ...targetPlan,
      finalCheck,
      originalAllocations,
      originalTiers: Object.fromEntries(tiers.map((tier) => [tier.key, tier.numbers.slice()])),
    },
    signature: currentPlanSignature(candidates),
  };
}

function renderTierSummary(candidates, sourcePlan = null) {
  const tierPlan = sourcePlan?.tiers ? sourcePlan : makeTierPlan(candidates, getCheckedValues("prefix"));
  if (!tierPlan || !tierPlan.tiers) return "";

  return `
    <div class="tier-summary">
      ${tierPlan.tiers
        .filter((tier) => tier.numbers.length)
        .map(
          (tier) => `
            <div class="tier-card ${tier.key}">
              <strong>${tier.name} · ${tier.title}</strong>
              <span>号码 ${tier.numbers.length} 个</span>
              <span>档位资金 ${moneyText(tier.budget)}</span>
              <span>每号 ${tier.perNumber}</span>
              <em>净收益 ${netText(tier.netRange)}</em>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function groupAmountText(numbers, allocations) {
  if (!numbers.length) return "0";
  const amounts = numbers.map((num) => allocations[num] || 0);
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  return min === max ? moneyText(min) : `${moneyText(min)}-${moneyText(max)}`;
}

function groupSummaryLine(kind, name, numbers, plan) {
  const separator = randomItem(activeSeparators());
  const numberText = shuffleNumbers(numbers).map(twoDigit).join(separator);
  const total = numbers.reduce((sum, num) => sum + (plan.allocations[num] || 0), 0);
  const amountText = groupAmountText(numbers, plan.allocations);
  return {
    kind,
    name,
    numbers,
    numberText,
    total,
    amountText,
    text: `${kind} ${name}（${numbers.length}个）  号码: ${numberText}  每个号: ${amountText}  合计: ${moneyText(total)}`,
  };
}

function planGroupSummaries(plan) {
  if (!plan || !plan.candidates || !plan.allocations) return [];
  const candidateSet = new Set(plan.candidates);
  const summaries = [];

  Object.entries(ZODIAC_MAP).forEach(([name, numbers]) => {
    if (numbers.every((num) => candidateSet.has(num))) {
      summaries.push(groupSummaryLine("生肖", name, numbers.slice(), plan));
    }
  });

  const oddNumbers = plan.candidates.filter((num) => num % 2 !== 0);
  const evenNumbers = plan.candidates.filter((num) => num % 2 === 0);
  if (oddNumbers.length) summaries.push(groupSummaryLine("单双", "单数", oddNumbers, plan));
  if (evenNumbers.length) summaries.push(groupSummaryLine("单双", "双数", evenNumbers, plan));

  Object.entries(WAVE_MAP).forEach(([name]) => {
    const numbers = plan.candidates.filter((num) => numberWave(num) === name);
    if (numbers.length) summaries.push(groupSummaryLine("波色", name, numbers, plan));
  });

  return summaries;
}

function renderGroupSummary(plan) {
  const summaries = planGroupSummaries(plan);
  if (!summaries.length) return "";
  return `
    <div class="group-summary">
      ${summaries
        .map(
          (item) => `
            <div class="group-card">
              <strong>${item.kind} ${item.name} <small>${item.numbers.length}个</small></strong>
              <span>号码: ${item.numbers.map(twoDigit).join(".")}</span>
              <span>每个号: ${item.amountText}</span>
              <em>合计: ${moneyText(item.total)}</em>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function planText(plan) {
  return groupedLinesText(plan.lines);
}

function tierPlanNotice(plan) {
  if (plan?.type === "optimized") {
    return "";
  }
  if (!plan || plan.type !== "tier") return "";
  if (plan.overAllocated > 0) {
    return `已按分组数整理，当前总分配比预算多 ${plan.overAllocated}`;
  }
  if (plan.unallocated > 0) {
    if (plan.targetTotal > plan.maxTotal) {
      return `当前号码按硬区间最多分配 ${plan.maxTotal}，剩余 ${plan.unallocated} 未分配`;
    }
    return `已按硬区间随机分配，剩余 ${plan.unallocated} 未强行摊平`;
  }
  if (plan.targetTotal < plan.minTotal) {
    return `预算低于硬区间最低需求 ${plan.minTotal}，已按主攻优先分配`;
  }
  return "";
}

function applyGeneratedPlan(plan, writeOutput = true) {
  state.lastPlan = plan;
  if (writeOutput) {
    els.resultOutput.value = planText(plan);
    state.hasGeneratedOutput = true;
    state.profitVisible = false;
  }
  updateProfitButton();
  updateStats(plan);
  setNotice(tierPlanNotice(plan));
  if (els.dataPanel && !els.dataPanel.hidden) renderDataPanel(plan);
  saveState();
}

function scheduleAutoPreview() {
  clearTimeout(autoPreviewTimer);
  if (!hasBudgetAmount()) return;
  autoPreviewTimer = setTimeout(() => {
    const candidates = activeCandidates();
    const plan = candidates.length ? makeOptimizedBettingPlan() : null;
    if (!plan) return;
    applyGeneratedPlan(plan, false);
  }, 280);
}

function refreshAfterChange() {
  clearTimeout(autoPreviewTimer);
  state.lastPlan = null;
  resetProfitState();
  if (els.dataPanel) els.dataPanel.hidden = true;
  els.resultOutput.value = "";
  setNotice("");
  saveState();
  const candidates = activeCandidates();
  if (candidates.length && hasBudgetAmount()) {
    const plan = makeOptimizedBettingPlan();
    if (plan) {
      state.lastPlan = plan;
      updateStats(plan);
      setNotice(tierPlanNotice(plan));
      return;
    }
  }
  updateStats();
}

function renderAllocationPanel(plan) {
  if (!els.allocationPanel) return;
  if (!plan) {
    els.allocationPanel.hidden = true;
    els.allocationPanel.innerHTML = "";
    return;
  }

  const amounts = plan.candidates.map((num) => plan.allocations[num] || 0);
  const max = amounts.length ? Math.max(...amounts) : 0;
  const min = amounts.length ? Math.min(...amounts) : 0;
  const chips = plan.candidates
    .slice()
    .sort((a, b) => a - b)
    .map((num) => {
      const wave = numberWave(num);
      return `
        <span class="allocation-chip ${waveClass(wave)}">
          <strong>${twoDigit(num)}</strong>
          <span>${plan.allocations[num] || 0}</span>
        </span>
      `;
    })
    .join("");
  const tierHtml = renderTierSummary(plan.candidates, plan);
  const title = plan.type === "optimized" ? "优化分配" : plan.type === "tier" ? "三档分配" : "号码分配";

  els.allocationPanel.innerHTML = `
    <div class="allocation-title">
      <span>${title}${hasBudgetAmount() ? ` ｜ 赔率 ${moneyText(currentOdds())}` : ""}</span>
      <strong>${plan.candidates.length} 个 ｜ ${min} - ${max}</strong>
    </div>
    ${tierHtml}
    <div class="allocation-grid">${chips}</div>
  `;
  els.allocationPanel.hidden = false;
}

function renderDataPanel(plan) {
  if (!plan) {
    els.dataPanel.hidden = true;
    return;
  }

  const waveTotals = Object.fromEntries(Object.keys(WAVE_MAP).map((name) => [name, 0]));
  plan.candidates.forEach((num) => {
    waveTotals[numberWave(num)] += plan.allocations[num] || 0;
  });

  const summaryHtml = Object.keys(WAVE_MAP)
    .map((name) => {
      const color = name === "红波" ? "red" : name === "蓝波" ? "blue" : "green";
      return `<div class="summary-box ${color}"><span>${name}</span><strong>${waveTotals[name]}</strong></div>`;
    })
    .join("");

  const amounts = plan.candidates.map((num) => plan.allocations[num] || 0);
  const max = amounts.length ? Math.max(...amounts) : 0;
  const min = amounts.length ? Math.min(...amounts) : 0;
  const limitText = plan.limits
    ? `目标区间：${plan.limits.min} - ${plan.limits.max}，实际区间：${min} - ${max}`
    : `实际区间：${min} - ${max}`;

  const itemHtml = plan.candidates
    .slice()
    .sort((a, b) => a - b)
    .map((num) => {
      const zodiac = numberZodiac(num);
      const wave = numberWave(num);
      return `
        <div class="data-item">
          <div class="data-num"><span>${twoDigit(num)}</span><span>${plan.allocations[num] || 0}</span></div>
          <div class="data-meta">${zodiac} ｜ ${wave}</div>
          <div class="data-money">分配金额：${plan.allocations[num] || 0}</div>
        </div>
      `;
    })
    .join("");
  const tierHtml = renderTierSummary(plan.candidates, plan);

  els.dataPanel.innerHTML = `
    <h3>${plan.type === "tier" ? "三档数据" : "打开数据"}</h3>
    <div class="data-note">${limitText}</div>
    ${tierHtml}
    <div class="wave-summary">${summaryHtml}</div>
    <div class="data-grid">${itemHtml}</div>
  `;
  els.dataPanel.hidden = false;
}

function renderNumberGrid() {
  els.numberGrid.innerHTML = "";
  for (let num = 1; num <= 49; num += 1) {
    const btn = document.createElement("button");
    const zodiac = numberZodiac(num);
    const wave = numberWave(num);
    btn.type = "button";
    btn.className = `num-btn ${waveClass(wave)}`;
    btn.innerHTML = `<span class="num-main">${twoDigit(num)}</span><span class="num-money"></span>`;
    btn.dataset.num = String(num);
    btn.title = `${twoDigit(num)} ${zodiac} ${wave}`;
    btn.addEventListener("click", () => {
      state.autoRandomSelection = false;
      if (state.selectedNumbers.has(num)) {
        state.selectedNumbers.delete(num);
      } else {
        state.selectedNumbers.add(num);
      }
      refreshAfterChange();
    });
    els.numberGrid.appendChild(btn);
  }
}

function renderChecks() {
  els.zodiacGrid.innerHTML = "";
  Object.keys(ZODIAC_MAP).forEach((name) => {
    const label = document.createElement("label");
    label.className = "check-pill";
    label.innerHTML = `<input type="checkbox" name="zodiac" value="${name}"><span>${name}</span>`;
    els.zodiacGrid.appendChild(label);
  });

  els.waveGrid.innerHTML = "";
  Object.keys(WAVE_MAP).forEach((name) => {
    const color = name === "红波" ? "red" : name === "蓝波" ? "blue" : "green";
    const label = document.createElement("label");
    label.className = `check-pill ${color}`;
    label.innerHTML = `<input type="checkbox" name="wave" value="${name}"><span class="swatch ${color}"></span><span>${name}</span>`;
    els.waveGrid.appendChild(label);
  });

  els.prefixGrid.innerHTML = "";
  PREFIXES.forEach((name) => {
    const label = document.createElement("label");
    label.className = "check-pill";
    const checked = name === "新奥" ? " checked" : "";
    label.innerHTML = `<input type="checkbox" name="prefix" value="${name}"${checked}><span>${name}</span>`;
    els.prefixGrid.appendChild(label);
  });
}

function saveState() {
  const data = {
    separators: els.separators.value,
    oddsAmount: els.oddsAmount.value,
    usageCount: state.usageCount,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function restoreState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    ["separators", "oddsAmount"].forEach((key) => {
      if (data[key] !== undefined && els[key]) els[key].value = data[key];
    });
    state.usageCount = Math.max(0, Number(data.usageCount ?? data.multiExportCount) || 0);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  updateUsageCountText();
}

function setCheckedValues(name, values) {
  const set = new Set(values);
  document.querySelectorAll(`input[name="${name}"]`).forEach((input) => {
    input.checked = set.has(input.value);
  });
}

function bindEvents() {
  els.selectAll.addEventListener("click", () => {
    state.autoRandomSelection = false;
    state.selectedNumbers = new Set(Array.from({ length: 49 }, (_, index) => index + 1));
    refreshAfterChange();
  });

  els.selectNone.addEventListener("click", () => {
    state.autoRandomSelection = false;
    state.selectedNumbers.clear();
    refreshAfterChange();
  });

  els.invertSelect.addEventListener("click", () => {
    state.autoRandomSelection = false;
    const next = new Set();
    for (let num = 1; num <= 49; num += 1) {
      if (!state.selectedNumbers.has(num)) next.add(num);
    }
    state.selectedNumbers = next;
    refreshAfterChange();
  });

  els.resetAll.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    state.selectedNumbers.clear();
    state.autoRandomSelection = false;
    window.location.reload();
  });

  els.multiBtn.addEventListener("click", () => {
    if (!requireBudgetAmount()) return;
    const plan = canReuseCurrentPlan(state.lastPlan) ? state.lastPlan : makeOptimizedBettingPlan();
    if (!plan) return;
    applyGeneratedPlan(plan, true);
  });

  els.profitBtn.addEventListener("click", () => {
    if (!state.lastPlan || !state.hasGeneratedOutput) {
      setNotice("请先点击多导出生成结果");
      return;
    }
    state.profitVisible = true;
    renderManualProfitPanel(state.lastPlan, true);
  });

  els.copyBtn.addEventListener("click", async () => {
    const text = els.resultOutput.value.trim();
    if (!text) {
      setNotice("没有可复制的数据");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setNotice("已复制到剪贴板");
    } catch {
      els.resultOutput.select();
      document.execCommand("copy");
      setNotice("已复制到剪贴板");
    }
  });

  els.clearBtn.addEventListener("click", () => {
    els.resultOutput.value = "";
    state.lastPlan = null;
    resetProfitState();
    if (els.dataPanel) els.dataPanel.hidden = true;
    setNotice("");
    updateStats();
  });

  document.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (event) => {
      if (isAttackInput(input)) formatAttackInput(input, event);
      if (isSelectionFilterControl(input)) applySelectionFilters();
      refreshAfterChange();
    });
    input.addEventListener("change", () => {
      if (isAttackInput(input)) finalizeAttackInput(input);
      if (isSelectionFilterControl(input)) applySelectionFilters();
      refreshAfterChange();
    });
  });
}

function collectElements() {
  [
    "numberGrid",
    "selectedCount",
    "selectAll",
    "selectNone",
    "invertSelect",
    "mainAttackNumbers",
    "mainAttackStatus",
    "secondAttackNumbers",
    "secondAttackStatus",
    "defenseNumbers",
    "defenseStatus",
    "minPickCount",
    "pickCount",
    "groupCount",
    "budgetAmount",
    "budgetRange",
    "separators",
    "oddsAmount",
    "oddOnly",
    "evenOnly",
    "headDigits",
    "tailDigits",
    "zodiacGrid",
    "waveGrid",
    "prefixGrid",
    "candidateText",
    "multiBtn",
    "profitBtn",
    "copyBtn",
    "clearBtn",
    "resultOutput",
    "allocationPanel",
    "dataPanel",
    "manualProfitPanel",
    "totalText",
    "rangeText",
    "usageCountText",
    "noticeText",
    "resetAll",
  ].forEach((id) => {
    els[id] = document.getElementById(id);
  });
}

function init() {
  collectElements();
  renderChecks();
  restoreState();
  incrementUsageCount();
  renderNumberGrid();
  bindEvents();
  updateProfitButton();
  updateStats();
  updateUsageCountText();
}

init();
