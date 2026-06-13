import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth.jsx";
import { metalQuote } from "../../lib/dealer.js";
import { createWholesaleOrder, dealerTierInfo, getDealerProfile, getSettings, listCatalog } from "../../lib/store.js";
import { useDBVersion } from "../../lib/useDB.js";
import { MediaThumb, usd } from "../../components/ui.jsx";
import { pickI18n, useLocale } from "../../i18n.jsx";

export default function DealerCatalog() {
  useDBVersion();
  const { p, locale } = useLocale();
  const c = p.dealer.catalog;
  const o = p.dealer.orderNew;
  const { user } = useAuth();
  const navigate = useNavigate();
  const settings = getSettings();
  const { tier } = dealerTierInfo(user.id);
  const profile = getDealerProfile(user.id);
  const items = listCatalog();
  const [qty, setQty] = useState({});
  const [shipType, setShipType] = useState("dealer");
  const [shipName, setShipName] = useState(user.name);
  const [shipAddr, setShipAddr] = useState("");
  const [error, setError] = useState("");

  const unit = (item) => (tier === 1 ? item.stoneWholesaleT1 : item.stoneWholesaleT2) + metalQuote(item, settings.goldSpotPerGram, settings.goldPurity);
  const lines = items.filter((it) => Number(qty[it.id]) > 0);
  const total = lines.reduce((sum, it) => sum + unit(it) * Number(qty[it.id]), 0);

  function placeOrder(e) {
    e.preventDefault();
    setError("");
    try {
      createWholesaleOrder(
        user.id,
        lines.map((it) => ({ itemId: it.id, qty: Number(qty[it.id]) })),
        { type: shipType, name: shipName, address: shipAddr }
      );
      navigate("/dealer/orders");
    } catch (err) {
      setError(err.message === "resaleCertRequired" ? o.certBlocked : o.empty);
    }
  }

  return (
    <>
      <p className="form-hint" style={{ marginBottom: 18 }}>{p.ftc}</p>
      {!profile.resaleCertNo && <p className="warn-note" style={{ marginBottom: 18 }}>{o.certBlocked}</p>}

      <div className="card-grid cols-3">
        {items.map((item) => {
          const metal = metalQuote(item, settings.goldSpotPerGram, settings.goldPurity);
          const stone = tier === 1 ? item.stoneWholesaleT1 : item.stoneWholesaleT2;
          return (
            <div className="item-card" key={item.id}>
              <MediaThumb media={{ kind: "image", src: item.image }} alt={pickI18n(item.name, locale)} />
              <div className="card-body">
                <h3>{pickI18n(item.name, locale)}</h3>
                <p className="spec">
                  {c.msrp} {usd(item.msrpUsd)}{!item.resizable && <> · <span className="warn-note">{c.nonResizable}</span></>}
                </p>
                <p className="price">{c.yourPrice(tier)}: {usd(stone + metal)}</p>
                <p className="spec">{c.stone} {usd(stone)} + {c.metal} {usd(metal)}</p>
                <p className="spec">{c.metalNote(item.metalGrams, settings.goldSpotPerGram)}</p>
                <label className="field" style={{ marginTop: 8 }}><span>{o.qty}</span>
                  <input type="number" min="0" value={qty[item.id] || ""} onChange={(e) => setQty((q) => ({ ...q, [item.id]: e.target.value }))} />
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <form className="panel form-stack" style={{ marginTop: 24 }} onSubmit={placeOrder}>
        <h3>{o.title}</h3>
        <div className="chip-row">
          <button type="button" className={`chip ${shipType === "dealer" ? "is-active" : ""}`} onClick={() => setShipType("dealer")}>{o.toDealer}</button>
          <button type="button" className={`chip ${shipType === "endBuyer" ? "is-active" : ""}`} onClick={() => setShipType("endBuyer")}>{o.toBuyer}</button>
        </div>
        <label className="field"><span>{o.name}</span><input value={shipName} onChange={(e) => setShipName(e.target.value)} required /></label>
        <label className="field"><span>{o.address}</span><input value={shipAddr} onChange={(e) => setShipAddr(e.target.value)} required /></label>
        <p className="form-hint">{o.quoteNote}</p>
        {error && <p className="form-error">{error}</p>}
        <div className="row-actions" style={{ justifyContent: "space-between" }}>
          <strong className="price">{o.total}: {usd(total)}</strong>
          <button className="button primary" type="submit" disabled={lines.length === 0 || !profile.resaleCertNo}>{o.submit}</button>
        </div>
      </form>
    </>
  );
}
