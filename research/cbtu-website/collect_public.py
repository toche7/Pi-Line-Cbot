"""Read public CBTU catalog HTML only. No authentication or learner data retained."""
import json, re, sys, time, hashlib
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.request import build_opener, HTTPRedirectHandler, Request
from urllib.parse import urlsplit, urlunsplit, quote
from pathlib import Path

ROOT = Path(__file__).resolve().parent
class Node:
    def __init__(self, tag='', attrs=(), parent=None):
        self.tag, self.attrs, self.parent, self.children = tag, dict(attrs), parent, []
    def text(self):
        return re.sub(r'\s+', ' ', ' '.join(c.text() if isinstance(c,Node) else c for c in self.children)).strip()
    def find(self, pred):
        out=[]
        for c in self.children:
            if isinstance(c,Node):
                if pred(c): out.append(c)
                out.extend(c.find(pred))
        return out
    def has(self, name): return name in self.attrs.get('class','').split()
class Parser(HTMLParser):
    def __init__(self,h):
        super().__init__(convert_charrefs=True); self.root=Node(); self.cur=self.root; self.feed(h)
    def handle_starttag(self,t,a):
        n=Node(t,a,self.cur); self.cur.children.append(n)
        if t not in ('area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'): self.cur=n
    def handle_startendtag(self,t,a): self.handle_starttag(t,a); self.handle_endtag(t)
    def handle_endtag(self,t):
        n=self.cur
        while n.parent:
            if n.tag==t: self.cur=n.parent; return
            n=n.parent
    def handle_data(self,d):
        if self.cur.tag not in ('script','style'): self.cur.children.append(d)
def fetch(u):
    from catalog_validation import ALLOWED_HOSTS
    def public_url(url):
        p=urlsplit(url)
        if p.scheme!='https' or p.hostname not in ALLOWED_HOSTS or p.username or p.password or p.port not in (None,443):
            raise ValueError('Fetch target/redirect must be an allowed public HTTPS source')
        return urlunsplit((p.scheme,p.netloc,quote(p.path,safe='/%'),quote(p.query,safe='=&%[]+/:?'),''))
    class PublicRedirect(HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,headers,newurl):
            return super().redirect_request(req,fp,code,msg,headers,public_url(newurl))
    with build_opener(PublicRedirect()).open(Request(public_url(u),headers={'User-Agent':'CBTU-Public-Catalog-Research/1.1'}),timeout=40) as r:
        h=r.read().decode('utf-8'); final=r.url
    return Parser(h).root, {'requested_url':u,'resolved_url':final,'retrieved_at':datetime.now(timezone.utc).isoformat(),'html_sha256':hashlib.sha256(h.encode()).hexdigest()}
def cards(doc):
    return [{'name':a.text(),'url':a.attrs['href'],'listing_text':n.text()} for n in doc.find(lambda n:n.has('tutor-course-card')) for a in n.find(lambda n:n.tag=='h3' and n.has('tutor-course-name')) for a in a.find(lambda n:n.tag=='a')]

if __name__=='__main__':
    import argparse
    from catalog_validation import atomic_json
    parser=argparse.ArgumentParser(description='Stage HTTP listing observations; query pagination may repeat page 1')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if ROOT not in args.output.resolve().parents or 'staging' not in args.output.resolve().relative_to(ROOT).parts:
        raise SystemExit('Output must be within this research directory / staging')
    results=[]
    for base,count in [('https://cbtumu.net/',4),('https://cbtumu.net/coursescurrent/',3)]:
        for page in range(1,count+1):
            u=base+(f'?current_page={page}' if page>1 else '')
            d,p=fetch(u); cs=cards(d)
            results.append({'provenance':p,'courses':cs,'pagination':[n.text() for n in d.find(lambda n:n.has('tutor-pagination-hints'))]})
            print(u,json.dumps(cs,ensure_ascii=False),flush=True); time.sleep(.3)
    atomic_json(args.output,results)
