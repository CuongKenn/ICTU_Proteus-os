// Asset Module — Tài sản: search/filter + CRUD + cấp phát/thu hồi.
import React, { useCallback, useEffect, useState } from 'react';
import { formatVND, type AssetItem, type AssetStatus } from '../types';
import { errText, reasonText, useStore } from '../lib/useStore';
import { Badge, Btn, C, DataSourceBar, InlineError, Input, Modal, Select, TableWrap, Toolbar, td, th } from '../components/ui';

const ALL = 'ALL';

export function AssetsPage() {
  const { mode, store, reason, message } = useStore();
  const [items, setItems] = useState<AssetItem[]>([]);
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>(ALL);
  const [cat, setCat] = useState<string>(ALL);
  const [editing, setEditing] = useState<AssetItem | null>(null);
  const [assigning, setAssigning] = useState<AssetItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    setError(null);
    try {
      const [it, ct] = await Promise.all([store.listItems(), store.listCategories()]);
      setItems(it);
      setCats(ct);
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

  const filtered = items.filter((i) => {
    const q = search.trim().toLowerCase();
    const hit =
      !q ||
      i.code.toLowerCase().includes(q) ||
      i.name.toLowerCase().includes(q) ||
      i.serial_no.toLowerCase().includes(q);
    return hit && (status === ALL || i.status === status) && (cat === ALL || i.category_id === cat);
  });

  const catName = (id: string) => cats.find((c) => c.id === id)?.name ?? '—';

  if (!store || loading) return <p style={{ color: C.muted }}>Đang tải...</p>;

  return (
    <div>
      <DataSourceBar mode={mode} reasonText={reasonText(reason)} message={message} />
      <InlineError text={error} onClose={() => setError(null)} />
      <Toolbar search={search} onSearch={setSearch} placeholder="Tìm theo mã, tên, serial...">
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={ALL}>Mọi trạng thái</option>
          <option value="AVAILABLE">Sẵn sàng</option>
          <option value="ASSIGNED">Đang cấp phát</option>
          <option value="MAINTENANCE">Bảo trì</option>
          <option value="DISPOSED">Đã thanh lý</option>
          <option value="LOST">Thất lạc</option>
        </Select>
        <Select value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value={ALL}>Mọi danh mục</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Btn primary onClick={() => setShowCreate(true)}>+ Thêm tài sản</Btn>
      </Toolbar>

      <TableWrap>
        <thead>
          <tr>
            <th style={th}>Mã / Tên</th>
            <th style={th}>Danh mục</th>
            <th style={th}>Giá trị còn lại</th>
            <th style={th}>Trạng thái</th>
            <th style={th}>Hành động</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((i) => (
            <tr key={i.id}>
              <td style={td}>
                <b style={{ color: C.text }}>{i.code}</b>
                <div>{i.name}</div>
                <div style={{ color: C.muted, fontSize: '.78rem' }}>SN: {i.serial_no} · Mua {i.purchase_date}</div>
              </td>
              <td style={td}>{catName(i.category_id)}</td>
              <td style={td}>{formatVND(i.book_value_remaining)}</td>
              <td style={td}><Badge status={i.status} /></td>
              <td style={{ ...td, whiteSpace: 'nowrap' }}>
                <button onClick={() => setEditing(i)} style={link}>Sửa</button>{' '}
                {i.status === 'AVAILABLE' && (
                  <button onClick={() => setAssigning(i)} style={link}>Cấp phát</button>
                )}{' '}
                {i.status === 'ASSIGNED' && (
                  <button onClick={() => mutate(() => store!.returnAsset(i.id))} style={link}>
                    Thu hồi
                  </button>
                )}{' '}
                <button
                  onClick={() => {
                    if (confirm(`Xóa ${i.code}?`)) mutate(() => store!.removeItem(i.id));
                  }}
                  style={{ ...link, color: C.red }}
                >
                  Xóa
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
      {filtered.length === 0 && <p style={{ color: C.muted }}>Không có tài sản phù hợp.</p>}
      {mode === 'live' && (
        <p style={{ color: C.muted, fontSize: '.78rem' }}>
          Nút “Cấp phát” gọi workflow n8n `wf_asset_request` qua dispatcher (202 → xử lý ngầm).
        </p>
      )}

      {showCreate && (
        <AssetForm
          title="Thêm tài sản"
          categories={cats}
          onClose={() => setShowCreate(false)}
          onSubmit={(v) => mutate(async () => { await store!.createItem(v); setShowCreate(false); })}
        />
      )}
      {editing && (
        <AssetForm
          title={`Sửa ${editing.code}`}
          initial={editing}
          categories={cats}
          onClose={() => setEditing(null)}
          onSubmit={(v) => mutate(async () => { await store!.updateItem(editing.id, v); setEditing(null); })}
        />
      )}
      {assigning && (
        <AssignForm
          code={assigning.code}
          onClose={() => setAssigning(null)}
          onSubmit={(u, d, n) =>
            mutate(async () => {
              await store!.assignAsset(assigning.id, u, d, n);
              setAssigning(null);
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

function AssetForm(props: {
  title: string;
  initial?: AssetItem;
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (v: Omit<AssetItem, 'id'>) => Promise<void>;
}) {
  const [code, setCode] = useState(props.initial?.code ?? '');
  const [name, setName] = useState(props.initial?.name ?? '');
  const [category_id, setCategory] = useState(
    props.initial?.category_id ?? props.categories[0]?.id ?? '',
  );
  const [purchase_price, setPrice] = useState(String(props.initial?.purchase_price ?? 0));
  const [serial_no, setSerial] = useState(props.initial?.serial_no ?? '');
  const [status, setStatus] = useState<AssetStatus>(props.initial?.status ?? 'AVAILABLE');

  return (
    <Modal title={props.title} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Mã (VD LAP-003)" value={code} onChange={(e) => setCode(e.target.value)} />
        <Input placeholder="Tên tài sản" value={name} onChange={(e) => setName(e.target.value)} />
        <Select value={category_id} onChange={(e) => setCategory(e.target.value)}>
          {props.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Input placeholder="Giá mua (VND)" value={purchase_price} onChange={(e) => setPrice(e.target.value)} />
        <Input placeholder="Serial" value={serial_no} onChange={(e) => setSerial(e.target.value)} />
        <Select value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
          <option value="AVAILABLE">Sẵn sàng</option>
          <option value="ASSIGNED">Đang cấp phát</option>
          <option value="MAINTENANCE">Bảo trì</option>
          <option value="LOST">Thất lạc</option>
        </Select>
        <Btn
          primary
          onClick={() =>
            props.onSubmit({
              category_id,
              code: code.trim() || `AST-${Date.now() % 100000}`,
              name: name.trim() || 'Tài sản mới',
              purchase_date: props.initial?.purchase_date ?? new Date().toISOString().slice(0, 10),
              purchase_price: Number(purchase_price) || 0,
              serial_no,
              status,
              book_value_remaining: props.initial?.book_value_remaining ?? (Number(purchase_price) || 0),
            })
          }
        >
          Lưu
        </Btn>
      </div>
    </Modal>
  );
}

function AssignForm(props: { code: string; onClose: () => void; onSubmit: (u: string, d: string, n: string) => Promise<void> }) {
  const [user, setUser] = useState('');
  const [dept, setDept] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <Modal title={`Cấp phát ${props.code}`} onClose={props.onClose}>
      <div style={{ display: 'grid', gap: '.6rem' }}>
        <Input placeholder="Người nhận (VD Nguyễn Văn An)" value={user} onChange={(e) => setUser(e.target.value)} />
        <Input placeholder="Phòng ban" value={dept} onChange={(e) => setDept(e.target.value)} />
        <Input placeholder="Ghi chú" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Btn primary disabled={!user.trim()} onClick={() => props.onSubmit(user.trim(), dept.trim(), notes)}>
          Xác nhận cấp phát
        </Btn>
      </div>
    </Modal>
  );
}
