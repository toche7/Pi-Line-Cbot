"""Public marketing metadata only; never follow lesson or video links."""
import json
import re
from pathlib import Path
from collect_public import ROOT, fetch
from concurrent.futures import ThreadPoolExecutor
import argparse
from catalog_validation import atomic_json, now

def explicit_lines(node):
    def render(n):
        if isinstance(n,str):return n
        if n.tag=='br':return '\n'
        return ''.join(render(c) for c in n.children)
    return [re.sub(r'\s+',' ',s).strip() for s in render(node).split('\n') if s.strip()]
def detail(u):
    try:
        d,p=fetch(u)
        canon=d.find(lambda n:n.tag=='link' and n.attrs.get('rel')=='canonical')
        titles=d.find(lambda n:n.tag=='h1')
        about=d.find(lambda n:n.has('tutor-course-details-content'))
        blocks=d.find(lambda n:n.has('tutor-course-details-widget') or n.has('tutor-card-body') or n.has('tutor-card-footer'))
        events=[]
        if about:
            for n in about[0].find(lambda n:n.tag in ('h2','h3','h4','h5','h6','p','li')):
                parent=n.parent
                while parent and parent is not about[0] and parent.tag not in ('p','li'):parent=parent.parent
                if parent is about[0]:
                    if n.text():events.append({'tag':n.tag,'text':n.text(),'lines':explicit_lines(n)})
        retained=[]; active=False
        for e in events:
            if e['tag'].startswith('h'):
                active=e['text'].strip() in {'ผู้สอน','อาจารย์ผู้สอน','วิทยากร','Instructor','Instructors'}
                retained.append(e)
            elif active:retained.append(e)
        return {'status':'ok','requested_url':u,'error':None,'provenance':p,'canonical_url':canon[0].attrs['href'] if canon else None,'name':titles[0].text() if titles else None,'about_present':bool(about),'marketing_events':retained,'blocks':[{'class':n.attrs.get('class'),'text':n.text()} for n in blocks if n.has('tutor-card-body') or n.has('tutor-card-footer')], 'public_links':sorted({n.attrs['href'] for n in (about[0].find(lambda n:n.tag=='a' and 'href' in n.attrs) if about else [])})}
    except Exception as e:
        return {'status':'error','requested_url':u,'error':str(e),'provenance':None,'canonical_url':None,'name':None,'about_present':False,'marketing_events':[],'blocks':[],'public_links':[]}
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,required=True,help='Staging file, never courses.json')
    args=parser.parse_args()
    if ROOT not in args.output.resolve().parents or 'staging' not in args.output.resolve().relative_to(ROOT).parts:
        raise SystemExit('Output must be inside this research directory / staging')
    manifest=json.loads((ROOT/'catalog_manifest.json').read_text())
    urls=[r['canonical_url'] for r in manifest['records']]
    with ThreadPoolExecutor(max_workers=3) as ex: data=list(ex.map(detail,urls))
    atomic_json(args.output,{'collector_schema_version':'1.0.0','collected_at':now(),'records':data})
    for x in data: print(x.get('name'),x.get('error') or 'OK')
