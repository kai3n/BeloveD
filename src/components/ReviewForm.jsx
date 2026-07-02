// 리뷰 작성 — 미디어 퍼스트: 인증샷부터, 별점, 한 줄. 포털/전용 페이지 공용.
import { useState } from "react";
import { MediaPicker } from "./ui.jsx";
import { submitReview } from "../lib/store.js";

// 리뷰 작성 — 미디어 퍼스트: 인증샷부터, 별점, 한 줄
export default function ReviewForm({ orderId, rc, onDone }) {
  const [media, setMedia] = useState([]);
  const [rating, setRating] = useState(5);
  const [quote, setQuote] = useState("");
  const [body, setBody] = useState("");
  function submit() {
    if (!quote.trim()) return;
    submitReview(orderId, { rating, quote, body, media });
    onDone?.();
  }
  return (
    <div className="form-stack review-form">
      <div className="field"><span>{rc.mediaLbl}</span>
        <MediaPicker value={media} onChange={setMedia} maxItems={5} showSamples={false} previewMode="list" scope="review" />
      </div>
      <div className="field"><span>{rc.rating}</span>
        <div className="review-stars" role="radiogroup" aria-label={rc.rating}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" className={n <= rating ? "is-on" : ""} aria-label={`${n}`} onClick={() => setRating(n)}>★</button>
          ))}
        </div>
      </div>
      <label className="field"><span>{rc.quoteLbl}</span>
        <input value={quote} placeholder={rc.quotePh} onChange={(e) => setQuote(e.target.value)} />
      </label>
      <label className="field"><span>{rc.bodyLbl}</span>
        <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <p className="form-hint">{rc.note}</p>
      <button className="button primary" type="button" disabled={!quote.trim()} onClick={submit}>{rc.submit}</button>
    </div>
  );
}
