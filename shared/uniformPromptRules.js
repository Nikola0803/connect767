export function basketballSocksRequested(prompt, previouslyRequested = false) {
  const text = String(prompt || "");
  if (/\b(?:no|without|omit|exclude|remove)\s+(?:(?:any|the|all|matching|basketball|long)\s+){0,2}socks?\b/i.test(text)
    || /\b(?:do not|don't|dont|never)\s+(?:add|include|generate|show|render)\s+(?:any\s+)?socks?\b/i.test(text)) return false;
  return /\bsocks?\b/i.test(text) || previouslyRequested === true;
}

export function basketballKitRule(includeSocks) {
  return "Basketball uses sleeveless jerseys and shorts only: no polo collar, short sleeves or long sleeves. " + (includeSocks
    ? "The customer explicitly requested socks. Include matching socks in every view, following the solid-colour and three knee-stripe production rules."
    : "The customer did not request socks. Do not generate socks, shoes or other legwear in any view, even if a reference image, previous image, palette or design summary contains socks. Ignore unused sock colour values.");
}
