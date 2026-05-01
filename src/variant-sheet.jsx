// Variant + modifier bottom sheet — the core "variant with different prices" interaction

const VariantSheet = ({ t, product, onClose, onAdd, pickerStyle = 'chips' }) => {
  const [selected, setSelected] = React.useState(() => {
    const init = {};
    if (product?.variants) {
      Object.entries(product.variants).forEach(([k, opts]) => { init[k] = opts[0]; });
    }
    return init;
  });
  const [mods, setMods] = React.useState(() => {
    const init = {};
    (product?.modifiers || []).forEach(m => { if (m.included) init[m.name] = true; });
    return init;
  });
  const [qty, setQty] = React.useState(1);

  if (!product) return null;

  // Price calc: priceMap keyed by variant value takes precedence
  let unit = product.price;
  if (product.priceMap) {
    for (const v of Object.values(selected)) {
      if (product.priceMap[v] !== undefined) { unit = product.priceMap[v]; break; }
    }
  }
  const modTotal = (product.modifiers || []).reduce((s, m) => s + (mods[m.name] ? m.price : 0), 0);
  const line = (unit + modTotal) * qty;

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'flex-end',
      animation: 'fadeIn 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', background: t.surface, borderRadius: '24px 24px 0 0',
        maxHeight: '85%', display: 'flex', flexDirection: 'column',
        animation: 'slideUp 0.25s cubic-bezier(0.2, 0.9, 0.3, 1)',
      }}>
        {/* handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: t.line2 }}/>
        </div>

        <div style={{ overflow: 'auto', padding: '8px 20px 12px' }}>
          {/* Header */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <ProductThumb product={product} size={72} radius={14}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: t.ink, letterSpacing: -0.3 }}>{product.name}</div>
              <div style={{ fontSize: 12, color: t.ink3, fontFamily: t.fontMono, marginTop: 2 }}>{product.sku}</div>
              <div style={{
                marginTop: 4, fontFamily: t.fontMono, fontSize: 15, fontWeight: 600,
                color: t.ink,
              }}>${unit.toFixed(2)}</div>
            </div>
            <button onClick={onClose} style={{
              width: 32, height: 32, borderRadius: 16, border: 'none',
              background: t.surface2, color: t.ink2, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon.close width="16" height="16"/>
            </button>
          </div>

          {/* Variants */}
          {product.variants && Object.entries(product.variants).map(([group, opts]) => (
            <div key={group} style={{ marginTop: 20 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.ink2,
                  textTransform: 'uppercase', letterSpacing: 0.8 }}>{group}</span>
                <span style={{ fontSize: 12, color: t.ink3 }}>{selected[group]}</span>
              </div>
              {pickerStyle === 'segmented' ? (
                <div style={{
                  display: 'flex', background: t.surface2, borderRadius: 12,
                  padding: 3, gap: 2,
                }}>
                  {opts.map(o => {
                    const active = selected[group] === o;
                    const delta = product.priceMap?.[o];
                    return (
                      <button key={o} onClick={() => setSelected(s => ({ ...s, [group]: o }))}
                        style={{
                          flex: 1, padding: '10px 6px', border: 'none',
                          borderRadius: 10, cursor: 'pointer',
                          background: active ? t.surface : 'transparent',
                          color: active ? t.ink : t.ink2,
                          fontFamily: t.fontUI, fontSize: 13, fontWeight: 600,
                          boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                        }}>
                        <span>{o}</span>
                        {delta !== undefined && <span style={{ fontSize: 10, fontFamily: t.fontMono, color: t.ink3 }}>${delta.toFixed(2)}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {opts.map(o => {
                    const active = selected[group] === o;
                    const delta = product.priceMap?.[o];
                    return (
                      <button key={o} onClick={() => setSelected(s => ({ ...s, [group]: o }))}
                        style={{
                          padding: '10px 14px', borderRadius: 12,
                          border: `1px solid ${active ? t.ink : t.line2}`,
                          background: active ? t.ink : 'transparent',
                          color: active ? t.bg : t.ink,
                          fontFamily: t.fontUI, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                        {o}
                        {delta !== undefined && (
                          <span style={{
                            fontSize: 11, fontFamily: t.fontMono,
                            color: active ? 'rgba(255,255,255,0.7)' : t.ink3,
                          }}>${delta.toFixed(2)}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Modifiers */}
          {product.modifiers && (
            <div style={{ marginTop: 22 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: t.ink2,
                textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
                Modifiers
              </div>
              <div style={{
                background: t.surface2, borderRadius: 14, overflow: 'hidden',
                border: `0.5px solid ${t.line}`,
              }}>
                {product.modifiers.map((m, i) => {
                  const on = !!mods[m.name];
                  return (
                    <button key={m.name} onClick={() => setMods(s => ({ ...s, [m.name]: !on }))}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 14px', border: 'none', background: 'transparent',
                        borderBottom: i < product.modifiers.length - 1 ? `0.5px solid ${t.line}` : 'none',
                        cursor: 'pointer', textAlign: 'left', fontFamily: t.fontUI,
                      }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        border: `1.5px solid ${on ? t.accentDeep : t.line2}`,
                        background: on ? t.accentDeep : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', flexShrink: 0,
                      }}>{on && <Icon.check width="14" height="14"/>}</div>
                      <span style={{ flex: 1, fontSize: 14, color: t.ink }}>{m.name}</span>
                      <span style={{ fontFamily: t.fontMono, fontSize: 13, color: m.price ? t.ink2 : t.ink3 }}>
                        {m.price ? `+$${m.price.toFixed(2)}` : 'Free'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Qty + note */}
          <div style={{ marginTop: 22, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: t.ink2,
              textTransform: 'uppercase', letterSpacing: 0.8 }}>Quantity</span>
            <QtyStepper t={t} value={qty} onChange={setQty}/>
          </div>
        </div>

        {/* Sticky add bar */}
        <div style={{
          padding: '12px 20px 24px', borderTop: `0.5px solid ${t.line}`,
          background: t.surface,
        }}>
          <button onClick={() => {
            onAdd({
              product, qty, selected, mods, unit,
              modTotal,
            });
            onClose();
          }} style={{
            width: '100%', height: 54, borderRadius: 16, border: 'none',
            background: t.ink, color: t.bg, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px', fontFamily: t.fontUI, fontSize: 16, fontWeight: 600,
          }}>
            <span>Add {qty > 1 ? `${qty} × ` : ''}to order</span>
            <span style={{ fontFamily: t.fontMono }}>${line.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const QtyStepper = ({ t, value, onChange, size = 'md' }) => {
  const h = size === 'sm' ? 32 : 40;
  const btnW = size === 'sm' ? 32 : 40;
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      background: t.surface2, borderRadius: h / 2, border: `0.5px solid ${t.line}`,
      height: h,
    }}>
      <button onClick={() => onChange(Math.max(1, value - 1))} style={{
        width: btnW, height: h, border: 'none', background: 'transparent',
        color: value <= 1 ? t.ink3 : t.ink, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon.minus width="16" height="16"/></button>
      <div style={{
        minWidth: 28, textAlign: 'center', fontFamily: t.fontMono,
        fontSize: size === 'sm' ? 14 : 15, fontWeight: 600, color: t.ink,
      }}>{value}</div>
      <button onClick={() => onChange(value + 1)} style={{
        width: btnW, height: h, border: 'none', background: 'transparent',
        color: t.ink, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Icon.plus width="16" height="16"/></button>
    </div>
  );
};

Object.assign(window, { VariantSheet, QtyStepper });
