// Import & Export — products, customers, orders

const ImportExportScreen = ({ t, onBack, startMode = 'import' }) => {
  const [mode, setMode] = React.useState(startMode); // import | export
  return (
    <>
      <CounterStatusBar t={t}/>
      <NavBar t={t} title="Import & export" subtitle="CSV, XLSX · sync with spreadsheets" onBack={onBack} large={true}/>
      <div style={{ padding: '4px 16px 16px' }}>
        <div style={{
          display: 'flex', gap: 3, padding: 3, borderRadius: 12,
          background: t.surface2, border: `0.5px solid ${t.line}`,
        }}>
          {[['import', 'Import'], ['export', 'Export']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} style={{
              flex: 1, padding: '10px 6px', borderRadius: 9, border: 'none',
              background: mode === k ? t.surface : 'transparent',
              color: mode === k ? t.ink : t.ink2,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: t.fontUI,
              boxShadow: mode === k ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
            }}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{ height: 'calc(100% - 220px)', overflow: 'auto', paddingBottom: 20 }}>
        {mode === 'import' ? <ImportPane t={t}/> : <ExportPane t={t}/>}
      </div>
    </>
  );
};

// ---------- Import ----------
const IMPORT_PREVIEW = [
  { name: 'Merino Crew Sweater', cat: 'Apparel', variants: 'S/M/L/XL · 3 colors', price: '$128.00', stock: 42, status: 'new' },
  { name: 'Heavyweight Tee', cat: 'Apparel', variants: 'S/M/L/XL · 3 colors', price: '$32.00', stock: 24, status: 'update' },
  { name: 'Wool Beanie', cat: 'Apparel', variants: '2 colors', price: '$24.00', stock: 18, status: 'new' },
  { name: 'Field Notebook A5', cat: 'Gifts', variants: '—', price: '$12.50', stock: 64, status: 'new' },
  { name: 'House Blend 250g', cat: 'Pantry', variants: 'Whole / Ground', price: '$16.00', stock: 38, status: 'new' },
  { name: 'Cold Brew', cat: 'Drinks', variants: '12 oz / 16 oz', price: '$5.20', stock: 42, status: 'update' },
  { name: 'Ceramic Mug', cat: 'Gifts', variants: '3 colors', price: '$18.00', stock: 3, status: 'skip' },
];

const ImportPane = ({ t }) => {
  const [stage, setStage] = React.useState('pick'); // pick | mapping | preview | done
  const [file, setFile] = React.useState(null);
  const [progress, setProgress] = React.useState(0);
  const fileRef = React.useRef(null);

  const pickFile = () => fileRef.current?.click();
  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile({ name: f.name, size: f.size });
      setStage('mapping');
    }
  };
  const simulate = () => {
    setFile({ name: 'inventory_apr26.csv', size: 84320 });
    setStage('mapping');
  };

  const runImport = () => {
    setStage('preview');
  };
  const confirm = () => {
    setStage('done');
    setProgress(0);
    const id = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(id); return 100; }
        return Math.min(100, p + 6 + Math.random() * 8);
      });
    }, 90);
  };

  return (
    <div style={{ padding: '0 16px' }}>
      {stage === 'pick' && (
        <>
          <button onClick={pickFile} style={{
            width: '100%', padding: '28px 20px', borderRadius: 18,
            border: `1.5px dashed ${t.line2}`, background: t.surface,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            cursor: 'pointer', fontFamily: t.fontUI,
          }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: t.accentSoft, color: t.accentDeep,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.upload width="22" height="22"/>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>Choose a file</div>
            <div style={{ fontSize: 12, color: t.ink3, textAlign: 'center', lineHeight: 1.5 }}>
              CSV or XLSX · up to 10,000 rows<br/>
              Drag in from Files, Drive, or Dropbox
            </div>
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.tsv" onChange={onFile} style={{ display: 'none' }}/>

          <button onClick={simulate} style={{
            marginTop: 10, width: '100%', padding: 10, borderRadius: 10,
            border: 'none', background: 'transparent', color: t.ink3, cursor: 'pointer',
            fontSize: 12, fontWeight: 500, fontFamily: t.fontUI,
          }}>Or use sample file (demo)</button>

          <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.ink2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Templates
            </div>
            {[
              { label: 'Products template', sub: '18 columns · variants, modifiers, tax' },
              { label: 'Customers template', sub: '10 columns · loyalty points, tags' },
              { label: 'From Square', sub: 'Auto-map exported catalog' },
              { label: 'From Shopify', sub: 'Auto-map product export' },
            ].map((tpl, i) => (
              <button key={tpl.label} style={{
                width: '100%', padding: '12px 4px', display: 'flex', alignItems: 'center', gap: 10,
                border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
                borderTop: i > 0 ? `0.5px solid ${t.line}` : 'none', fontFamily: t.fontUI,
              }}>
                <Icon.csv width="18" height="18" style={{ color: t.ink3 }}/>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: t.ink, fontWeight: 500 }}>{tpl.label}</div>
                  <div style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>{tpl.sub}</div>
                </div>
                <Icon.download width="16" height="16" style={{ color: t.ink3 }}/>
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: t.accentSoft, border: `0.5px solid ${t.accent}` }}>
            <div style={{ fontSize: 12, color: t.accentDeep, fontWeight: 600, lineHeight: 1.5 }}>
              Tip · Use SKU as the unique identifier. Existing products with matching SKUs will be updated; unknown SKUs are created.
            </div>
          </div>
        </>
      )}

      {stage === 'mapping' && (
        <>
          <FileChip t={t} file={file} onRemove={() => { setFile(null); setStage('pick'); }}/>
          <div style={{ marginTop: 12, padding: 14, borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: t.ink2, textTransform: 'uppercase', letterSpacing: 0.8 }}>Column mapping</span>
              <span style={{ fontSize: 11, color: t.ink3, fontFamily: t.fontMono }}>Auto · 12/13</span>
            </div>
            {[
              ['product_name', 'Name', true],
              ['sku', 'SKU', true],
              ['category', 'Category', true],
              ['price', 'Price', true],
              ['cost', 'Cost', true],
              ['stock_qty', 'Stock', true],
              ['variant_options', 'Variants', true],
              ['tax_rate', 'Tax rate', true],
              ['vendor_code', 'Unmapped', false],
            ].map((row, i) => (
              <div key={row[0]} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
                borderTop: i > 0 ? `0.5px solid ${t.line}` : 'none',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: t.ink3, fontFamily: t.fontMono }}>{row[0]}</div>
                </div>
                <Icon.chevron width="14" height="14" style={{ color: t.ink3, transform: 'rotate(0deg)' }}/>
                <div style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  background: row[2] ? t.accentSoft : t.surface2,
                  color: row[2] ? t.accentDeep : t.ink3,
                  fontFamily: t.fontUI,
                }}>{row[1]}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: t.ink2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Options</div>
            {[
              ['Update existing by SKU', true],
              ['Create new categories if missing', true],
              ['Preserve current stock levels', false],
            ].map(([label, on]) => (
              <ToggleRow key={label} t={t} label={label} on={on}/>
            ))}
          </div>

          <button onClick={runImport} style={{
            marginTop: 16, width: '100%', height: 52, borderRadius: 14, border: 'none',
            background: t.ink, color: t.bg, cursor: 'pointer',
            fontFamily: t.fontUI, fontSize: 15, fontWeight: 600,
          }}>Preview 247 rows</button>
        </>
      )}

      {stage === 'preview' && (
        <>
          <FileChip t={t} file={file} onRemove={() => { setFile(null); setStage('pick'); }}/>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <Stat t={t} label="New" value="189" color={t.accentDeep}/>
            <Stat t={t} label="Update" value="56" color={t.ink}/>
            <Stat t={t} label="Skipped" value="2" color="#D84C3F"/>
          </div>
          <div style={{ marginTop: 12, borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}`, overflow: 'hidden' }}>
            {IMPORT_PREVIEW.map((row, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
                borderTop: i > 0 ? `0.5px solid ${t.line}` : 'none',
              }}>
                <StatusDot t={t} status={row.status}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
                  <div style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>{row.cat} · {row.variants}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: t.fontMono, fontSize: 12, fontWeight: 600, color: t.ink }}>{row.price}</div>
                  <div style={{ fontFamily: t.fontMono, fontSize: 10.5, color: t.ink3, marginTop: 1 }}>stock {row.stock}</div>
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 12px', borderTop: `0.5px solid ${t.line}`, fontSize: 11, color: t.ink3, textAlign: 'center', fontFamily: t.fontMono }}>
              + 240 more rows
            </div>
          </div>

          <button onClick={confirm} style={{
            marginTop: 16, width: '100%', height: 52, borderRadius: 14, border: 'none',
            background: t.ink, color: t.bg, cursor: 'pointer',
            fontFamily: t.fontUI, fontSize: 15, fontWeight: 600,
          }}>Import 245 products</button>
        </>
      )}

      {stage === 'done' && (
        <div style={{ padding: '10px 4px' }}>
          <div style={{
            padding: 18, borderRadius: 18, background: t.surface, border: `0.5px solid ${t.line}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 20,
                background: progress >= 100 ? t.accentSoft : t.surface2,
                color: progress >= 100 ? t.accentDeep : t.ink2,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {progress >= 100 ? <Icon.check width="20" height="20"/> : <Icon.upload width="18" height="18"/>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>
                  {progress >= 100 ? 'Import complete' : 'Importing…'}
                </div>
                <div style={{ fontSize: 12, color: t.ink3, marginTop: 2, fontFamily: t.fontMono }}>
                  {Math.floor((progress / 100) * 245)} / 245 products
                </div>
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: t.surface2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: t.accentDeep, transition: 'width 0.2s',
              }}/>
            </div>
          </div>
          {progress >= 100 && (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}`, fontFamily: t.fontMono, fontSize: 12 }}>
              <Row t={t} l="Created" v="189"/>
              <Row t={t} l="Updated" v="56"/>
              <Row t={t} l="Skipped" v="2"/>
              <Row t={t} l="Elapsed" v="4.2 s"/>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ---------- Export ----------
const ExportPane = ({ t }) => {
  const [what, setWhat] = React.useState('products');
  const [format, setFormat] = React.useState('csv');
  const [range, setRange] = React.useState('all');
  const [sending, setSending] = React.useState(false);

  const datasets = [
    { id: 'products', label: 'Products', count: '247 rows · with variants' },
    { id: 'customers', label: 'Customers', count: '1,284 rows · loyalty' },
    { id: 'orders', label: 'Orders', count: '4,902 rows · line items included' },
    { id: 'inventory', label: 'Inventory snapshot', count: 'Current stock by SKU' },
  ];

  const run = () => {
    setSending(true);
    setTimeout(() => setSending(false), 1400);
  };

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: t.ink3, textTransform: 'uppercase', letterSpacing: 1, padding: '0 6px 6px' }}>Dataset</div>
      <div style={{ borderRadius: 16, background: t.surface, border: `0.5px solid ${t.line}`, overflow: 'hidden' }}>
        {datasets.map((d, i) => (
          <button key={d.id} onClick={() => setWhat(d.id)} style={{
            width: '100%', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
            border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left',
            borderTop: i > 0 ? `0.5px solid ${t.line}` : 'none', fontFamily: t.fontUI,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 9,
              border: `1.5px solid ${what === d.id ? t.accentDeep : t.line2}`,
              background: what === d.id ? t.accentDeep : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{what === d.id && <div style={{ width: 7, height: 7, borderRadius: 4, background: '#fff' }}/>}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, color: t.ink, fontWeight: 500 }}>{d.label}</div>
              <div style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{d.count}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: t.ink3, textTransform: 'uppercase', letterSpacing: 1, padding: '16px 6px 6px' }}>Format</div>
      <div style={{ display: 'flex', gap: 6 }}>
        {[['csv', 'CSV'], ['xlsx', 'XLSX'], ['json', 'JSON']].map(([k, l]) => (
          <button key={k} onClick={() => setFormat(k)} style={{
            flex: 1, padding: '12px 0', borderRadius: 12,
            border: `1px solid ${format === k ? t.ink : t.line2}`,
            background: format === k ? t.ink : 'transparent',
            color: format === k ? t.bg : t.ink,
            fontFamily: t.fontMono, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>

      {what === 'orders' && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, color: t.ink3, textTransform: 'uppercase', letterSpacing: 1, padding: '16px 6px 6px' }}>Date range</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[['today', 'Today'], ['7d', 'Last 7d'], ['30d', 'Last 30d'], ['month', 'This month'], ['all', 'All time']].map(([k, l]) => (
              <button key={k} onClick={() => setRange(k)} style={{
                padding: '8px 14px', borderRadius: 999,
                border: `1px solid ${range === k ? t.ink : t.line2}`,
                background: range === k ? t.ink : 'transparent',
                color: range === k ? t.bg : t.ink, cursor: 'pointer',
                fontFamily: t.fontUI, fontSize: 12, fontWeight: 600,
              }}>{l}</button>
            ))}
          </div>
        </>
      )}

      <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}` }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: t.ink2, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>Options</div>
        <ToggleRow t={t} label="Include archived items" on={false}/>
        <ToggleRow t={t} label="Flatten variants into rows" on={true}/>
        <ToggleRow t={t} label="Include cost & margin" on={false}/>
      </div>

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button onClick={run} style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none',
          background: t.ink, color: t.bg, cursor: 'pointer',
          fontFamily: t.fontUI, fontSize: 15, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          {sending ? (
            <><div style={{ width: 14, height: 14, borderRadius: 7, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }}/>Preparing…</>
          ) : (
            <><Icon.download width="18" height="18"/>Download {format.toUpperCase()}</>
          )}
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <SideBtn t={t} icon={Icon.receipt} label="Email"/>
          <SideBtn t={t} icon={Icon.bluetooth} label="AirDrop"/>
          <SideBtn t={t} icon={Icon.wifi} label="Cloud"/>
        </div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: t.ink3, textTransform: 'uppercase', letterSpacing: 1, padding: '16px 6px 6px' }}>Recent exports</div>
      <div style={{ borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}`, overflow: 'hidden' }}>
        {[
          { name: 'products_2026-04-21.csv', size: '48 KB', time: '2 min ago' },
          { name: 'orders_last30d.xlsx', size: '312 KB', time: 'Yesterday' },
          { name: 'customers_all.csv', size: '86 KB', time: '3 days ago' },
        ].map((f, i) => (
          <div key={f.name} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
            borderTop: i > 0 ? `0.5px solid ${t.line}` : 'none',
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.surface2, color: t.ink2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon.csv width="16" height="16"/>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: t.ink, fontFamily: t.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
              <div style={{ fontSize: 11, color: t.ink3, marginTop: 1 }}>{f.size} · {f.time}</div>
            </div>
            <button style={{
              width: 30, height: 30, borderRadius: 9, border: 'none',
              background: t.surface2, color: t.ink2, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><Icon.download width="14" height="14"/></button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- shared bits ----------
const FileChip = ({ t, file, onRemove }) => (
  <div style={{ padding: '12px 14px', borderRadius: 14, background: t.surface, border: `0.5px solid ${t.line}`, display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 38, height: 38, borderRadius: 10, background: t.accentSoft, color: t.accentDeep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon.csv width="18" height="18"/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, fontFamily: t.fontMono, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</div>
      <div style={{ fontSize: 11, color: t.ink3, marginTop: 2 }}>{(file.size / 1024).toFixed(1)} KB · 247 rows detected</div>
    </div>
    <button onClick={onRemove} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: t.surface2, color: t.ink2, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon.close width="14" height="14"/>
    </button>
  </div>
);

const ToggleRow = ({ t, label, on: initialOn }) => {
  const [on, setOn] = React.useState(initialOn);
  return (
    <button onClick={() => setOn(!on)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
      border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: t.fontUI,
    }}>
      <span style={{ flex: 1, fontSize: 13, color: t.ink }}>{label}</span>
      <div style={{
        width: 36, height: 22, borderRadius: 11, padding: 2,
        background: on ? t.accentDeep : t.line2,
        transition: 'background 0.15s',
      }}>
        <div style={{
          width: 18, height: 18, borderRadius: 9, background: '#fff',
          transform: `translateX(${on ? 14 : 0}px)`, transition: 'transform 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}/>
      </div>
    </button>
  );
};

const Stat = ({ t, label, value, color }) => (
  <div style={{ flex: 1, padding: '10px 12px', borderRadius: 12, background: t.surface, border: `0.5px solid ${t.line}`, textAlign: 'center' }}>
    <div style={{ fontFamily: t.fontMono, fontSize: 20, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 10.5, color: t.ink3, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 }}>{label}</div>
  </div>
);

const StatusDot = ({ t, status }) => {
  const colors = { new: '#4BA971', update: '#D4A842', skip: '#D84C3F' };
  return <div style={{ width: 6, height: 6, borderRadius: 3, background: colors[status], flexShrink: 0 }}/>;
};

const Row = ({ t, l, v }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: t.ink2 }}>
    <span style={{ fontFamily: t.fontUI }}>{l}</span>
    <span style={{ color: t.ink, fontWeight: 600 }}>{v}</span>
  </div>
);

const SideBtn = ({ t, icon: Ic, label }) => (
  <button style={{
    flex: 1, height: 46, borderRadius: 12, border: `0.5px solid ${t.line}`,
    background: t.surface, color: t.ink, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    fontFamily: t.fontUI, fontSize: 10.5, fontWeight: 600, justifyContent: 'center',
  }}>
    <Ic width="16" height="16" style={{ color: t.ink2 }}/>
    {label}
  </button>
);

window.ImportExportScreen = ImportExportScreen;
