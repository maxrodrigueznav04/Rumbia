// Keep the client copy aligned; the release test checks parity.
export function fittedFieldFontSize(element, text) {
  const original = element.style?.fontSize || 18;
  if (element.type !== 'field' || !['trip.title', 'trip.destination', 'agency.name'].includes(element.field)) return original;
  const value = String(text || '');
  const widthPt = element.width * 0.595 * 0.9;
  const heightPt = element.height * 0.842 * 0.9;
  const weight = (word) => [...word].reduce((sum, char) => sum + ('il.,:;!|'.includes(char) ? 0.45 : 'MWÁÉÍÓÚ'.includes(char) ? 1.25 : 1), 0);
  const minimum = Math.min(original, 12);
  for (let size = original; size >= minimum; size -= 1) {
    let lines = 0;
    for (const paragraph of value.split('\n')) {
      lines += 1;
      let used = 0;
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const wordWidth = weight(word) * size * 0.56;
        const space = used ? size * 0.3 : 0;
        if (used && used + space + wordWidth > widthPt) { lines += 1; used = 0; }
        used += (used ? space : 0) + wordWidth;
      }
    }
    if (lines * size * 1.18 <= heightPt) return size;
  }
  return minimum;
}
