/**
 * Converts a few Sample Game 1 frames (Metrica Sports CSV) into compact JSON.
 * Source CSVs stay outside the app (TEMP or METRICA_DIR). Not bundled.
 *
 * Usage:
 *   node scripts/prepare-football-scanning.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source =
  process.env.METRICA_DIR ??
  join(process.env.TEMP ?? "/tmp", "metrica-sample-data", "data", "Sample_Game_1");

const PITCH_W = 105;
const PITCH_H = 68;

function finiteCoord(value) {
  return Number.isFinite(value);
}

/** Ball must sit on the pitch. A few centimetres of tracking noise is allowed. */
function ballOnPitch(value, axis) {
  const slack = axis === "x" ? 0.01 : 0.015;
  return finiteCoord(value) && value >= -slack && value <= 1 + slack;
}

/** Players may be a few metres off the touchline and still be drawn in the padding. */
function playerDrawable(x, y) {
  return finiteCoord(x) && finiteCoord(y) && x >= -0.04 && x <= 1.04 && y >= -0.06 && y <= 1.06;
}

function parseTeam(file, teamId) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const numbers = lines[1].split(",");
  const headers = lines[2].split(",");
  const players = [];
  for (let i = 3; i < headers.length - 1; i += 2) {
    if (!headers[i]?.startsWith("Player")) continue;
    players.push({
      playerId: numbers[i],
      xIndex: i,
      yIndex: i + 1,
    });
  }
  const ballX = headers.lastIndexOf("Ball");
  if (ballX < 0) throw new Error(`Ball column not found in ${file}`);
  const frames = [];
  for (const line of lines.slice(3)) {
    const cells = line.split(",");
    const ballXValue = Number(cells[ballX]);
    const ballYValue = Number(cells[ballX + 1]);
    if (!ballOnPitch(ballXValue, "x") || !ballOnPitch(ballYValue, "y")) continue;
    const onPitch = [];
    let hidden = false;
    for (const player of players) {
      const x = Number(cells[player.xIndex]);
      const y = Number(cells[player.yIndex]);
      if (!finiteCoord(x) || !finiteCoord(y)) continue;
      if (!playerDrawable(x, y)) {
        hidden = true;
        break;
      }
      onPitch.push({
        playerId: player.playerId,
        teamId,
        x,
        y,
      });
    }
    if (hidden) continue;
    frames.push({
      period: Number(cells[0]),
      frame: Number(cells[1]),
      time: Number(cells[2]),
      ball: { x: ballXValue, y: ballYValue },
      players: onPitch,
    });
  }
  return frames;
}

function meters(a, b) {
  const dx = (a.x - b.x) * PITCH_W;
  const dy = (a.y - b.y) * PITCH_H;
  return Math.hypot(dx, dy);
}

function analyze(frame) {
  const players = frame.players;
  const ranked = [...players].sort(
    (a, b) => meters(a, frame.ball) - meters(b, frame.ball) || a.playerId.localeCompare(b.playerId),
  );
  const closest = ranked[0];
  const closestGap = meters(ranked[1], frame.ball) - meters(closest, frame.ball);
  const defenders = ranked.filter((player) => player.teamId !== closest.teamId);
  const defender = defenders[0];
  const defenderGap =
    meters(defenders[1], frame.ball) - meters(defender, frame.ball);
  const attackers = players.filter(
    (player) => player.teamId === closest.teamId && player.playerId !== closest.playerId,
  );
  const freeRanked = attackers
    .map((player) => {
      const nearestOpponent = players
        .filter((other) => other.teamId !== player.teamId)
        .reduce((best, other) => Math.min(best, meters(player, other)), Infinity);
      return { player, space: nearestOpponent };
    })
    .sort((a, b) => b.space - a.space || a.player.playerId.localeCompare(b.player.playerId));
  const free = freeRanked[0];
  const freeGap = free.space - freeRanked[1].space;
  return { closest, closestGap, defender, defenderGap, free: free.player, freeGap };
}

const home = parseTeam(
  join(source, "Sample_Game_1_RawTrackingData_Home_Team.csv"),
  "home",
);
const away = parseTeam(
  join(source, "Sample_Game_1_RawTrackingData_Away_Team.csv"),
  "away",
);
const awayByFrame = new Map(away.map((frame) => [frame.frame, frame]));

function separable(players) {
  for (let i = 0; i < players.length; i += 1) {
    for (let j = i + 1; j < players.length; j += 1) {
      if (meters(players[i], players[j]) < 3.4) return false;
    }
  }
  return true;
}

const merged = home
  .filter((frame) => frame.period === 1 && awayByFrame.has(frame.frame))
  .map((frame) => {
    const other = awayByFrame.get(frame.frame);
    const ballGap = meters(frame.ball, other.ball);
    return {
      ...frame,
      ballGap,
      players: [...frame.players, ...other.players],
    };
  })
  .filter((frame) => {
    const homeCount = frame.players.filter((player) => player.teamId === "home").length;
    const awayCount = frame.players.filter((player) => player.teamId === "away").length;
    return (
      frame.ballGap < 0.05 &&
      homeCount >= 10 &&
      awayCount >= 10 &&
      separable(frame.players)
    );
  });

const types = ["closest", "defender", "free"];
const picked = [];
const usedTimes = [];

for (const frame of merged) {
  if (picked.length >= 9) break;
  if (frame.time < 30) continue;
  if (usedTimes.some((time) => Math.abs(time - frame.time) < 25)) continue;
  const stats = analyze(frame);
  const type = types[picked.length % types.length];
  const gap =
    type === "closest" ? stats.closestGap : type === "defender" ? stats.defenderGap : stats.freeGap;
  if (gap < 1.2) continue;
  usedTimes.push(frame.time);
  picked.push({
    id: `g1-${frame.frame}`,
    matchId: "sample-game-1",
    challenge: type,
    period: frame.period,
    frame: frame.frame,
    time: frame.time,
    ball: {
      x: Number(frame.ball.x.toFixed(5)),
      y: Number(frame.ball.y.toFixed(5)),
    },
    players: frame.players.map((player) => ({
      playerId: player.playerId,
      teamId: player.teamId,
      x: Number(player.x.toFixed(5)),
      y: Number(player.y.toFixed(5)),
    })),
  });
}

const outDir = join(root, "lib", "tests", "football-visual-scanning");
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "sequences.json"),
  JSON.stringify(
    {
      source: "Metrica Sports sample-data / Sample Game 1",
      attribution: "Tracking data © Metrica Sports. https://github.com/metrica-sports/sample-data",
      pitch: { widthMeters: PITCH_W, heightMeters: PITCH_H, origin: "top-left", range: "0-1" },
      sequences: picked,
    },
    null,
    2,
  ),
);

console.log(`Wrote ${picked.length} sequences`);
for (const item of picked) {
  const stats = analyze(item);
  const answer =
    item.challenge === "closest"
      ? stats.closest
      : item.challenge === "defender"
        ? stats.defender
        : stats.free;
  console.log(
    `${item.time.toFixed(2)}s ${item.challenge} -> ${answer.teamId} #${answer.playerId}`,
  );
}
