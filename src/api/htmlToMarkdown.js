/**
 * Converts an HTML string to structured Markdown.
 * Preserves headings, lists, bold/italic, paragraphs.
 * Strips nav, header, footer, script, style, aside.
 * @param {string} html
 * @returns {string}
 */
export function htmlToMarkdown(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  doc
    .querySelectorAll('script, style, noscript, nav, header, footer, aside')
    .forEach((el) => el.remove());

  return convertNode(doc.body).replace(/\n{3,}/g, '\n\n').trim();
}

function convertNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent.replace(/\s+/g, ' ');
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';

  const tag = node.tagName.toLowerCase();
  const children = () => Array.from(node.childNodes).map(convertNode).join('');

  switch (tag) {
    case 'h1': return `\n# ${node.textContent.trim()}\n\n`;
    case 'h2': return `\n## ${node.textContent.trim()}\n\n`;
    case 'h3': return `\n### ${node.textContent.trim()}\n\n`;
    case 'h4': return `\n#### ${node.textContent.trim()}\n\n`;
    case 'p':  return `${node.textContent.trim()}\n\n`;
    case 'strong': case 'b': return `**${children()}**`;
    case 'em':     case 'i': return `*${children()}*`;
    case 'br':  return '\n';
    case 'ul':  return convertList(node, false);
    case 'ol':  return convertList(node, true);
    case 'li':  return children(); // prefix added by parent
    case 'a':   return children(); // keep text, drop href
    default:    return children();
  }
}

function convertList(node, ordered) {
  const items = Array.from(node.children).filter(
    (el) => el.tagName.toLowerCase() === 'li'
  );
  const lines = items.map((li, i) => {
    const prefix = ordered ? `${i + 1}. ` : '- ';
    return `${prefix}${li.textContent.trim()}`;
  });
  return `\n${lines.join('\n')}\n\n`;
}
