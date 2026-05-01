// Main app — wires screens + Tweaks panel + edit-mode protocol

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "accentHue": 70,
  "density": "cozy",
  "pickerStyle": "chips",
  "flow": "catalog"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweaks] = React.useState(TWEAK_DEFAULTS);
  const [editMode, setEditMode] = React.useState(false);
  const t = useTokens(tweaks);

  // Set/merge tweak & persist
  const setTweak = (key, value) => {
    setTweaks(prev => ({ ...prev, [key]: value }));
    window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: value } }, '*');
  };

  React.useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === '__activate_edit_mode') setEditMode(true);
      if (e.data?.type === '__deactivate_edit_mode') setEditMode(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <div style={{
      minHeight: '100vh', padding: '40px 24px 80px',
      background: t.dark ? '#0a0a0b' : '#E8E3DA',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 60,
      fontFamily: t.fontUI, color: t.ink,
    }}>
      <Header t={t}/>
      {tweaks.flow === 'catalog' && <FullFlow t={t} tweaks={tweaks}/>}
      {tweaks.flow === 'all' && <AllScreens t={t} tweaks={tweaks}/>}
      {editMode && <TweaksPanel t={t} tweaks={tweaks} setTweak={setTweak}/>}
    </div>
  );
}

const Header = ({ t }) => (
  <div style={{ textAlign: 'center', maxWidth: 720 }} data-screen-label="01 Cover">
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '6px 12px', borderRadius: 999,
      background: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      color: t.ink2, fontFamily: t.fontMono, fontSize: 11,
      letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20,
    }}>
      <Icon.logo width="14" height="14"/> Counter · Mobile POS
    </div>
    <h1 style={{
      fontSize: 44, fontWeight: 700, letterSpacing: -1, margin: 0, color: t.ink,
      lineHeight: 1.05,
    }}>A calm, fast POS for the counter.</h1>
    <p style={{
      fontSize: 15, color: t.ink2, marginTop: 14, lineHeight: 1.55, maxWidth: 560, margin: '14px auto 0',
    }}>
      Phone-first. Ten connected screens — catalog → variants → cart → payment → thermal receipt — plus shift, orders, customers, and settings. Toggle the <b>Tweaks</b> button in the toolbar to change accent, theme, density, and the variant picker style.
    </p>
  </div>
);

// Interactive full flow — one phone, all screens accessible
function FullFlow({ t, tweaks }) {
  const [view, setView] = React.useState('login'); // login | shift | main | closeShift | importExport
  const [tab, setTab] = React.useState('catalog');
  const [cart, setCart] = React.useState([]);
  const [discount, setDiscount] = React.useState({ type: 'pct', value: 0 });
  const [customer, setCustomer] = React.useState(null);
  const [sheetProduct, setSheetProduct] = React.useState(null);
  const [cartOpen, setCartOpen] = React.useState(false);
  const [pickCust, setPickCust] = React.useState(false);
  const [parkedOpen, setParkedOpen] = React.useState(false);
  const [payment, setPayment] = React.useState(null);
  const [receipt, setReceipt] = React.useState(null);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState('all');

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const subtotal = cart.reduce((s, l) => s + (l.unit + l.modTotal) * l.qty, 0);
  const discountAmt = discount.type === 'pct' ? subtotal * (discount.value / 100) : Math.min(discount.value, subtotal);
  const tax = (subtotal - discountAmt) * 0.08;
  const total = subtotal - discountAmt + tax;

  const addLine = (payload) => {
    const id = `l-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setCart(prev => [...prev, { id, ...payload }]);
  };
  const addSimple = (product) => addLine({ product, qty: 1, unit: product.price, modTotal: 0, selected: null, mods: {} });

  const completeSale = (paymentInfo) => {
    const orderId = '2050';
    setReceipt({
      id: orderId, total, subtotal, tax, discountAmt, method: paymentInfo.method,
      tendered: paymentInfo.tendered, lines: cart, customer,
    });
    setPayment(false);
  };

  const resetAfterSale = () => {
    setCart([]); setDiscount({ type: 'pct', value: 0 }); setCustomer(null);
    setReceipt(null); setCartOpen(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}
      data-screen-label="02 Interactive prototype">
      <div style={{
        display: 'flex', gap: 6, padding: 4, background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        borderRadius: 12, fontFamily: t.fontUI,
      }}>
        {[
          { id: 'login', label: 'Login' },
          { id: 'shift', label: 'Open shift' },
          { id: 'main', label: 'Sell' },
          { id: 'importExport', label: 'Import/Export' },
          { id: 'closeShift', label: 'Close shift' },
        ].map(s => (
          <button key={s.id} onClick={() => setView(s.id)} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: view === s.id ? t.ink : 'transparent',
            color: view === s.id ? t.bg : t.ink2,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>{s.label}</button>
        ))}
      </div>

      <Phone t={t} label="Live prototype · tap anything">
        {view === 'login' && <LoginScreen t={t} onUnlock={() => setView('shift')}/>}
        {view === 'shift' && <ShiftOpenScreen t={t} onStart={() => setView('main')}/>}
        {view === 'closeShift' && <ShiftCloseScreen t={t} onBack={() => setView('main')}/>}
        {view === 'importExport' && <ImportExportScreen t={t} onBack={() => setView('main')}/>}
        {view === 'main' && <>
          {tab === 'catalog' && <CatalogScreen t={t} tab={tab} setTab={setTab}
            cartCount={cartCount} onCart={() => setCartOpen(true)}
            search={search} setSearch={setSearch}
            category={category} setCategory={setCategory}
            onProductTap={setSheetProduct} onAddSimple={addSimple}
            onOpenParked={() => setParkedOpen(true)}/>}
          {tab === 'orders' && <OrdersScreen t={t} tab={tab} setTab={setTab} cartCount={cartCount} onCart={() => setCartOpen(true)}/>}
          {tab === 'customers' && <CustomersScreen t={t} tab={tab} setTab={setTab} cartCount={cartCount} onCart={() => setCartOpen(true)}/>}
          {tab === 'settings' && <SettingsScreen t={t} tab={tab} setTab={setTab} cartCount={cartCount}
            onCart={() => setCartOpen(true)} onCloseShift={() => setView('closeShift')}
            onImportExport={() => setView('importExport')}/>}

          {sheetProduct && <VariantSheet t={t} product={sheetProduct} pickerStyle={tweaks.pickerStyle}
            onClose={() => setSheetProduct(null)} onAdd={addLine}/>}

          {cartOpen && !payment && !receipt && (
            <CartScreen t={t} lines={cart} setLines={setCart}
              discount={discount} setDiscount={setDiscount}
              customer={customer} setCustomerPick={() => setPickCust(true)}
              onClose={() => setCartOpen(false)}
              onCheckout={() => setPayment(true)}
              onPark={() => { setCart([]); setCartOpen(false); }}
            />
          )}

          {payment && !receipt && (
            <PaymentScreen t={t} total={total} lines={cart}
              onClose={() => setPayment(false)} onSuccess={completeSale}/>
          )}

          {receipt && (
            <ReceiptScreen t={t} order={receipt}
              onDone={resetAfterSale} onNewSale={resetAfterSale}/>
          )}

          {pickCust && (
            <div style={{ position: 'absolute', inset: 0, zIndex: 120, background: t.bg, animation: 'slideUpFull 0.3s cubic-bezier(0.2, 0.9, 0.3, 1)' }}>
              <CustomersScreen t={t} onPick={(c) => { setCustomer(c); setPickCust(false); }}/>
            </div>
          )}

          {parkedOpen && <ParkedSheet t={t} onClose={() => setParkedOpen(false)} onResume={() => setParkedOpen(false)}/>}
        </>}
      </Phone>

      <QuickActions t={t} setCart={setCart} addSimple={addSimple}
        openCart={() => setCartOpen(true)} openVariant={() => setSheetProduct(PRODUCTS[0])}/>
    </div>
  );
}

// Quick demo buttons so user can hop straight into flows
const QuickActions = ({ t, setCart, addSimple, openCart, openVariant }) => (
  <div style={{
    display: 'flex', gap: 8, padding: 6, borderRadius: 14,
    background: t.dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
    backdropFilter: 'blur(8px)', fontFamily: t.fontUI,
  }}>
    <DemoBtn t={t} label="Open variant sheet" onClick={openVariant}/>
    <DemoBtn t={t} label="Fill cart (demo)" onClick={() => {
      const c = [];
      const push = (p, q=1, sel=null, unit=null, mt=0) => c.push({ id: `d-${p.id}-${q}`, product: p, qty: q, unit: unit ?? p.price, modTotal: mt, selected: sel, mods: {} });
      push(PRODUCTS[1], 2, { Size: 'Regular' }, 4.80, 0.80);
      push(PRODUCTS[0], 1, { Size: 'L', Color: 'Ink' }, 32);
      push(PRODUCTS[7], 3, null, 4.50);
      setCart(c);
      openCart();
    }}/>
  </div>
);
const DemoBtn = ({ t, label, onClick }) => (
  <button onClick={onClick} style={{
    padding: '10px 14px', borderRadius: 10, border: `0.5px solid ${t.line2}`,
    background: t.surface, color: t.ink, cursor: 'pointer',
    fontSize: 12, fontWeight: 600,
  }}>{label}</button>
);

// Gallery of all screens side-by-side (for design review)
function AllScreens({ t, tweaks }) {
  const demoLine = { id: 'd1', product: PRODUCTS[0], qty: 1, unit: 32, modTotal: 0, selected: { Size: 'L', Color: 'Ink' }, mods: {} };
  const demoLine2 = { id: 'd2', product: PRODUCTS[1], qty: 2, unit: 4.80, modTotal: 0.80, selected: { Size: 'Regular' }, mods: { 'Extra shot': true } };
  const demoCart = [demoLine, demoLine2];
  const demoOrder = {
    id: '2050', total: 42.08, subtotal: 39.20, tax: 2.88, discountAmt: 0,
    method: 'Card', tendered: null, lines: demoCart, customer: CUSTOMERS[0],
  };
  const noop = () => {};

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, max-content))',
      gap: 48, justifyContent: 'center',
    }}>
      <Phone t={t} label="01 · Login / PIN">
        <LoginScreen t={t} onUnlock={noop}/>
      </Phone>
      <Phone t={t} label="02 · Shift open">
        <ShiftOpenScreen t={t} onStart={noop}/>
      </Phone>
      <Phone t={t} label="03 · Catalog">
        <CatalogScreen t={t} tab="catalog" setTab={noop} cartCount={3}
          onCart={noop} search="" setSearch={noop} category="all" setCategory={noop}
          onProductTap={noop} onAddSimple={noop} onOpenParked={noop}/>
      </Phone>
      <Phone t={t} label="04 · Variant sheet">
        <CatalogScreen t={t} tab="catalog" setTab={noop} cartCount={3}
          onCart={noop} search="" setSearch={noop} category="all" setCategory={noop}
          onProductTap={noop} onAddSimple={noop} onOpenParked={noop}/>
        <VariantSheet t={t} product={PRODUCTS[1]} pickerStyle={tweaks.pickerStyle} onClose={noop} onAdd={noop}/>
      </Phone>
      <Phone t={t} label="05 · Cart">
        <CartScreen t={t} lines={demoCart} setLines={noop}
          discount={{ type: 'pct', value: 10 }} setDiscount={noop}
          customer={CUSTOMERS[0]} setCustomerPick={noop}
          onClose={noop} onCheckout={noop} onPark={noop}/>
      </Phone>
      <Phone t={t} label="06 · Payment methods">
        <div style={{ position: 'absolute', inset: 0 }}>
          <PaymentScreen t={t} total={42.08} lines={demoCart} onClose={noop} onSuccess={noop}/>
        </div>
      </Phone>
      <Phone t={t} label="07 · Receipt + thermal">
        <ReceiptScreen t={t} order={demoOrder} onDone={noop} onNewSale={noop}/>
      </Phone>
      <Phone t={t} label="08 · Orders">
        <OrdersScreen t={t} tab="orders" setTab={noop} cartCount={0} onCart={noop}/>
      </Phone>
      <Phone t={t} label="09 · Customers">
        <CustomersScreen t={t} tab="customers" setTab={noop} cartCount={0} onCart={noop}/>
      </Phone>
      <Phone t={t} label="10 · Settings">
        <SettingsScreen t={t} tab="settings" setTab={noop} cartCount={0} onCart={noop} onCloseShift={noop}/>
      </Phone>
      <Phone t={t} label="11 · Shift close">
        <ShiftCloseScreen t={t} onBack={noop}/>
      </Phone>
      <Phone t={t} label="12 · Import products">
        <ImportExportScreen t={t} onBack={noop}/>
      </Phone>
      <Phone t={t} label="13 · Export data">
        <ImportExportScreen t={t} onBack={noop} startMode="export"/>
      </Phone>
    </div>
  );
}

// ─────────── Tweaks panel ───────────
function TweaksPanel({ t, tweaks, setTweak }) {
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 1000,
      width: 280, padding: 16, borderRadius: 18,
      background: t.dark ? 'rgba(26,26,29,0.95)' : 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(20px) saturate(180%)',
      border: `0.5px solid ${t.line2}`, color: t.ink,
      boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
      fontFamily: t.fontUI,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Tweaks</div>
        <div style={{ fontFamily: t.fontMono, fontSize: 10, color: t.ink3 }}>COUNTER · v1</div>
      </div>

      <TwkRow t={t} label="View">
        <Segment t={t} value={tweaks.flow} onChange={v => setTweak('flow', v)}
          options={[['catalog', 'Prototype'], ['all', 'All screens']]}/>
      </TwkRow>

      <TwkRow t={t} label="Theme">
        <Segment t={t} value={tweaks.dark ? 'dark' : 'light'} onChange={v => setTweak('dark', v === 'dark')}
          options={[['light', 'Light'], ['dark', 'Dark']]}/>
      </TwkRow>

      <TwkRow t={t} label="Density">
        <Segment t={t} value={tweaks.density} onChange={v => setTweak('density', v)}
          options={[['cozy', 'Cozy'], ['compact', 'Compact']]}/>
      </TwkRow>

      <TwkRow t={t} label="Variant picker">
        <Segment t={t} value={tweaks.pickerStyle} onChange={v => setTweak('pickerStyle', v)}
          options={[['chips', 'Chips'], ['segmented', 'Segmented']]}/>
      </TwkRow>

      <TwkRow t={t} label={`Accent hue · ${tweaks.accentHue}°`}>
        <input type="range" min="0" max="360" value={tweaks.accentHue}
          onChange={e => setTweak('accentHue', parseInt(e.target.value))}
          style={{ width: '100%', accentColor: t.accentDeep }}/>
      </TwkRow>
    </div>
  );
}
const TwkRow = ({ t, label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <div style={{ fontSize: 11, color: t.ink3, marginBottom: 6, fontWeight: 600 }}>{label}</div>
    {children}
  </div>
);
const Segment = ({ t, value, onChange, options }) => (
  <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' }}>
    {options.map(([v, label]) => (
      <button key={v} onClick={() => onChange(v)} style={{
        flex: 1, padding: '7px 6px', borderRadius: 6, border: 'none',
        background: value === v ? t.surface : 'transparent',
        color: value === v ? t.ink : t.ink2,
        fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: value === v ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
      }}>{label}</button>
    ))}
  </div>
);

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
