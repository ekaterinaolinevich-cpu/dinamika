// Apple Vision OCR через JXA.
// Запуск: osascript -l JavaScript ocr/vision-ocr.js -- /path/to/image.jpg
//
// Vision отдаёт текстовые блоки по отдельности, поэтому склеиваем блоки
// с одинаковой вертикальной позицией в строки — иначе таблица рассыпается.
function run(argv) {
  const args = argv.filter((a) => a !== '--');
  const path = args[args.length - 1];
  if (!path) throw new Error('no path');

  ObjC.import('Vision');
  ObjC.import('Foundation');

  const url = $.NSURL.fileURLWithPath($(path));
  const handler = $.VNImageRequestHandler.alloc.initWithURLOptions(url, $({}));

  const request = $.VNRecognizeTextRequest.alloc.init;
  request.recognitionLevel = 0;
  request.usesLanguageCorrection = false;
  request.recognitionLanguages = $(['ru-RU', 'en-US']);

  const error = $();
  const ok = handler.performRequestsError($([request]), error);
  if (!ok) throw new Error('Vision: ' + ObjC.unwrap(error.localizedDescription));

  const observations = request.results;
  const blocks = [];

  for (let i = 0; i < observations.count; i++) {
    const observation = observations.objectAtIndex(i);
    const candidates = observation.topCandidates(1);
    if (candidates.count === 0) continue;

    const text = ObjC.unwrap(candidates.objectAtIndex(0).string);
    if (!text || !text.trim()) continue;

    const box = observation.boundingBox;
    blocks.push({ text: text.trim(), x: box.origin.x, y: box.origin.y + box.size.height, height: box.size.height });
  }

  blocks.sort((a, b) => (Math.abs(a.y - b.y) > 0.004 ? b.y - a.y : a.x - b.x));

  const lines = [];
  let current = null;

  for (const block of blocks) {
    const sameLine =
      current && Math.abs(block.y - current.y) <= Math.max(0.008, Math.min(block.height, current.height) * 0.55);

    if (!sameLine) {
      if (current) lines.push(current.parts);
      current = { y: block.y, height: block.height, parts: [block] };
    } else {
      current.parts.push(block);
      current.y = Math.min(current.y, block.y);
    }
  }
  if (current) lines.push(current.parts);

  return lines
    .map((parts) => parts.sort((a, b) => a.x - b.x).map((part) => part.text).join(' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}
