import { useCallback, useEffect, useState } from "react";
import { readArtworkDraft, writeArtworkDraft } from "../lib/readyMadeArtwork";

export default function useReadyMadeArtwork(key) {
  const [draft, setDraft] = useState({ key: "", files: [], ready: false });
  const [storageError, setStorageError] = useState("");
  useEffect(() => {
    let active = true;
    setStorageError("");
    if (!key) { setDraft({ key, files: [], ready: true }); return; }
    readArtworkDraft(key).then((files) => {
      if (active) setDraft({ key, files, ready: true });
    }).catch(() => {
      if (active) {
        setDraft({ key, files: [], ready: true });
        setStorageError("Keep this tab open until checkout. This browser could not save your artwork for a later visit.");
      }
    });
    return () => { active = false; };
  }, [key]);
  useEffect(() => {
    if (!key || draft.key !== key || !draft.ready) return;
    let active = true;
    writeArtworkDraft(key, draft.files).then(() => {
      if (active) setStorageError("");
    }).catch(() => {
      if (active) setStorageError("Keep this tab open until checkout. This browser could not save your artwork for a later visit.");
    });
    return () => { active = false; };
  }, [key, draft]);
  const setFiles = useCallback((update) => setDraft((current) => current.key !== key || !current.ready
    ? current
    : { ...current, files: typeof update === "function" ? update(current.files) : update }), [key]);
  return { files: draft.key === key ? draft.files : [], ready: draft.key === key && draft.ready, setFiles, storageError };
}
