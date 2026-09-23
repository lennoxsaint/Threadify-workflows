const assert = (value, message) => {
  if (!value) throw new Error(message);
};

export function validateAutomation(value, plug = false, draft = false) {
  if (value === null) return;
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'Invalid automation.');
  const allowed = plug
    ? ['content', 'trigger', 'delay_minutes', 'likes_threshold']
    : ['trigger', 'delay_minutes', 'likes_threshold'];
  assert(
    Object.keys(value).every((key) => allowed.includes(key)),
    'Unknown automation field.',
  );
  assert(['time', 'likes'].includes(value.trigger), 'Choose a time or likes trigger.');
  if (plug)
    assert(
      typeof value.content === 'string' &&
        (draft || value.content.trim().length > 0) &&
        [...value.content].length <= (draft ? 20000 : 500),
      'Auto Plug needs 1–500 characters.',
    );
  const key = value.trigger === 'time' ? 'delay_minutes' : 'likes_threshold';
  assert(
    draft ? Number.isFinite(value[key]) : Number.isSafeInteger(value[key]) && value[key] >= (key === 'delay_minutes' ? 5 : 1),
    'Invalid automation trigger value.',
  );
  assert(
    value[key === 'delay_minutes' ? 'likes_threshold' : 'delay_minutes'] === undefined,
    'Use only the selected trigger.',
  );
}

export function validateGlobalRepost(value) {
  assert(
    value && typeof value.known === 'boolean' && typeof value.enabled === 'boolean',
    'Explicit account-wide Auto Repost state required.',
  );
  assert(
    Object.keys(value).every((key) =>
      ['known', 'enabled', 'trigger', 'delay_minutes', 'likes_threshold'].includes(key),
    ),
    'Unknown account-wide Auto Repost field.',
  );
  if (value.enabled) {
    assert(
      value.known && ['time', 'likes'].includes(value.trigger),
      'Enabled account-wide Auto Repost requires known settings.',
    );
    const key = value.trigger === 'time' ? 'delay_minutes' : 'likes_threshold';
    assert(
      Number.isSafeInteger(value[key]) && value[key] >= (value.trigger === 'time' ? 5 : 1),
      'Invalid account-wide Auto Repost trigger.',
    );
  }
}
