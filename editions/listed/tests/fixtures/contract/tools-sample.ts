import { z } from 'zod';

// A cut-down registry in the same shapes as lib/threadify-mcp/tools.ts.
const ENVELOPE = {
  request_id: z.string().optional().describe('Tracing id, e.g. "a,b" or (c).'),
};
const kindEnum = z.enum(['a', 'b']).describe('Kind.');
const maybeKind = kindEnum.optional();
const SHARED = {
  ...ENVELOPE,
  when: z.string().describe('When; "tomorrow 9am" // not a comment'),
  kind: maybeKind,
};

export const THREADIFY_MCP_TOOLS = [
  tool(
    'read_thing',
    'Read Thing',
    'Reads a thing. Read-only.',
    z.object({ ...ENVELOPE, thing_id: z.string().describe('The id.') }),
    { examples: [{ thing_id: 't_1' }] },
  ),
  tool(
    'write_thing',
    'Write Thing',
    "Writes a thing (it's public).",
    z.object({
      ...SHARED,
      body: z.object({ text: z.string().optional() }).describe('Body; its inner field is optional.'),
      count: z.number().int().default(3).describe('Count.'),
      tags: z.array(z.string().describe('tag')).optional(),
    }),
    {
      /* explicit hints */
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
      examples: [{ when: 'now', body: {} }],
    },
  ),
] as const;
