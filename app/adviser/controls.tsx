'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Square, ImagePlus, X } from 'lucide-react';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, safeWebUrl, type WebSource } from './shared';
type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null; start(): void; stop(): void; abort(): void;
};
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
export function AdviserInputs({ question, setQuestion, image, setImage, busy, listening, setListening, research, setResearch }: {
  question: string; setQuestion: (value: string) => void; image: string | null; setImage: (value: string | null) => void;
  busy: boolean; listening: boolean; setListening: (value: boolean) => void; research: boolean; setResearch: (value: boolean) => void;
}) {
  const recognition = useRef<Recognition | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState('');
  const [imageError, setImageError] = useState('');
  const [reading, setReading] = useState(false);
  const selection = useRef(0);
  useEffect(() => {
    const browser = window as SpeechWindow;
    setSupported(Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition));
    return () => {
      selection.current++;
      if (recognition.current) { recognition.current.onend = null; recognition.current.onresult = null; recognition.current.onerror = null; recognition.current.abort(); }
      setListening(false);
    };
  }, [setListening]);
  function start() {
    const browser = window as SpeechWindow;
    const Constructor = browser.SpeechRecognition || browser.webkitSpeechRecognition;
    if (!Constructor) { setStatus('Voice is unsupported in this browser. Type your question instead.'); return; }
    if (!window.isSecureContext) { setStatus('Microphone access needs HTTPS or localhost.'); return; }
    const rec = new Constructor(); recognition.current = rec;
    rec.lang = 'en-ZA'; rec.continuous = true; rec.interimResults = true;
    const initial = question.trim(); let heard = false; let failed = false;
    rec.onresult = event => {
      const transcript = Array.from(event.results).map(result => result[0].transcript).join(' ');
      heard = Boolean(transcript.trim());
      setQuestion([initial, transcript].filter(Boolean).join(' ').slice(0, 500));
    };
    rec.onerror = event => {
      failed = true;
      setStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'Microphone permission denied. Allow microphone access in your browser settings, then retry.' : event.error === 'no-speech' ? 'No speech detected. Try again or type your question.' : event.error === 'audio-capture' ? 'No microphone is available. Connect one or type your question.' : 'Transcription failed. Check your connection, retry, or type your question.');
      setListening(false);
    };
    rec.onend = () => { setListening(false); recognition.current = null; if (!failed) setStatus(heard ? 'Recording stopped. Review or edit the question, then press Ask BizWise.' : 'No speech detected. Try again or type your question.'); };
    try { rec.start(); setListening(true); setStatus('Listening… Speak your question, then press Stop.'); }
    catch { setListening(false); setStatus('Could not start transcription. Retry or type your question.'); }
  }
  async function attach(file?: File) {
    if (!file) return;
    const version = ++selection.current;
    setImageError(''); setImage(null);
    if (!IMAGE_TYPES.includes(file.type)) { setImageError('Choose JPEG, PNG or WebP. Export HEIC or PDF as an image first.'); return; }
    if (!file.size || file.size > MAX_IMAGE_BYTES) { setImageError('Choose a non-empty image under 3 MB.'); return; }
    setReading(true);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      await new Promise<void>((resolve, reject) => { const preview = new Image(); preview.onload = () => { if (preview.naturalWidth * preview.naturalHeight > 20000000) reject(); else resolve(); }; preview.onerror = reject; preview.src = data; });
      if (version === selection.current) setImage(data);
    } catch { if (version === selection.current) setImageError('Cannot read this image. Export a valid image under 20 megapixels and retry.'); }
    finally { if (version === selection.current) setReading(false); }
  }
  return <>
    <div className="actions adviser-controls">
      <button type="button" className="ghost" disabled={busy || !supported} aria-pressed={listening} onClick={() => { if (listening) { recognition.current?.stop(); setStatus('Finishing transcription…'); } else start(); }}>
        {listening ? <Square size={18}/> : <Mic size={18}/>} {listening ? 'Stop recording' : 'Speak question'}
      </button>
      <button type="button" className="ghost" disabled={busy || reading} onClick={() => fileInput.current?.click()}><ImagePlus size={18}/>{reading ? 'Reading image…' : 'Attach image'}</button>
      <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => { void attach(event.target.files?.[0]); event.target.value = ''; }}/>
    </div>
    <p className="muted compact" role="status" aria-live="polite">{supported ? status || 'Voice fills the question box; review before submitting.' : 'Voice is unsupported in this browser. You can still type your question.'}</p>
    <p className="muted compact">Voice may send audio to your browser’s speech service and needs an internet connection. Images are sent to Groq when you ask; the original image is not saved. JPEG, PNG or WebP, up to 3 MB.</p>
    {imageError && <p role="alert" className="notice error">{imageError}</p>}
    {image && <div className="attachment"><img src={image} alt="Image attached for adviser review"/><button type="button" className="ghost" disabled={busy} onClick={() => { selection.current++; setImage(null); }}><X size={18}/> Remove image</button></div>}
    <label className="research-toggle"><input type="checkbox" checked={research} disabled={busy} onChange={event => setResearch(event.target.checked)}/> Research the public web</label>
    <p className="muted compact">Competitor and local-area questions also trigger search automatically. Your question and saved town go to Serper; shop records and attachments do not.</p>
  </>;
}
export function Sources({ sources, searched }: { sources?: WebSource[]; searched?: boolean }) {
  if (!searched) return null;
  return <div className="web-sources"><h3>Public web sources</h3><p className="muted compact">Public claims, separate from your Supabase shop records. Retrieval dates are not publication dates.</p>
    {!sources?.length && <p>No usable sources were returned. Local coverage may be incomplete.</p>}
    {sources?.filter(source => safeWebUrl(source.url)).map(source => <div key={source.id} className="source"><a href={source.url} target="_blank" rel="noopener noreferrer">[{source.id}] {source.title}</a><p className="muted compact">{source.published ? `Source date (as reported): ${source.published}. ` : 'Publication date unavailable. '}Retrieved: {source.retrieved}</p><details><summary>Search excerpt</summary><p>{source.content}</p></details></div>)}
  </div>;
}
