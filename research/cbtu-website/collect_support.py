"""Collect public support-page text as temporary input, excluding reviews/media."""
from pathlib import Path
from collect_public import ROOT, fetch

URLS=['https://cbtumu.net/faq/','https://cbtumu.net/payment/','https://cbtumu.net/about-cbtu/','https://cbtumu.net/contactus/','https://cbtumu.net/mini-data-science-10-completion/','https://cbtumu.net/hermes-agent-training-cbtu-mu/','https://miniaiagentweb-production.up.railway.app/apply','https://minidswebsite-production.up.railway.app/apply']
if __name__=='__main__':
    import argparse
    from catalog_validation import atomic_json
    parser=argparse.ArgumentParser(description='Stage support sources for manual review; never publish FAQ automatically')
    parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args()
    if ROOT not in args.output.resolve().parents or 'staging' not in args.output.resolve().relative_to(ROOT).parts:
        raise SystemExit('Output must be within this research directory / staging')
    data=[]
    for u in URLS:
        d,p=fetch(u)
        nodes=d.find(lambda n:n.tag=='main' or n.attrs.get('id')=='content')
        data.append({'provenance':p,'working_text':nodes[0].text() if nodes else d.text()})
    atomic_json(args.output,data)
    print('Staged',len(data),'support sources. Manual review required; catalog builder does not publish these.')
