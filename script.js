const VERSION = "v4.0.0";
const STORAGE_KEY = "que-ding-demo-v4.0";

const routes = ["home", "create", "join", "invite", "settle", "me", "room", "ai", "summary", "history"];
const winds = ["East", "South", "West", "North"];
const avatarColors = ["#0f6a55", "#b33b33", "#305c89", "#9a6a22"];

const fanOptions = [
  { id: "selfDraw", name: "Self-draw", fan: 1, reason: "Winner self-drew; three players pay" },
  { id: "allTriplets", name: "All triplets", fan: 3, reason: "Four triplet sets" },
  { id: "sevenPairs", name: "Seven pairs", fan: 4, reason: "Seven completed pairs" },
  { id: "pureSuit", name: "Pure suit", fan: 6, reason: "One suit throughout" },
  { id: "dragonSet", name: "Dragon triplet", fan: 2, reason: "Red, green, or white dragon triplet" },
  { id: "kong", name: "Kong draw", fan: 2, reason: "Won after drawing from a kong" },
];

const aiSamples = [
  {
    title: "Pure suit · Self-draw",
    confidence: 96,
    tiles: ["1●", "2●", "3●", "3●", "4●", "5●", "5●", "6●", "7●", "7●", "8●", "9●", "9●", "9●"],
    reasons: [
      ["Pattern", "All tiles are circles, satisfying a pure suit"],
      ["Fan", "Pure suit 6 + self-draw 1 = 7 fan"],
      ["Evidence", "14 complete tiles with an explainable pair and sequences"],
    ],
    selectedFans: ["selfDraw", "pureSuit"],
  },
  {
    title: "Seven pairs · Self-draw",
    confidence: 93,
    tiles: ["1m", "1m", "3m", "3m", "5●", "5●", "7●", "7●", "2b", "2b", "8b", "8b", "G", "G"],
    reasons: [
      ["Pattern", "Seven pairs detected"],
      ["Fan", "Seven pairs 4 + self-draw 1 = 5 fan"],
      ["Evidence", "No isolated tiles; a stable completed hand"],
    ],
    selectedFans: ["selfDraw", "sevenPairs"],
  },
  {
    title: "All triplets · Red dragon",
    confidence: 91,
    tiles: ["2m", "2m", "2m", "5●", "5●", "5●", "7b", "7b", "7b", "R", "R", "R", "W", "W"],
    reasons: [
      ["Pattern", "Four triplets plus one pair"],
      ["Fan", "All triplets 3 + dragon triplet 2 = 5 fan"],
      ["Evidence", "All three red dragon tiles have over 90% confidence"],
    ],
    selectedFans: ["allTriplets", "dragonSet"],
  },
];

const state = {
  route: "home",
  routeStack: ["home"],
  roomCode: "HL-0826",
  rule: "Ningbo Mahjong",
  baseScore: 2,
  cap: 64,
  roundLimit: 8,
  group: "Saturday regulars",
  selectedAvatar: 0,
  aiIndex: 0,
  players: [
    { id: "p1", name: "Shuheng", score: 0, lastDelta: 0, wind: "East", badge: "Host", color: avatarColors[0] },
    { id: "p2", name: "Lin", score: 0, lastDelta: 0, wind: "South", badge: "Player", color: avatarColors[1] },
    { id: "p3", name: "Chen", score: 0, lastDelta: 0, wind: "West", badge: "Player", color: avatarColors[2] },
    { id: "p4", name: "Alex", score: 0, lastDelta: 0, wind: "North", badge: "Player", color: avatarColors[3] },
  ],
  rounds: [],
  disputes: [],
  histories: [],
  pendingPayments: [],
  matchStatus: "active",
  lastFinishedMatchId: "",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function money(value) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}¥${Math.abs(value)}`;
}

function point(value) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${value}`;
}

function winRate(player) {
  const totalRounds = state.rounds.length;
  if (!totalRounds) return 0;
  const wins = state.rounds.filter((round) => round.winnerId === player.id || round.winner === player.name).length;
  return Math.round((wins / totalRounds) * 100);
}

function initials(name) {
  return name.slice(0, 1) || "Q";
}

function routeTo(id, push = true) {
  if (!routes.includes(id)) return;
  state.route = id;
  $$(".page").forEach((page) => page.classList.toggle("active", page.id === id));
  if (push && state.routeStack[state.routeStack.length - 1] !== id) {
    state.routeStack.push(id);
  }
  render();
  if (id === "settle") {
    calculatePayments();
  }
  window.scrollTo({ top: 0, behavior: "auto" });
}

function goBack() {
  if (state.routeStack.length <= 1) {
    routeTo("home", false);
    return;
  }
  state.routeStack.pop();
  routeTo(state.routeStack[state.routeStack.length - 1], false);
}

function playerById(id) {
  return state.players.find((player) => player.id === id) || state.players[0];
}

function generateRoomCode() {
  const part = Math.floor(1000 + Math.random() * 9000);
  state.roomCode = `HL-${part}`;
}

function resetCurrentMatch() {
  state.players.forEach((player, index) => {
    player.score = 0;
    player.lastDelta = 0;
    player.wind = winds[index];
    player.badge = index === 0 ? "Host" : "Player";
  });
  state.rounds = [];
  state.disputes = [];
  state.pendingPayments = [];
  state.aiIndex = 0;
  state.matchStatus = "active";
}

function saveToStorage() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: VERSION,
      players: state.players,
      rounds: state.rounds,
      disputes: state.disputes,
      histories: state.histories,
      matchStatus: state.matchStatus,
      lastFinishedMatchId: state.lastFinishedMatchId,
      roomCode: state.roomCode,
      rule: state.rule,
      baseScore: state.baseScore,
      cap: state.cap,
      roundLimit: state.roundLimit,
      group: state.group,
    }),
  );
}

function loadFromStorage() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    Object.assign(state, saved);
    state.route = "home";
    state.routeStack = ["home"];
    state.matchStatus = saved.matchStatus || "active";
    state.lastFinishedMatchId = saved.lastFinishedMatchId || "";
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function renderQr() {
  const qr = $("#qrGrid");
  if (!qr) return;
  const bits = Array.from({ length: 81 }, (_, index) => {
    const code = state.roomCode.charCodeAt(index % state.roomCode.length);
    return (index + code + Math.floor(index / 3)) % 3 === 0;
  });
  qr.innerHTML = bits.map((bit) => `<span class="${bit ? "dark" : ""}"></span>`).join("");
}

function renderPlayerEditor() {
  const editor = $("#playerEditor");
  if (!editor) return;
  editor.innerHTML = state.players
    .map(
      (player, index) => `
        <label class="player-input">
          <span class="avatar" style="background:${player.color}">${winds[index]}</span>
          <input data-player-name="${player.id}" type="text" value="${player.name}" />
        </label>
      `,
    )
    .join("");
}

function renderAvatarPicker() {
  const picker = $("#avatarPicker");
  if (!picker) return;
  picker.innerHTML = avatarColors
    .map(
      (color, index) => `
        <button class="avatar-option ${state.selectedAvatar === index ? "active" : ""}" data-avatar="${index}">
          <span class="avatar" style="background:${color}">${index + 1}</span>
        </button>
      `,
    )
    .join("");
}

function renderFriends() {
  const target = $("#friendGroup");
  if (!target) return;
  target.innerHTML = state.players
    .map(
      (player) => `
        <div class="friend-chip">
          <span class="avatar" style="background:${player.color}">${initials(player.name)}</span>
          <strong>${player.name}</strong>
          <span>${player.badge}</span>
        </div>
      `,
    )
    .join("");
}

function renderRanks() {
  const ranks = [...state.players].sort((a, b) => b.score - a.score);
  const html = ranks
    .map(
      (player, index) => `
        <div class="rank-item">
          <span>${index + 1}. ${player.name}</span>
          <strong class="${player.score >= 0 ? "positive" : "negative-text"}">${point(player.score)}</strong>
        </div>
      `,
    )
    .join("");
  if ($("#homeRanks")) $("#homeRanks").innerHTML = html;
}

function renderScoreboard() {
  const board = $("#scoreboard");
  if (!board) return;
  board.innerHTML = state.players
    .map(
      (player) => `
        <article class="player-card">
          <div class="player-top">
            <div class="player-name">
              <span class="avatar" style="background:${player.color}">${initials(player.name)}</span>
              <div>
            <span class="wind">${player.wind}</span>
                <h3>${player.name}</h3>
              </div>
            </div>
            <span class="badge">${player.badge}</span>
          </div>
          <p class="score-value ${player.score >= 0 ? "positive" : "negative-text"}">${point(player.score)}</p>
          <span class="delta ${player.lastDelta < 0 ? "negative" : ""}">${point(player.lastDelta)} this hand</span>
          <div class="badge-row">
            <span class="badge">Win rate ${winRate(player)}%</span>
            <span class="badge">Total ${money(player.score)}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderLedger() {
  const ledger = $("#ledgerList");
  if (!ledger) return;
  const latest = [...state.rounds].slice(-5).reverse();
  ledger.innerHTML = latest.length
    ? latest
        .map(
          (round) => `
            <div class="ledger-item">
              <div>
                <strong>Round ${round.no} · ${round.winner}</strong>
                <span>${round.fans.join(", ")} · paid by ${round.payers.join(", ")}</span>
              </div>
              <strong class="positive">+${round.total}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">No hand settlements yet</div>`;
}

function renderHighlights() {
  const high = [...state.players].sort((a, b) => b.score - a.score)[0];
  const low = [...state.players].sort((a, b) => a.score - b.score)[0];
  const target = $("#highlightGrid");
  if (!target) return;
  if (!state.rounds.length) {
    target.innerHTML = `
      <div class="highlight-item"><span>Top player</span><strong>To be decided</strong></div>
      <div class="highlight-item"><span>Most losses</span><strong>To be decided</strong></div>
      <div class="highlight-item"><span>Hands played</span><strong>0</strong></div>
      <div class="highlight-item"><span>AI rulings</span><strong>${state.disputes.length}</strong></div>
    `;
    return;
  }
  target.innerHTML = `
    <div class="highlight-item"><span>Top player</span><strong>${high.name}</strong></div>
    <div class="highlight-item"><span>Most losses</span><strong>${low.name}</strong></div>
    <div class="highlight-item"><span>Hands played</span><strong>${state.rounds.length}</strong></div>
    <div class="highlight-item"><span>AI rulings</span><strong>${state.disputes.length}</strong></div>
  `;
}

function renderSelects() {
  const winner = $("#winnerSelect");
  const loser = $("#loserSelect");
  if (!winner || !loser) return;
  const currentWinner = winner.value || state.players[0].id;
  const currentLoser = loser.value;
  const options = state.players.map((player) => `<option value="${player.id}">${player.name}</option>`).join("");
  winner.innerHTML = options;
  winner.value = currentWinner;
  loser.innerHTML = state.players
    .filter((player) => player.id !== winner.value)
    .map((player) => `<option value="${player.id}">${player.name}</option>`)
    .join("");
  if (currentLoser && currentLoser !== winner.value) {
    loser.value = currentLoser;
  }
}

function renderFanPicker(selected = ["selfDraw"]) {
  const picker = $("#fanPicker");
  if (!picker) return;
  picker.innerHTML = fanOptions
    .map(
      (fan) => `
        <button class="fan-option ${selected.includes(fan.id) ? "active" : ""}" data-fan="${fan.id}">
          <strong>${fan.name}</strong>
          <span>${fan.fan} fan · ${fan.reason}</span>
        </button>
      `,
    )
    .join("");
}

function selectedFans() {
  const active = $$(".fan-option.active").map((button) => button.dataset.fan);
  return active.length ? active : ["selfDraw"];
}

function calculatePayments() {
  const winner = playerById($("#winnerSelect")?.value);
  const mode = $("#payerMode")?.value || "all";
  const loser = playerById($("#loserSelect")?.value);
  const direct = Number($("#directAmount")?.value || 0);
  const multiplier = Number($("#multiplierInput")?.value || 1);
  const selected = selectedFans();
  const fanTotal = selected.reduce((sum, id) => sum + (fanOptions.find((fan) => fan.id === id)?.fan || 0), 0);
  const autoAmount = Math.min(state.cap || Infinity, state.baseScore * Math.max(1, fanTotal) * multiplier);
  const amount = direct > 0 ? direct : autoAmount;
  const payers = mode === "all" ? state.players.filter((player) => player.id !== winner.id) : [loser];

  state.pendingPayments = payers.map((payer) => ({
    from: payer.id,
    to: winner.id,
    amount,
    fans: selected.map((id) => fanOptions.find((fan) => fan.id === id)?.name).filter(Boolean),
  }));
  renderPayments();
}

function renderPayments() {
  const list = $("#paymentList");
  const total = state.pendingPayments.reduce((sum, item) => sum + item.amount, 0);
  if ($("#settleTotal")) $("#settleTotal").textContent = `¥${total}`;
  if (!list) return;
  list.innerHTML = state.pendingPayments.length
    ? state.pendingPayments
        .map((item) => {
          const from = playerById(item.from);
          const to = playerById(item.to);
          return `
            <div class="payment-item">
              <div>
                <strong>${from.name} → ${to.name}</strong>
                <span>${item.fans.join(", ") || "Direct amount"}</span>
              </div>
              <strong>¥${item.amount}</strong>
            </div>
          `;
        })
        .join("")
    : `<div class="empty-state">Waiting for calculation</div>`;
}

function confirmSettle() {
  if (state.matchStatus === "finished") return;
  if (!state.pendingPayments.length) calculatePayments();
  if (!state.pendingPayments.length) return;
  state.players.forEach((player) => {
    player.lastDelta = 0;
  });

  state.pendingPayments.forEach((payment) => {
    const from = playerById(payment.from);
    const to = playerById(payment.to);
    from.score -= payment.amount;
    from.lastDelta -= payment.amount;
    to.score += payment.amount;
    to.lastDelta += payment.amount;
  });

  const first = state.pendingPayments[0];
  state.rounds.push({
    no: state.rounds.length + 1,
    winnerId: first.to,
    winner: playerById(first.to).name,
    payers: state.pendingPayments.map((payment) => playerById(payment.from).name),
    amount: first.amount,
    fans: first.fans,
    total: state.pendingPayments.reduce((sum, payment) => sum + payment.amount, 0),
  });

  state.pendingPayments = [];
  saveToStorage();
  continueRound();
}

function renderAi() {
  const sample = aiSamples[state.aiIndex % aiSamples.length];
  if ($("#aiTiles")) {
    $("#aiTiles").innerHTML = sample.tiles
      .map((tile) => `<span class="tile ${tile === "R" ? "red" : tile === "G" || tile === "W" ? "green" : ""}">${tile}</span>`)
      .join("");
  }
  if ($("#aiResultTitle")) $("#aiResultTitle").textContent = sample.title;
  if ($("#confidenceText")) $("#confidenceText").textContent = `${sample.confidence}%`;
  if ($("#confidenceBar")) $("#confidenceBar").style.width = `${sample.confidence}%`;
  if ($("#reasonList")) {
    $("#reasonList").innerHTML = sample.reasons
      .map(
        ([label, copy]) => `
          <div class="reason-item">
            <strong>${label}</strong>
            <span>${copy}</span>
          </div>
        `,
      )
      .join("");
  }
}

function applyAiToSettle() {
  const sample = aiSamples[state.aiIndex % aiSamples.length];
  renderFanPicker(sample.selectedFans);
  routeTo("settle");
  calculatePayments();
}

function saveDispute() {
  const sample = aiSamples[state.aiIndex % aiSamples.length];
  state.disputes.unshift({
    title: sample.title,
    confidence: sample.confidence,
    time: `Round ${state.rounds.length + 1}`,
    note: "Saved",
  });
  saveToStorage();
  renderDisputes();
}

function renderSummary() {
  const final = $("#finalScoreboard");
  if (!final) return;
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  final.innerHTML = sorted
    .map(
      (player) => `
        <div class="final-player">
          <span>${player.badge}</span>
          <h3>${player.name}</h3>
          <strong class="${player.score >= 0 ? "positive" : "negative-text"}">${point(player.score)}</strong>
        </div>
      `,
    )
    .join("");

  const winners = sorted.filter((player) => player.score > 0);
  const losers = sorted.filter((player) => player.score < 0).reverse();
  const transfers = [];
  let wi = 0;
  let li = 0;
  let receive = winners[wi] ? winners[wi].score : 0;
  let pay = losers[li] ? Math.abs(losers[li].score) : 0;
  while (winners[wi] && losers[li]) {
    const amount = Math.min(receive, pay);
    transfers.push({ from: losers[li].name, to: winners[wi].name, amount });
    receive -= amount;
    pay -= amount;
    if (receive === 0) {
      wi += 1;
      receive = winners[wi] ? winners[wi].score : 0;
    }
    if (pay === 0) {
      li += 1;
      pay = losers[li] ? Math.abs(losers[li].score) : 0;
    }
  }

  $("#transferList").innerHTML = transfers.length
    ? transfers
        .map(
          (item) => `
            <div class="transfer-item">
              <span>${item.from} pays ${item.to}</span>
              <strong>¥${item.amount}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">The ledger is settled</div>`;

  const winner = sorted[0];
  $("#posterWinner").innerHTML = `
    <span>Top player</span>
    <strong>${winner.name}</strong>
    <span>${money(winner.score)}</span>
  `;
  $("#posterStats").innerHTML = `
    <div class="poster-stat"><span>Hands</span><strong>${state.rounds.length}</strong></div>
    <div class="poster-stat"><span>AI rulings</span><strong>${state.disputes.length}</strong></div>
    <div class="poster-stat"><span>Rules</span><strong>${state.rule}</strong></div>
    <div class="poster-stat"><span>Room code</span><strong>${state.roomCode}</strong></div>
  `;
}

function renderHistory() {
  const history = $("#matchHistory");
  if (!history) return;
  history.innerHTML = state.histories.length
    ? state.histories
        .map(
          (item) => {
            const playerRows = item.players
              ? item.players
                  .map(
                    (player) => `
                      <span>${player.name} <b class="${player.score >= 0 ? "positive" : "negative-text"}">${point(player.score)}</b></span>
                    `,
                  )
                  .join("")
              : "";
            return `
            <div class="history-item">
              <div>
                <strong>${item.group}</strong>
                <span>${item.time} · ${item.rule || state.rule} · ${item.rounds} hands · ${item.roomCode || state.roomCode}</span>
                <div class="history-scores">${playerRows}</div>
              </div>
              <strong>${item.winner}</strong>
            </div>
          `;
          },
        )
        .join("")
    : `<div class="empty-state">No saved sessions yet</div>`;
}

function renderSettleBand() {
  if (!$("#settleBandStats")) return;
  const leader = [...state.players].sort((a, b) => b.score - a.score)[0];
  const statusText = state.matchStatus === "finished" ? "Finished" : "In progress";
  $("#matchStatusLabel").textContent = `${statusText} · ${state.roomCode} · ${state.group}`;
  $("#settleBandCopy").textContent =
    state.matchStatus === "finished"
      ? "This session is saved to history. Start or join a new game from Home to play again."
      : `${state.rounds.length} hands recorded. Current leader: ${leader.name} ${money(leader.score)}.`;
  $("#settleBandStats").innerHTML = `
    <div><span>Hands recorded</span><strong>${state.rounds.length}</strong></div>
    <div><span>Rules</span><strong>${state.rule}</strong></div>
    <div><span>Current leader</span><strong>${leader.name}</strong></div>
  `;

  const endButton = $("#endMatchBtn");
  const confirmButton = $("#confirmSettleBtn");
  if (endButton) {
    endButton.textContent = state.matchStatus === "finished" ? "Saved to history" : "End session";
    endButton.disabled = state.matchStatus === "finished";
  }
  if (confirmButton) {
    confirmButton.disabled = state.matchStatus === "finished";
    confirmButton.textContent = state.matchStatus === "finished" ? "Session ended" : "Confirm settlement";
  }
}

function renderRecentMatch() {
  const card = $("#recentMatchCard");
  if (!card) return;
  const recent = state.histories[0];
  card.innerHTML = recent
    ? `
      <div class="section-title">
        <p class="eyebrow">Recently finished</p>
        <h2>${recent.group}</h2>
      </div>
      <div class="recent-match-grid">
        <div><span>Winner</span><strong>${recent.winner}</strong></div>
        <div><span>Hands</span><strong>${recent.rounds}</strong></div>
        <div><span>Rules</span><strong>${recent.rule || state.rule}</strong></div>
        <div><span>Time</span><strong>${recent.time}</strong></div>
      </div>
      <button class="secondary-action full" data-route="history" type="button">View session history</button>
    `
    : `
      <div class="section-title">
        <p class="eyebrow">Recently finished</p>
        <h2>No finished sessions</h2>
      </div>
      <div class="empty-state">End a session from Record to save it here.</div>
    `;
}

function renderRoundArchive() {
  const archive = $("#roundArchive");
  if (!archive) return;
  const rounds = [...state.rounds].reverse();
  archive.innerHTML = rounds.length
    ? rounds
        .map(
          (round) => `
            <div class="history-item">
              <div>
                <strong>Round ${round.no} · ${round.winner}</strong>
                <span>${round.fans.join(", ") || "Direct amount"} · paid by ${round.payers.join(", ")}</span>
              </div>
              <strong class="positive">+${round.total}</strong>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">No settlements in this session yet</div>`;
}

function renderDisputes() {
  const list = $("#disputeList");
  if (!list) return;
  list.innerHTML = state.disputes.length
    ? state.disputes
        .map(
          (item) => `
            <div class="dispute-item">
              <div>
                <strong>${item.title}</strong>
                <span>${item.time} · ${item.confidence}% confidence</span>
              </div>
              <span>${item.note}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="empty-state">No AI rulings saved yet</div>`;
}

function matchSnapshot() {
  const winner = [...state.players].sort((a, b) => b.score - a.score)[0];
  return {
    id: `match-${Date.now()}`,
    group: state.group,
    rule: state.rule,
    roomCode: state.roomCode,
    winner: `${winner.name} ${money(winner.score)}`,
    rounds: state.rounds.length,
    disputes: state.disputes.length,
    players: state.players.map((player) => ({
      name: player.name,
      score: player.score,
      badge: player.badge,
      wind: player.wind,
    })),
    roundArchive: state.rounds.map((round) => ({ ...round })),
    time: new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
  };
}

function finishMatch() {
  if (state.matchStatus === "finished") {
    routeTo("me");
    return;
  }
  const button = $("#endMatchBtn");
  if (!state.rounds.length) {
    if (button) button.textContent = "Record a hand before ending";
    return;
  }
  const snapshot = matchSnapshot();
  state.histories = state.histories.filter((item) => item.id !== snapshot.id);
  state.histories.unshift(snapshot);
  state.lastFinishedMatchId = snapshot.id;
  state.matchStatus = "finished";
  saveToStorage();
  render();
  routeTo("me");
}

function continueRound() {
  if (state.matchStatus === "finished") {
    routeTo("settle");
    return;
  }
  state.players.forEach((player, index) => {
    player.lastDelta = 0;
    player.wind = winds[(index + state.rounds.length) % winds.length];
  });
  saveToStorage();
  routeTo("settle");
  $("#directAmount").value = "";
  $("#multiplierInput").value = 2;
  renderFanPicker();
  calculatePayments();
}

function renderHeaderData() {
  const round = state.matchStatus === "finished" ? Math.max(1, state.rounds.length) : state.rounds.length + 1;
  const leader = [...state.players].sort((a, b) => b.score - a.score)[0];
  if ($("#homeRound")) $("#homeRound").textContent = round;
  if ($("#homeNet")) $("#homeNet").textContent = point(leader.score);
  if ($("#roomCodeText")) $("#roomCodeText").textContent = state.roomCode;
  if ($("#roomRule")) $("#roomRule").textContent = state.rule;
  if ($("#roundNumber")) $("#roundNumber").textContent = round;
  if ($("#settleRoundNumber")) $("#settleRoundNumber").textContent = round;
  if ($("#createRoomCode")) $("#createRoomCode").textContent = state.roomCode;
  if ($("#inviteCode")) $("#inviteCode").textContent = state.roomCode;
}

function renderBottomNav() {
  const groups = {
    home: ["home", "create", "join", "invite"],
    settle: ["settle"],
    me: ["me", "room", "ai", "summary", "history"],
  };
  $$(".bottom-nav [data-route]").forEach((button) => {
    const group = groups[button.dataset.route] || [button.dataset.route];
    button.classList.toggle("active", group.includes(state.route));
  });
}

function renderJoinPreview() {
  const preview = $("#joinPreview");
  if (!preview) return;
  preview.innerHTML = state.players
    .map(
      (player) => `
        <div class="rank-item">
          <span>${player.name}</span>
          <strong>${point(player.score)}</strong>
        </div>
      `,
    )
    .join("");
}

function render() {
  renderHeaderData();
  renderQr();
  renderPlayerEditor();
  renderAvatarPicker();
  renderFriends();
  renderRanks();
  renderScoreboard();
  renderLedger();
  renderHighlights();
  renderSelects();
  renderPayments();
  renderAi();
  renderSummary();
  renderHistory();
  renderSettleBand();
  renderRecentMatch();
  renderRoundArchive();
  renderDisputes();
  renderJoinPreview();
  renderBottomNav();
}

function bindEvents() {
  $$("[data-route]").forEach((button) => {
    button.dataset.boundDirect = "true";
    button.addEventListener("click", () => routeTo(button.dataset.route));
  });

  document.addEventListener("click", (event) => {
    const routeButton = event.target.closest("[data-route]");
    if (routeButton && !routeButton.dataset.boundDirect) {
      routeTo(routeButton.dataset.route);
    }

    if (event.target.closest("[data-back]")) {
      goBack();
    }

    const avatar = event.target.closest("[data-avatar]");
    if (avatar) {
      state.selectedAvatar = Number(avatar.dataset.avatar);
      renderAvatarPicker();
    }

    const fan = event.target.closest("[data-fan]");
    if (fan) {
      fan.classList.toggle("active");
      calculatePayments();
    }

    const shareButton = event.target.closest(".share-download");
    if (shareButton) {
      shareButton.textContent = "Share card ready; press and hold to save";
    }
  });

  document.addEventListener("input", (event) => {
    const input = event.target;
    if (input.matches("[data-player-name]")) {
      const player = playerById(input.dataset.playerName);
      player.name = input.value.trim() || player.name;
      saveToStorage();
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-player-name]")) {
      render();
    }
  });

  $("#createRoomBtn").addEventListener("click", () => {
    state.rule = $("#ruleSelect").value;
    state.baseScore = Number($("#baseScore").value || 2);
    state.cap = Number($("#capSelect").value || 0);
    state.roundLimit = Number($("#roundLimitSelect")?.value || 8);
    state.group = $("#groupSelect").value;
    generateRoomCode();
    resetCurrentMatch();
    saveToStorage();
    render();
    routeTo("invite");
  });

  $("#joinRoomBtn").addEventListener("click", () => {
    if (state.matchStatus === "finished") resetCurrentMatch();
    const name = $("#joinName").value.trim();
    if (name) {
      const player = state.players[1];
      player.name = name;
      player.color = avatarColors[state.selectedAvatar];
    }
    state.roomCode = ($("#joinCode").value.trim() || state.roomCode).toUpperCase();
    saveToStorage();
    routeTo("settle");
  });

  $("#winnerSelect").addEventListener("change", () => {
    renderSelects();
    calculatePayments();
  });
  $("#payerMode").addEventListener("change", calculatePayments);
  $("#loserSelect").addEventListener("change", calculatePayments);
  $("#multiplierInput").addEventListener("input", calculatePayments);
  $("#directAmount").addEventListener("input", calculatePayments);
  $("#calcSettleBtn").addEventListener("click", calculatePayments);
  $("#confirmSettleBtn").addEventListener("click", confirmSettle);

  $("#handImageInput").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    $("#uploadLabel").textContent = file ? file.name : "Upload a hand photo";
  });
  $("#runAiBtn").addEventListener("click", () => {
    state.aiIndex += 1;
    renderAi();
  });
  $("#applyAiBtn").addEventListener("click", applyAiToSettle);
  $("#saveDisputeBtn").addEventListener("click", saveDispute);
  $("#saveMatchBtn").addEventListener("click", finishMatch);
  $("#newRoundBtn").addEventListener("click", continueRound);
  $("#endMatchBtn").addEventListener("click", finishMatch);
}

loadFromStorage();
renderFanPicker();
bindEvents();
calculatePayments();
render();
routeTo("home", false);
console.info(`Que Ding ${VERSION} ready`);
