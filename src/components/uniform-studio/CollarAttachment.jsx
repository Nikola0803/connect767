import { useEffect, useRef, useState } from "react";

const allowedTypes = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export default function CollarAttachment({ attachment, onChange }) {
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const readerRef = useRef(null);
  useEffect(() => () => readerRef.current?.abort(), []);
  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    readerRef.current?.abort();
    setReading(false);
    setError("");
    if (!allowedTypes.includes(file.type)) {
      setError("Choose a PNG, JPG, WebP or PDF file.");
      return;
    }
    if (file.size === 0 || file.size > 2 * 1024 * 1024) {
      setError("Choose a non-empty file up to 2 MB.");
      return;
    }
    const reader = new FileReader();
    readerRef.current = reader;
    setReading(true);
    reader.onload = () => {
      onChange({ name: file.name, type: file.type, size: file.size, src: reader.result });
      setReading(false);
    };
    reader.onerror = () => {
      setError("This file could not be read. Please try again.");
      setReading(false);
    };
    reader.readAsDataURL(file);
  };
  return <div className="mt-1.5 space-y-1">
    <label className="block text-[11px] font-semibold text-foreground-800">
      Attach collar logo or artwork
      <input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={chooseFile} className="mt-1 block w-full min-w-0 text-[10px] text-foreground-700 file:mr-2 file:cursor-pointer file:rounded-md file:border file:border-background-300 file:bg-background-50 file:px-2 file:py-1 file:text-foreground-800" />
    </label>
    <p className="text-[9px] leading-tight text-foreground-500">PNG, JPG, WebP or PDF · up to 2 MB.</p>
    {reading && <p role="status" className="text-xs text-foreground-600">Attaching file…</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    {attachment && <div className="flex min-w-0 items-center gap-2 rounded-lg border border-background-300 p-2">
      {attachment.type.startsWith("image/") ? <img src={attachment.src} alt="Attached collar artwork" className="h-10 w-10 shrink-0 rounded bg-white object-contain" /> : <i className="ri-file-pdf-2-line text-xl" aria-hidden="true" />}
      <span className="min-w-0 flex-1 break-all text-xs text-foreground-800">{attachment.name}</span>
      <button type="button" onClick={() => onChange(null)} className="cursor-pointer text-xs font-semibold text-red-700" aria-label="Remove collar attachment">Remove</button>
    </div>}
  </div>;
}
