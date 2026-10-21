/**
 * A reply is stored inside the message text itself (the chat API has no "reply to" field):
 * an invisible-separator header with the quoted message's id, author and a short snippet,
 * then the new text. Everything here only reads and writes that header.
 */
const SEP = '⁣';
const MARK = `${SEP}${SEP}R${SEP}`;

export interface ReplyRef {
  id: string;
  name: string;
  snippet: string;
}

export function splitReply(text: string | undefined): { reply?: ReplyRef; body: string } {
  const t = text || '';
  if (!t.startsWith(MARK)) return { body: t };
  const end = t.indexOf('\n');
  const header = (end === -1 ? t : t.slice(0, end)).slice(MARK.length).split(SEP);
  const [id, name, snippet] = header;
  if (!id) return { body: t };
  return { reply: { id, name: name || '', snippet: snippet || '' }, body: end === -1 ? '' : t.slice(end + 1) };
}

export function withReply(reply: ReplyRef | undefined, body: string): string {
  if (!reply) return body;
  const clean = (v: string) => v.replace(/[⁣\n]/g, ' ');
  return `${MARK}${reply.id}${SEP}${clean(reply.name)}${SEP}${clean(reply.snippet).slice(0, 60)}${SEP}\n${body}`;
}
