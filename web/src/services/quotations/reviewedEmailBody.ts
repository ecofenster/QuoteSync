// Parse only in an inert template: retained Email HTML is never mounted or run.
export function reviewedEmailText(html: string): string {
  const template=document.createElement('template');
  template.innerHTML=html;
  template.content.querySelectorAll('script,style,iframe,object,template').forEach(node=>node.remove());
  template.content.querySelectorAll('br').forEach(node=>node.replaceWith('\n'));
  template.content.querySelectorAll('p,div,li,tr,h1,h2,h3,blockquote').forEach(node=>node.append('\n'));
  template.content.querySelectorAll('a[href]').forEach(node=>{
    const href=node.getAttribute('href')||'';
    if(/^(https?:|mailto:)/i.test(href)&&node.textContent?.trim()!==href)node.append(` (${href})`);
  });
  return (template.content.textContent||'').replace(/\r\n?/g,'\n').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}

export function reviewedEmailHtml(text: string, originalHtml: string): string {
  if(text===reviewedEmailText(originalHtml))return originalHtml;
  const escaped=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  return `<p>${escaped.replace(/\r\n?/g,'\n').replace(/\n/g,'<br>')}</p>`;
}
