// Catalog / home screen — product grid with search + category chips
const CatalogScreen = ({ t, onProductTap, onCart, cartCount, tab, setTab, search, setSearch, category, setCategory, onOpenParked, onAddSimple }) => {
  const [scroll, setScroll] = React.useState(0);
  const filtered = PRODUCTS.filter(p =>
    (category === 'all' || p.category === category) &&
    (!search || p.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <>
      <CounterStatusBar t={t}/>
      <div onScroll={(e) => setScroll(e.target.scrollTop)}
        style={{ height: 'calc(100% - 40px)', overflow: 'auto', paddingBottom: 100 }}>
        <NavBar t={t} title="Sell" scroll={scroll}
          subtitle="Shift open · Ana · Register 01"
          trailing={<>
            <button onClick={onOpenParked} style={{
              height: 36, padding: '0 12px', borderRadius: 12, border: 'none',
              background: t.surface2, color: t.ink, cursor: 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: t.fontUI,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Icon.table width="16" height="16"/>
              Parked · {PARKED_ORDERS.length}
            </button>
          </>}
        />

        {/* Search + scan */}
        <div style={{ padding: '4px 20px 14px', display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, height: 44, borderRadius: 14, background: t.surface2,
            display: 'flex', alignItems: 'center', padding: '0 14px', gap: 10,
            border: `0.5px solid ${t.line}`,
          }}>
            <Icon.search width="18" height="18" style={{ color: t.ink3 }}/>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search products or SKU"
              style={{
                flex: 1, border: 'none', background: 'transparent', outline: 'none',
                fontFamily: t.fontUI, fontSize: 15, color: t.ink,
              }}/>
            {search && (
              <button onClick={() => setSearch('')} style={{
                border: 'none', background: 'transparent', color: t.ink3,
                display: 'flex', padding: 0, cursor: 'pointer',
              }}><Icon.close width="16" height="16"/></button>
            )}
          </div>
          <button style={{
            width: 44, height: 44, borderRadius: 14, border: 'none',
            background: t.ink, color: t.bg, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon.scan width="20" height="20"/>
          </button>
        </div>

        {/* Category chips */}
        <div style={{
          display: 'flex', gap: 6, padding: '0 20px 14px',
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          {CATEGORIES.map(c => {
            const active = category === c.id;
            return (
              <button key={c.id} onClick={() => setCategory(c.id)} style={{
                padding: '8px 14px', borderRadius: 999, border: 'none',
                background: active ? t.ink : t.surface2,
                color: active ? t.bg : t.ink2,
                fontFamily: t.fontUI, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{c.name}</button>
            );
          })}
        </div>

        {/* Product grid */}
        <div style={{
          padding: '0 16px', display: 'grid',
          gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {filtered.map(p => <ProductCard key={p.id} t={t} product={p}
            onTap={() => onProductTap(p)}
            onQuickAdd={() => {
              if (p.variants || p.modifiers) onProductTap(p);
              else onAddSimple(p);
            }}
          />)}
          {filtered.length === 0 && (
            <div style={{
              gridColumn: '1 / -1', textAlign: 'center', padding: '60px 20px',
              color: t.ink3, fontSize: 14,
            }}>No products match “{search}”.</div>
          )}
        </div>
      </div>

      <TabBar t={t} active={tab} onChange={setTab} cartCount={cartCount} onCart={onCart}/>
    </>
  );
};

const ProductCard = ({ t, product, onTap, onQuickAdd }) => {
  const out = product.stock === 0;
  const low = product.stock > 0 && product.stock < 6;
  return (
    <button onClick={onTap} style={{
      background: t.surface, borderRadius: 18, border: `0.5px solid ${t.line}`,
      padding: 10, textAlign: 'left', cursor: 'pointer', position: 'relative',
      display: 'flex', flexDirection: 'column', gap: 8, opacity: out ? 0.55 : 1,
      fontFamily: 'inherit', color: 'inherit',
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden' }}>
          <ProductThumb product={product} size="100%" radius={12}/>
        </div>
        {!out && (
          <button onClick={(e) => { e.stopPropagation(); onQuickAdd(); }} style={{
            position: 'absolute', bottom: 6, right: 6,
            width: 30, height: 30, borderRadius: 15, border: 'none',
            background: 'rgba(255,255,255,0.95)', color: '#111', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
          }}>
            <Icon.plus width="16" height="16"/>
          </button>
        )}
        {out && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            padding: '3px 8px', borderRadius: 6, background: 'rgba(0,0,0,0.75)',
            color: '#fff', fontSize: 10, fontWeight: 700, fontFamily: t.fontUI,
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>Out</div>
        )}
        {low && (
          <div style={{
            position: 'absolute', top: 6, left: 6,
            padding: '3px 8px', borderRadius: 6, background: t.accent,
            color: '#1a1a1a', fontSize: 10, fontWeight: 700, fontFamily: t.fontUI,
            letterSpacing: 0.5, textTransform: 'uppercase',
          }}>{product.stock} left</div>
        )}
      </div>
      <div style={{ padding: '0 4px 4px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: t.ink, lineHeight: 1.3 }}>{product.name}</div>
        <div style={{
          marginTop: 4, display: 'flex', alignItems: 'baseline',
          justifyContent: 'space-between', gap: 6,
        }}>
          <span style={{ fontFamily: t.fontMono, fontSize: 14, fontWeight: 600, color: t.ink }}>
            ${product.price.toFixed(2)}
          </span>
          {product.variants && (
            <span style={{ fontSize: 10.5, color: t.ink3, fontFamily: t.fontUI }}>
              {Object.keys(product.variants).join(' · ')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

window.CatalogScreen = CatalogScreen;
