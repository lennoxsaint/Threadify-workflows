import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';

const hash = (text) => createHash('sha256').update(text).digest('hex');
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };

export class LeadDeskReview {
  constructor(file) {
    requireThat(typeof file === 'string' && path.isAbsolute(file), 'absolute_state_file_required');
    this.file = path.resolve(file);
  }

  read() {
    const parent = fs.lstatSync(path.dirname(this.file));
    requireThat(parent.isDirectory() && !parent.isSymbolicLink() && (parent.mode & 0o077) === 0, 'private_state_directory_required');
    const info = fs.lstatSync(this.file);
    requireThat(info.isFile() && !info.isSymbolicLink() && (info.mode & 0o077) === 0, 'private_state_file_required');
    const state = JSON.parse(fs.readFileSync(this.file, 'utf8'));
    requireThat(state.version === 1 && state.desk?.workflow_id === 'anti-spam-lead-desk', 'invalid_review_state');
    requireThat(state.status !== 'final_for_review' || (typeof state.final_text === 'string' && state.final_text.trim() && hash(state.final_text) === state.final_hash), 'final_text_integrity_failed');
    return state;
  }

  initialize(desk) {
    requireThat(desk?.workflow_id === 'anti-spam-lead-desk', 'lead_desk_required');
    const fingerprint = hash(JSON.stringify({ cards: desk.cards, review_action: desk.review_action, account: desk.account, as_of: desk.as_of }));
    if (fs.existsSync(this.file)) {
      const current = this.read();
      requireThat(current.fingerprint === fingerprint, 'state_belongs_to_a_different_desk');
      return this.status();
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const parent = fs.lstatSync(path.dirname(this.file));
    requireThat(parent.isDirectory() && !parent.isSymbolicLink() && (parent.mode & 0o077) === 0, 'private_state_directory_required');
    const state = { version: 1, fingerprint, desk, revision: 0, status: 'draft', draft_text: desk.review_action?.exact_text ?? null, final_text: null, final_hash: null, finalized_at: null, send_performed: false };
    const fd = fs.openSync(this.file, 'wx', 0o600);
    try { fs.writeFileSync(fd, JSON.stringify(state, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return this.status();
  }

  status() {
    const state = this.read();
    return { version: state.version, fingerprint: state.fingerprint, account: state.desk.account.label, cards: state.desk.cards, review_action: state.desk.review_action ? { signal_id: state.desk.review_action.signal_id, type: state.desk.review_action.type, destination: state.desk.review_action.destination } : null, revision: state.revision, status: state.status, draft_text: state.draft_text, final_text: state.final_text, final_hash: state.final_hash, finalized_at: state.finalized_at, send_performed: false };
  }

  update(packet) {
    requireThat(['save', 'finalize'].includes(packet?.action), 'invalid_review_action');
    requireThat(Number.isInteger(packet.revision), 'revision_required');
    requireThat(typeof packet.text === 'string' && packet.text.length <= 2000, 'exact_text_required_max_2000');
    if (packet.action === 'finalize') requireThat(packet.text.trim(), 'nonblank_final_text_required');
    const lock = this.file + '.lock';
    let lockFd;
    try { lockFd = fs.openSync(lock, 'wx', 0o600); } catch (error) { if (error.code === 'EEXIST') throw new Error('review_state_locked'); throw error; }
    let temporary;
    try {
      const state = this.read();
      requireThat(state.desk.review_action, 'no_review_action');
      requireThat(state.revision === packet.revision, 'revision_conflict');
      state.revision += 1;
      state.draft_text = packet.text;
      state.status = packet.action === 'finalize' ? 'final_for_review' : 'draft';
      state.final_text = packet.action === 'finalize' ? packet.text : null;
      state.final_hash = packet.action === 'finalize' ? hash(packet.text) : null;
      state.finalized_at = packet.action === 'finalize' ? new Date().toISOString() : null;
      temporary = `${this.file}.${randomBytes(8).toString('hex')}.tmp`;
      const fd = fs.openSync(temporary, 'wx', 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(state, null, 2)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(temporary, this.file);
      return this.status();
    } finally {
      if (temporary && fs.existsSync(temporary)) fs.unlinkSync(temporary);
      fs.closeSync(lockFd);
      fs.unlinkSync(lock);
    }
  }
}
