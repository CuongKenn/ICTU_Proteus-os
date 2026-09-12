// IT Helpdesk Module — Tri thức: search + xem + CRUD bài viết.
import React, { useCallback, useEffect, useState } from 'react';
import type { ItCategory, KnowledgeArticle } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Btn, C, DataSourceBar, InlineError, Input, Modal, Select, SimpleBadge, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function KnowledgePage() {
  const { mode, store, reason, message } = useStore();
  const [rows, setRows] = useState<KnowledgeArticle[]>([]);
  const [cats, setCats] = useState<ItCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<KnowledgeArticle | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [k, c] = await Promise.all([store.listKnowledge(), store.listCategories()]);
      setRows(k);
      setCats(c);
    } catch (e) {
      setError(errText(e));
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = async (fn: () => Promise<unknown>) => {
    if (!store) return;
    setError(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setError(errText(e));
    }
  };

  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? '—';
  const filtered = rows.filter((k) => {
    const q = search.trim().toLowerCase();
    return (
      (!q || k.title.toLowerCase().includes(q) || k.content_md.toLowerCase().includes(q)) &&
      (filter === ALL || k.category_id === filter)
    );
  });

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo tiêu đề, nội dung...">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value={ALL}>Mọi danh mục</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Viết bài</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Bài viết / Tác giả</th>
            <th style={th}>Danh mục</th>
            <th style={th}>Lượt xem</th>
            <th style={th}>Xuất bản</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((k) => (
            <React.Fragment key={k.id}>
              <tr>
                <td style={td}>
                  <b
                    style={{ cursor: 'pointer', color: C.text }}
                    onClick={() => setOpenId(openId === k.id ? null : k.id)}
                  >
                    {k.title}
                  </b>
                  <div style={{ color: C.muted, fontSize: '.78rem' }}>{k.author_name}</div>
                </td>
                <td style={td}>{catName(k.category_id)}</td>
                <td style={td}>{k.view_count}</td>
                <td style={td}>
                  <SimpleBadge
                    text={k.is_published ? 'Đã xuất bản' : 'Nháp'}
                    color={k.is_published ? '#22c55e' : '#f59e0b'}
                  />
                </td>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>
                  <button onClick={() => setEditing(k)} style={link}>Sửa</button>{' '}
                  <button
                    onClick={() =>
                      mutate(() => store!.updateKnowledge(k.id, { is_published: !k.is_published }))
                    }
                    style={link}
                  >
                    {k.is_published ? 'Gỡ' : 'Xuất bản'}
                  </button>{' '}
                  <button
                    onClick={() => {
                      if (confirm(`Xóa "${k.title}"?`)) mutate(() => store!.removeKnowledge(k.id));
                    }}
                    style={{ ...link, color: C.red }}
                  >
                    Xóa
                  </button>
                </td>
              </tr>
              {openId === k.id && (
                <tr>
                  <td style={{ ...td, background: '#0b1220', whiteSpace: 'pre-wrap' }} colSpan={5}>
                    {k.content_md}
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có bài viết phù hợp.</p>}

      {showCreate && (
        <ArticleForm
          title="Viết bài mới"
          categories={cats}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.createKnowledge(v);
              setShowCreate(false);
            })
          }
        />
      )}
      {editing && (
        <ArticleForm
          title={`Sửa: ${editing.title}`}
          initial={editing}
          categories={cats}
          onClose={() => setEditing(null)}
          onSubmit={(v) =>
            mutate(async () => {
              await store!.updateKnowledge(editing.id, v);
              setEditing(null);
            })
          }
        />
      )}
    </div>
  );
}

const link: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#38bdf8',
  cursor: 'pointer',
  padding: 0,
  fontSize: '.85rem',
};

function ArticleForm(props: {
  title: string;
  initial?: KnowledgeArticle;
  categories: ItCategory[];
  onClose: () => void;
  onSubmit: (v: {
    title: string;
    content_md: string;
    category_id: string;
    author_name: string;
    is_published: boolean;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(props.initial?.title ?? '');
  const [content_md, setContent] = useState(props.initial?.content_md ?? '');
  const [category_id, setCat] = useState(
    props.initial?.category_id ?? props.categories[0]?.id ?? '',
  );
  const [author_name, setAuthor] = useState(props.initial?.author_name ?? '');
  const [is_published, setPub] = useState(props.initial?.is_published ?? true);
  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Tiêu đề bài viết" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Select value={category_id} onChange={(e) => setCat(e.target.value)}>
          {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <textarea
          placeholder="Nội dung (markdown)..."
          value={content_md}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          style={{
            width: '100%',
            background: '#0b1220',
            border: `1px solid ${C.line}`,
            color: C.text,
            borderRadius: 8,
            padding: '.55rem .8rem',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        <Input placeholder="Tác giả" value={author_name} onChange={(e) => setAuthor(e.target.value)} />
        <label style={{ color: C.text, fontSize: '.85rem', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <input type="checkbox" checked={is_published} onChange={(e) => setPub(e.target.checked)} />
          Xuất bản ngay
        </label>
        <Btn
          primary
          disabled={!title.trim()}
          onClick={() =>
            props.onSubmit({
              title: title.trim(),
              content_md,
              category_id,
              author_name: author_name.trim() || 'Quản trị IT',
              is_published,
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}
