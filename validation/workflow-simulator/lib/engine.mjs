// Generic driver engine: walks a workflow the same way every manifest in this repo describes
// itself — read connection defaults, gather/validate data, stop for explicit approval before any
// state-changing tool, then (best-effort) read back and record feedback. One engine + a small
// declarative config per workflow (see workflow-configs.mjs) instead of seven hand-written drivers,
// so the safety invariant ("no mutating tool before approval, ever") is enforced in exactly one
// place rather than re-implemented per workflow.
//
// Three workflow `kind`s:
//   - "schedule": gathers data, then schedule_post (or equivalent) behind the approval gate.
//   - "memory":   gathers context, then remember (behind the approval gate), then a best-effort
//                 readback to verify retention.
//   - "draft-only": never calls a mutating tool at all (crosspost / x-article v0) — always hands
//                 back a packet for a human to act on manually.
//
// A tool failure BEFORE or AT the mutating call is fatal -> fallback. A tool failure AFTER the
// mutating call (readback, feedback) is best-effort and must not erase a mutation that already
// happened — this matches the manifests' own language ("record feedback... if the surface
// supports it", "scheduling proof is not publishing proof").

export async function runWorkflow(client, config, { approve }) {
  try {
    await client.call('get_connection_defaults');
    for (const tool of config.dataTools ?? []) await client.call(tool);

    if (config.kind === 'draft-only') {
      try {
        if (config.feedbackTool) await client.call(config.feedbackTool);
      } catch {
        // best-effort: feedback recording failing must not block the draft packet
      }
      return { outcome: 'draft', approve };
    }

    if (!approve) {
      return { outcome: 'fallback', reason: 'awaiting_explicit_approval' };
    }

    await client.call(config.mutatingTool);

    if (config.kind === 'memory') {
      let readbackOk = true;
      try {
        await client.call(config.readbackTool);
      } catch {
        readbackOk = false;
      }
      try {
        if (config.feedbackTool) await client.call(config.feedbackTool);
      } catch {
        // best-effort
      }
      return { outcome: 'written', readbackOk };
    }

    // "schedule" kind
    for (const tool of config.postTools ?? []) {
      try {
        await client.call(tool);
      } catch {
        // best-effort readback
      }
    }
    try {
      if (config.feedbackTool) await client.call(config.feedbackTool);
    } catch {
      // best-effort
    }
    return { outcome: 'scheduled' };
  } catch (err) {
    return { outcome: 'fallback', reason: err.message };
  }
}

/** Tools whose failure MUST be fatal (drive a fallback) for this config — everything up to and
 * including the mutating call. Used by the simulator to know which failure-injection runs should
 * assert a fallback outcome vs. a best-effort-swallowed one. */
export function criticalTools(config) {
  const tools = ['get_connection_defaults', ...(config.dataTools ?? [])];
  if (config.kind !== 'draft-only') tools.push(config.mutatingTool);
  return tools;
}

/** The set of tools that mutate Threadify/account state for this config (empty for draft-only). */
export function mutatingTools(config) {
  return config.mutatingTool ? [config.mutatingTool] : [];
}
