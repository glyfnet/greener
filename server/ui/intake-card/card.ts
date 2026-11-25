/**
 * Question card (MCP App, Section 7.3, FR-07, FR-08).
 *
 * Talks to the host with JSON-RPC 2.0 over postMessage, as defined by the
 * MCP Apps extension (`ui/initialize`, `ui/notifications/tool-result`,
 * `tools/call`, `ui/update-model-context`, `ui/message`,
 * `ui/notifications/size-changed`). No framework and no
 * network access of its own: every answer goes through the `save_answer`
 * tool on the Greener server.
 *
 * Icons are text placeholders until the icon set is chosen (Q-14).
 */

/** Inlined at build time from server/src/core/yaml.ts (D-24). */
declare function toYaml(value: unknown): string;

interface Option { id: string; label: string; icon?: string }
interface QuestionData { id: string; number: number; text: string; kind: "choice" | "location"; select: "one" | "many" | "upTo3"; notSure: boolean; options: Option[] }
interface CardData { complete?: boolean; profile?: unknown; question?: QuestionData; progress?: { index: number; total: number }; followUps?: string[] }
interface RpcMessage { jsonrpc: "2.0"; id?: number; method?: string; params?: Record<string, unknown>; result?: Record<string, unknown>; error?: { message?: string } }

const PROTOCOL_VERSION = "2026-01-26";
const app = document.getElementById("app") as HTMLElement;
let nextId = 1;
const pending = new Map<number, { resolve: (v: Record<string, unknown>) => void; reject: (e: Error) => void }>();
let state: CardData = {};
let selected = new Set<string>();
const answeredIds: string[] = [];
const skipped: string[] = [];

function send(msg: RpcMessage): void {
  window.parent.postMessage(msg, "*");
}

/**
 * Tell the host how tall the card is, so the iframe is not cut off. The MCP
 * Apps spec (2026-01-26) says a View SHOULD send this when its size changes.
 */
let lastSize = "";
function reportSize(): void {
  const r = document.body.getBoundingClientRect();
  const size = { width: Math.ceil(r.width), height: Math.ceil(r.height) };
  const key = `${size.width}x${size.height}`;
  if (key === lastSize) return;
  lastSize = key;
  send({ jsonrpc: "2.0", method: "ui/notifications/size-changed", params: size });
}

function request(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
  const id = nextId++;
  send({ jsonrpc: "2.0", id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== window.parent) return;
  const msg = event.data as RpcMessage;
  if (!msg || msg.jsonrpc !== "2.0") return;
  if (msg.id !== undefined && !msg.method) {
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error.message ?? "Request failed"));
    else p.resolve(msg.result ?? {});
    return;
  }
  if (msg.method === "ui/notifications/tool-result") onToolResult(msg.params ?? {});
});

function onToolResult(result: Record<string, unknown>): void {
  if (result.isError) {
    const sc = result.structuredContent as { error?: string; fixHints?: string[] } | undefined;
    showError(sc?.error ?? "Something went wrong.", sc?.fixHints);
    return;
  }
  const sc = result.structuredContent as CardData | undefined;
  if (sc) {
    state = sc;
    selected = new Set();
    render();
  }
}

async function callTool(name: string, args: Record<string, unknown>): Promise<void> {
  setBusy(true);
  try {
    const result = await request("tools/call", { name, arguments: args });
    onToolResult(result);
    if (!result.isError && state.profile) {
      // Keep Claude's view of the profile current without starting a turn.
      // Sent as text as well, because a host may pass only `content` to the model.
      await request("ui/update-model-context", { content: [{ type: "text", text: `Greener site profile so far (YAML):\n${toYaml(state.profile)}` }], structuredContent: { profile: state.profile } }).catch(() => undefined);
    }
    if (state.complete && state.profile) {
      // The server keeps nothing (D-09), so the finished profile must travel in
      // the message itself: model context updates are not delivered by every host.
      await request("ui/message", { role: "user", content: [{ type: "text", text: completionMessage(state.profile) }] }).catch(() => undefined);
    }
  } catch (e) {
    showError(e instanceof Error ? e.message : "The answer could not be saved.");
  } finally {
    setBusy(false);
  }
}

/** The message the card sends when every question is answered. It carries the whole profile. */
function completionMessage(profile: unknown): string {
  return `I have answered all the questions in the card. Here is my site profile. Use it for save_profile:\n\n\`\`\`yaml\n${toYaml(profile)}\`\`\``;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

function setBusy(busy: boolean): void {
  app.setAttribute("aria-busy", String(busy));
  app.querySelectorAll("button, input").forEach((b) => ((b as HTMLButtonElement).disabled = busy));
}

function showError(message: string, hints: string[] = []): void {
  app.querySelector(".err")?.remove();
  const box = el("p", { class: "msg err", role: "alert" }, [message, ...hints].join(" "));
  app.appendChild(box);
}

function answer(payload: { optionIds?: string[]; other?: string; notSure?: boolean }, location?: { lat: number; lon: number }): void {
  const q = state.question;
  if (!q) return;
  answeredIds.push(q.id);
  void callTool("save_answer", {
    ...(state.profile ? { profile: state.profile } : {}),
    questionId: q.id,
    answer: { optionIds: payload.optionIds ?? [], ...(payload.other ? { other: payload.other } : {}), ...(payload.notSure ? { notSure: true } : {}) },
    ...(location ? { location: { lat: location.lat, lon: location.lon, precision: "exact" } } : {}),
  });
}

function useMyLocation(): void {
  if (!navigator.geolocation) return showError("This app can't read your location here. Type a suburb or postcode instead.");
  navigator.geolocation.getCurrentPosition(
    (pos) => answer({ optionIds: ["use_my_location"] }, { lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => showError("Your location was not shared. Type a suburb or postcode instead."),
    { timeout: 10000 },
  );
}

function otherBox(placeholder: string, onSubmit: (text: string) => void): HTMLElement {
  // Only one answer box at a time, however often Other is tapped.
  app.querySelector("form.other")?.remove();
  const row = el("form", { class: "row other" });
  const label = el("label", { class: "sr", for: "other" }, placeholder);
  const input = el("input", { type: "text", id: "other", maxlength: "500", placeholder });
  const ok = el("button", { type: "submit", class: "primary" }, "Save");
  row.append(label, input, ok);
  row.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (text) onSubmit(text);
  });
  setTimeout(() => input.focus(), 0);
  return row;
}

function render(): void {
  app.replaceChildren();
  if (state.complete) {
    app.append(el("h1", {}, "All done. Thank you!"), el("p", {}, "Claude will now check your answers and save your site profile."));
    for (const f of state.followUps ?? []) app.append(el("p", { class: "msg" }, f));
    return;
  }
  const q = state.question;
  const p = state.progress;
  if (!q || !p) {
    app.append(el("p", {}, "Waiting for a question…"));
    return;
  }
  const top = el("div", { class: "top" });
  const bar = el("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(p.total), "aria-valuenow": String(p.index), "aria-label": "Progress" });
  const fill = el("span");
  fill.style.width = `${Math.round((100 * p.index) / p.total)}%`;
  bar.append(fill);
  top.append(el("span", {}, `Question ${p.index} of ${p.total}`), bar);
  const heading = el("h1", { id: "q" }, q.text);
  const grid = el("div", { class: "grid", role: "group", "aria-labelledby": "q" });
  const multi = q.select !== "one";
  const max = q.select === "upTo3" ? 3 : q.options.length;
  for (const o of q.options) {
    const b = el("button", { type: "button", class: "opt", "aria-pressed": String(selected.has(o.id)) });
    if (o.icon) b.append(el("span", { class: "icon", "aria-hidden": "true" }, `[${o.icon}]`));
    b.append(document.createTextNode(o.label));
    b.addEventListener("click", () => {
      if (q.kind === "location") {
        if (o.id === "use_my_location") useMyLocation();
        else app.append(otherBox("Suburb or postcode", (text) => answer({ optionIds: ["type_place"], other: text })));
        return;
      }
      if (!multi) return answer({ optionIds: [o.id] });
      if (selected.has(o.id)) selected.delete(o.id);
      else if (selected.size < max) selected.add(o.id);
      b.setAttribute("aria-pressed", String(selected.has(o.id)));
    });
    grid.append(b);
  }
  const row = el("div", { class: "row" });
  const other = el("button", { type: "button", class: "secondary" }, "Other (type an answer)");
  other.addEventListener("click", () => app.append(otherBox("Type your answer", (text) => answer({ optionIds: [...selected], other: text }))));
  row.append(other);
  if (q.notSure) {
    const ns = el("button", { type: "button", class: "secondary" }, "Not sure");
    ns.addEventListener("click", () => answer({ notSure: true }));
    row.append(ns);
  }
  if (multi) {
    const done = el("button", { type: "button", class: "primary" }, "Done");
    done.addEventListener("click", () => (selected.size ? answer({ optionIds: [...selected] }) : showError("Pick at least one option, or use Other.")));
    row.append(done);
  }
  row.append(el("span", { class: "spacer" }));
  const back = el("button", { type: "button", class: "link" }, "Back");
  back.disabled = answeredIds.length === 0;
  back.addEventListener("click", () => {
    const prev = answeredIds.pop();
    if (prev) void callTool("ask_question", { ...(state.profile ? { profile: state.profile } : {}), questionId: prev });
  });
  const skip = el("button", { type: "button", class: "link" }, "Skip");
  skip.addEventListener("click", () => {
    skipped.push(q.id);
    answeredIds.push(q.id);
    void callTool("ask_question", { ...(state.profile ? { profile: state.profile } : {}), skipIds: skipped });
  });
  row.append(back, skip);
  app.append(top, heading, grid, row);
}

async function start(): Promise<void> {
  try {
    await request("ui/initialize", { appInfo: { name: "greener-intake-card", version: "0.1.0" }, appCapabilities: {}, protocolVersion: PROTOCOL_VERSION });
    send({ jsonrpc: "2.0", method: "ui/notifications/initialized", params: {} });
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(reportSize).observe(document.body);
    reportSize();
  } catch {
    app.replaceChildren(el("p", {}, "This host can't show the question card. Answer in the chat instead."));
  }
}

void start();
