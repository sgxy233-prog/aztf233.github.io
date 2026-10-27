(() => {
  const STYLE_NAMES = {
    DIR: "直球立界者", COL: "双赢解题者", COM: "灵活换挡者",
    AVO: "静默撤离者", ACC: "温柔缓冲者"
  };
  const STYLE_SHORT = { DIR: "立界", COL: "解题", COM: "换挡", AVO: "撤离", ACC: "缓冲" };
  const TIE_TEXT = {
    DIR: "我宁愿当下把边界说清，也不想让问题继续。",
    COL: "只要对方愿意谈，我更想找到双方都能接受的新办法。",
    COM: "我更在意尽快得到一个现实、可执行的中间方案。",
    AVO: "当沟通代价太大，我更愿意暂停或离开。",
    ACC: "如果这件事对我没那么重要，我愿意先照顾关系。"
  };
  const state = { data: null, results: null, index: 0, answers: [], pendingResult: null };
  const $ = id => document.getElementById(id);
  const screens = ["loading", "welcome", "quiz", "checkpoint", "tieBreak", "result", "error"];

  function show(id) {
    screens.forEach(name => $(name).classList.toggle("hidden", name !== id));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toast(message) {
    const el = $("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 1700);
  }

  async function load() {
    try {
      const [qRes, rRes] = await Promise.all([fetch("./questions.json"), fetch("./results.json")]);
      if (!qRes.ok || !rRes.ok) throw new Error("Data request failed");
      state.data = await qRes.json();
      state.results = await rRes.json();
      show("welcome");
    } catch (error) {
      console.error(error);
      show("error");
    }
  }

  function start() {
    state.index = 0;
    state.answers = [];
    state.pendingResult = null;
    show("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    const question = state.data.questions[state.index];
    const total = state.data.questions.length;
    $("progressLabel").textContent = `${String(state.index + 1).padStart(2, "0")} / ${total}`;
    $("categoryLabel").textContent = question.category;
    $("progressBar").style.width = `${((state.index + 1) / total) * 100}%`;
    $("questionText").textContent = question.prompt;
    $("backBtn").style.visibility = state.index === 0 ? "hidden" : "visible";
    const wrap = $("options");
    wrap.innerHTML = "";
    question.options.forEach(option => {
      const button = document.createElement("button");
      button.className = "option-btn";
      button.innerHTML = `<span class="option-key">${option.key}</span><span class="option-text"></span>`;
      button.querySelector(".option-text").textContent = option.text;
      button.addEventListener("click", () => choose(option, button));
      wrap.appendChild(button);
    });
  }

  function choose(option, button) {
    if (button.classList.contains("selected")) return;
    [...$("options").children].forEach(el => el.disabled = true);
    button.classList.add("selected");
    state.answers[state.index] = option.score;
    setTimeout(() => advance(), 260);
  }

  function advance() {
    const completed = state.index + 1;
    if (completed >= state.data.questions.length) return finish();
    state.index += 1;
    if (completed === 8 || completed === 16) {
      $("checkpointNumber").textContent = String(completed).padStart(2, "0");
      if (completed === 8) {
        $("checkpointTitle").innerHTML = "你的边界模式<br>开始显现";
        $("checkpointText").textContent = "继续按第一反应选择，会比反复斟酌更接近真实的你。";
      } else {
        $("checkpointTitle").innerHTML = "还差 8 题<br>看见完整模式";
        $("checkpointText").textContent = "结果会同时给出你的主要反应和次要倾向。";
      }
      show("checkpoint");
    } else {
      renderQuestion();
    }
  }

  function goBack() {
    if (state.index <= 0) return;
    state.index -= 1;
    state.answers = state.answers.slice(0, state.index);
    renderQuestion();
  }

  function score() {
    const totals = { DIR: 0, COL: 0, COM: 0, AVO: 0, ACC: 0 };
    state.answers.forEach(code => totals[code] += 1);
    const ranked = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const topScore = ranked[0][1];
    const topTies = ranked.filter(([, value]) => value === topScore).map(([key]) => key);
    return { totals, ranked, topTies };
  }

  function finish() {
    const scored = score();
    state.pendingResult = scored;
    if (scored.topTies.length > 1) return renderTie(scored.topTies);
    renderResult(scored.topTies[0]);
  }

  function renderTie(ties) {
    const wrap = $("tieOptions");
    wrap.innerHTML = "";
    ties.forEach((code, idx) => {
      const button = document.createElement("button");
      button.className = "option-btn";
      button.innerHTML = `<span class="option-key">${String.fromCharCode(65 + idx)}</span><span class="option-text"></span>`;
      button.querySelector(".option-text").textContent = TIE_TEXT[code];
      button.addEventListener("click", () => renderResult(code));
      wrap.appendChild(button);
    });
    show("tieBreak");
  }

  function renderResult(primary) {
    const { totals, ranked } = state.pendingResult;
    const result = state.results.styles[primary];
    const secondScore = ranked.find(([code]) => code !== primary)?.[1] ?? 0;
    const secondaryCodes = ranked.filter(([code, value]) => code !== primary && value === secondScore).map(([code]) => code);
    const secondary = secondaryCodes[0];
    const blend = secondary ? state.results.secondary_blends[`${primary}_${secondary}`] : "";

    $("resultSeal").textContent = STYLE_SHORT[primary];
    $("resultName").textContent = result.name;
    $("shareTitle").textContent = result.share_title;
    $("resultSummary").textContent = result.summary;
    $("secondaryBadge").textContent = secondaryCodes.length > 1
      ? `并列副倾向：${secondaryCodes.map(code => STYLE_NAMES[code]).join(" · ")}`
      : `副倾向：${STYLE_NAMES[secondary]}｜${blend}`;

    $("scoreBars").innerHTML = Object.entries(STYLE_NAMES).map(([code, name]) => `
      <div class="score-row">
        <span>${name.slice(0, 4)}</span>
        <div class="score-track"><div class="score-fill" style="width:${totals[code] / 24 * 100}%"></div></div>
        <span class="score-value">${totals[code]}</span>
      </div>`).join("");
    $("strengthList").innerHTML = result.strengths.map(item => `<li>${escapeHtml(item)}</li>`).join("");
    $("blindSpot").textContent = result.blind_spot;
    $("bestUsed").textContent = result.best_used_when;
    $("growthPrompt").textContent = result.growth_prompt;
    $("scriptList").innerHTML = "";
    result.scripts.forEach(script => {
      const el = document.createElement("div");
      el.className = "script-item";
      el.textContent = `“${script}”`;
      el.addEventListener("click", () => copyText(script, "表达已复制"));
      $("scriptList").appendChild(el);
    });
    state.primary = primary;
    state.secondary = secondary;
    show("result");
  }

  function escapeHtml(value) {
    return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  async function copyText(text, success = "已复制") {
    try { await navigator.clipboard.writeText(text); toast(success); }
    catch { toast("请长按文字复制"); }
  }

  async function share() {
    const result = state.results.styles[state.primary];
    const text = `我的人际边界反应是「${result.name}」：${result.share_title}`;
    if (navigator.share) {
      try { await navigator.share({ title: "人际边界反应测试", text, url: location.href }); return; }
      catch (error) { if (error.name === "AbortError") return; }
    }
    copyText(`${text}\n${location.href}`, "结果和链接已复制");
  }

  $("startBtn").addEventListener("click", start);
  $("backBtn").addEventListener("click", goBack);
  $("continueBtn").addEventListener("click", () => { show("quiz"); renderQuestion(); });
  $("restartBtn").addEventListener("click", start);
  $("shareBtn").addEventListener("click", share);
  load();
})();
