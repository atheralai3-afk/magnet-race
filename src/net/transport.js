// Transport abstraction: a Channel has broadcast messages + presence (who is here).
// LocalTransport runs everything in one page (tests, pass-and-play); SupabaseTransport uses Supabase Realtime.
//
// Channel API:
//   send(type, payload)          broadcast to everyone else on the channel
//   on(type, fn) / off(type, fn) receive broadcasts (fn(payload, meta))
//   track(state)                 publish my presence state
//   presence()                   -> [{key, ...state}] everyone currently on the channel (including me)
//   onPresence(fn)               fn(list) whenever presence changes
//   leave()

class Emitter {
  constructor() { this.h = new Map(); }
  on(t, f) { (this.h.get(t) || this.h.set(t, new Set()).get(t)).add(f); return () => this.off(t, f); }
  off(t, f) { this.h.get(t)?.delete(f); }
  emit(t, ...a) { for (const f of [...(this.h.get(t) || [])]) f(...a); }
}

// ---------------------------------------------------------------- local (in-memory) transport
const hubs = new Map(); // channelName -> Set<LocalChannel>

export class LocalTransport {
  constructor(clientId) { this.clientId = clientId || 'c' + Math.random().toString(36).slice(2, 8); this.latency = 0; }
  async join(name) { return new LocalChannel(name, this.clientId, this.latency); }
}
class LocalChannel {
  constructor(name, key, latency) {
    this.name = name; this.key = key; this.latency = latency; this.em = new Emitter(); this.state = null; this.presenceHandlers = new Set();
    if (!hubs.has(name)) hubs.set(name, new Set());
    hubs.get(name).add(this);
    this._notifyAll();
  }
  _peers() { return [...(hubs.get(this.name) || [])]; }
  _deliver(fn) { if (this.latency) setTimeout(fn, this.latency); else queueMicrotask(fn); }
  send(type, payload) { for (const ch of this._peers()) if (ch !== this) this._deliver(() => ch.em.emit(type, payload, { from: this.key })); }
  on(type, fn) { return this.em.on(type, fn); }
  off(type, fn) { this.em.off(type, fn); }
  track(state) { this.state = { ...state }; this._notifyAll(); }
  presence() { return this._peers().filter(c => c.state).map(c => ({ key: c.key, ...c.state })); }
  onPresence(fn) { this.presenceHandlers.add(fn); fn(this.presence()); return () => this.presenceHandlers.delete(fn); }
  _notifyAll() { for (const ch of this._peers()) { const list = ch.presence(); this._deliver(() => ch.presenceHandlers.forEach(f => f(list))); } }
  leave() { hubs.get(this.name)?.delete(this); this.state = null; this._notifyAll(); }
}

// ---------------------------------------------------------------- Supabase Realtime transport
export class SupabaseTransport {
  // client: a supabase-js client (createClient(url, anonKey)); clientId: stable id for this browser tab
  constructor(client, clientId) { this.client = client; this.clientId = clientId; }
  async join(name) {
    const ch = this.client.channel(name, { config: { broadcast: { self: false, ack: false }, presence: { key: this.clientId } } });
    const em = new Emitter(); const presenceHandlers = new Set(); let state = null;
    const flat = () => Object.entries(ch.presenceState()).map(([key, metas]) => ({ key, ...(metas[metas.length - 1] || {}) }));
    ch.on('broadcast', { event: '*' }, ({ event, payload }) => em.emit(event, payload?.p, { from: payload?.from }));
    ch.on('presence', { event: 'sync' }, () => presenceHandlers.forEach(f => f(flat())));
    await new Promise((res, rej) => ch.subscribe(status => { if (status === 'SUBSCRIBED') res(); else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') rej(new Error(status)); }));
    const key = this.clientId;
    return {
      name, key,
      send: (type, payload) => ch.send({ type: 'broadcast', event: type, payload: { p: payload, from: key } }),
      on: (t, f) => em.on(t, f), off: (t, f) => em.off(t, f),
      track: async (s) => { state = s; await ch.track(s); },
      presence: flat,
      onPresence: (f) => { presenceHandlers.add(f); f(flat()); return () => presenceHandlers.delete(f); },
      leave: () => this.client.removeChannel(ch),
    };
  }
}

// Builds a transport from config: Supabase when configured, otherwise local.
export async function makeTransport(config, clientId) {
  if (config?.supabaseUrl && config?.supabaseAnonKey) {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    return new SupabaseTransport(createClient(config.supabaseUrl, config.supabaseAnonKey), clientId);
  }
  return new LocalTransport(clientId);
}
export const isOnline = (config) => !!(config?.supabaseUrl && config?.supabaseAnonKey);
