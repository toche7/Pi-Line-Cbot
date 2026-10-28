"""Stage a curated catalog refresh; never discover/delete courses automatically.

Authored summaries and old schedules need review. Only explicit public teacher,
price and status metadata is refreshed. Support/FAQ files are not regenerated.
"""
import argparse
from copy import deepcopy
from datetime import datetime
from pathlib import Path
import re
from zoneinfo import ZoneInfo
from catalog_validation import ROOT, VERSION, atomic_json, canonical, load, missing_fields, now, publish, validate

def explicit_teachers(detail):
    names=[]; active=False
    for e in detail.get('marketing_events',[]):
        if e['tag'].startswith('h'):
            active=e['text'].strip() in {'ผู้สอน','อาจารย์ผู้สอน','วิทยากร','Instructor','Instructors'}
        elif active and e['tag'] in ('p','li'):
            for line in e.get('lines',[e['text']]):
                if re.match(r'คณะ|มหาวิทยาลัย|สังกัด|Faculty|University',line,re.I):continue
                if 2<=len(line)<=120 and not re.search(r'\bBy\b|https?://|[!?]',line):names.append(line)
    return list(dict.fromkeys(names))

def bundle_teachers(detail):
    result={}; title=None
    for e in detail.get('marketing_events',[]):
        if e['tag']=='h3':title=e['text']
        match=re.fullmatch(r'อาจารย์ผู้สอน\s+(.+)',e['text'])
        if title and match:result.setdefault(title,[]).append(match.group(1))
    return result

def evidence(name,d,kind,context=None):
    return {'name':name,'source_url':d['canonical_url'],'source_type':kind,
            'excerpt':f'{context+" | " if context else ""}ผู้สอน {name}',
            'provenance':deepcopy(d['provenance'])}

def make_candidate(seed,details,manifest,*,migration=False):
    if details.get('collector_schema_version')!='1.0.0':raise ValueError('Unsupported detail collector schema version')
    data=deepcopy(seed); expected={r['id']:r for r in manifest['records']}
    if len(expected)!=len(manifest['records']) or set(expected)!={c['id'] for c in seed['courses']}:
        raise ValueError('Manifest/seed mismatch or duplicate IDs; owner must review additions/removals')
    records=details['records']; by_url={canonical(d['canonical_url']):d for d in records if d.get('canonical_url')}
    if len(by_url)!=sum(bool(d.get('canonical_url')) for d in records):raise ValueError('Duplicate detail URLs')
    errors=[]; name_review=[]; collected=[]
    failures={canonical(d['requested_url']):d['error'] for d in records if d.get('error') and d.get('requested_url')}
    bundle=next((d for d in records if '/course-bundle/' in (d.get('canonical_url') or '')),None)
    bundle_names=bundle_teachers(bundle) if bundle else {}
    for c,old in zip(data['courses'],seed['courses']):
        if canonical(c['canonical_url'])!=canonical(expected[c['id']]['canonical_url']):raise ValueError('Stable manifest URL changed')
        if c['record_type']!=expected[c['id']]['record_type']:raise ValueError('Manifest record_type changed')
        d=by_url.get(canonical(c['canonical_url']))
        if not d or d.get('error'):
            errors.append({'id':c['id'],'url':c['canonical_url'],'error':failures.get(canonical(c['canonical_url']),'Missing/failed detail fetch; retain previous and block publish')})
            continue
        if not d.get('name') or not d.get('provenance'):raise ValueError('Missing source name/provenance')
        protected=d['name'].startswith('Protected: ')
        if not protected and not d.get('about_present'):raise ValueError(f'{c["id"]}: About section missing')
        c.update(name=d['name'].removeprefix('Protected: '),canonical_url=d['canonical_url'],
                 detail_access='password_protected' if protected else 'public',provenance=d['provenance'])
        collected.append(d['provenance']['retrieved_at'])
        c.setdefault('catalog_author_text',None);c.setdefault('included_course_ids',[])
        c['enrollment'].setdefault('catalog_observed_text',None)
        names=explicit_teachers(d); alternate=bundle_names.get(c['name'],[])
        ev=[evidence(n,d,'course_detail') for n in names]
        if not names and alternate and bundle:ev=[evidence(n,bundle,'explicit_bundle_teacher',c['name']) for n in alternate]
        if c['record_type']=='bundle' and bundle:
            ev=[evidence(n,bundle,'explicit_bundle_teacher',title) for title,ns in bundle_names.items() for n in ns]
        unique={}
        for e in ev:unique.setdefault(re.sub(r'\s+','',e['name']),e)
        ev=list(unique.values());c['instructor_evidence']=ev
        c['instructors']=[{k:e[k] for k in ('name','source_url','source_type')} for e in ev] or None
        if names and alternate and {re.sub(r'\s+','',n) for n in names}!={re.sub(r'\s+','',n) for n in alternate}:
            c['flags'].append('alternate_teacher_name_forms_in_bundle_require_review')
            name_review.append({'id':c['id'],'direct_names':names,'direct_url':d['canonical_url'],
                                'bundle_names':alternate,'relationship':'unresolved; no alias/person merge',
                                'bundle_evidence':[evidence(n,bundle,'explicit_bundle_teacher',c['name']) for n in alternate]})
        if c['instructors'] is None:c['flags'].append('explicit_teacher_not_found_catalog_author_not_promoted')
        if c['instructors_text'] and 'By ใน catalog' in c['instructors_text']:
            c['flags'].append('legacy_instructors_text_contains_catalog_author_unverified_as_teacher')
        c['dates']={'raw':c['session_dates_text'],'parsed':c.get('dates',{}).get('parsed')}
        c['flags'].append('curated_summary_and_schedule_need_review_after_refresh')
        if not migration:c['flags'].append('catalog_listing_not_reenumerated_by_manifest_refresh')
        c['field_sources']['instructors_text']='Legacy raw field retained; use instructors + instructor_evidence for verified teachers.'
        for key in ['description_th,topics,learning_outcomes_th','format_th,duration_text,session_dates_text','audience_th,prerequisites_th','certificate']:
            if ' | reviewed snapshot retrieved_at=' not in c['field_sources'][key]:
                c['field_sources'][key]+=' | reviewed snapshot retrieved_at='+old['provenance']['retrieved_at']
        body=next((b['text'] for b in d['blocks'] if b['class']=='tutor-card-body'),'')
        footer=next((b['text'] for b in d['blocks'] if b['class'].startswith('tutor-card-footer')),'')
        if not protected and not body:raise ValueError(f'{c["id"]}: price/status widget missing')
        prices=[float(s.replace(',','')) for s in re.findall(r'฿([\d,.]+)',body)]
        free=bool(re.search(r'\bFree\b',body))
        c['price']={'displayed_amount':prices[0] if prices else (0 if free else None),'currency':'THB' if prices else None,
                    'reference_amount':prices[1] if len(prices)>1 else None,'label':'Free' if free else None,'is_current_offer_verified':False}
        status=next((s for s in ['Enrollment is now closed','This course is full right now.','Enroll Now','Add to Cart'] if s in body),None)
        c['enrollment']['observed_text']=status if not protected else c['enrollment']['observed_text']
        c['enrollment']['is_live_availability_verified']=False
        c['evidence']['pricing_and_status_excerpt']=body[:130] or None
        c['evidence']['duration_and_certificate_excerpt']=re.sub(r'\d+ Total Enrolled','[aggregate omitted]',footer) or None
        c['evidence']['named_teachers_excerpt']='ผู้สอน '+'; '.join(names) if names else None
        c['additional_public_links']=d['public_links'];c['flags']=list(dict.fromkeys(c['flags']))
        c['missing_fields']=missing_fields(c)
    data['schema_version']=VERSION
    data['collection_date']=datetime.fromisoformat(max(collected)).astimezone(ZoneInfo('Asia/Bangkok')).date().isoformat() if collected else seed['collection_date']
    data['collection']={'built_at':now(),'mode':'reviewed_snapshot_migration' if migration else 'curated_manifest_refresh',
                        'expected_ids':list(expected),'fetch_errors':errors,'coverage':'incomplete' if errors else 'complete',
                        'summary_policy':'Existing authored summaries/raw schedules retained from reviewed snapshot. Fresh teacher/price/status metadata only. Re-review authored text before runtime ingestion.',
                        'listing_coverage_ref':'catalog_observations.json (historical UI enumeration; refresh is not fresh discovery)'}
    return data,name_review

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--details',type=Path,required=True);p.add_argument('--stage-dir',type=Path,required=True)
    p.add_argument('--seed',type=Path,default=ROOT/'courses.json')
    p.add_argument('--migration',action='store_true');p.add_argument('--publish',action='store_true')
    args=p.parse_args()
    if ROOT not in args.stage_dir.resolve().parents or 'staging' not in args.stage_dir.resolve().relative_to(ROOT).parts:
        raise SystemExit('Stage directory must be within research/cbtu-website/staging')
    args.stage_dir.mkdir(parents=True,exist_ok=True)
    try:
        seed=load(args.seed);candidate,review=make_candidate(seed,load(args.details),load(ROOT/'catalog_manifest.json'),migration=args.migration)
        target=args.stage_dir/'courses.json';atomic_json(target,candidate)
        atomic_json(args.stage_dir/'instructor_review.json',review)
        report=publish(target) if args.publish else validate(candidate,seed)
    except Exception as e:
        report={'valid':False,'validated_at':now(),'errors':[{'code':'build_failed','message':str(e)}],'warnings':[]}
    atomic_json(args.stage_dir/'validation_report.json',report)
    print({'valid':report['valid'],'errors':len(report['errors']),'warnings':len(report['warnings']),'staged':str(args.stage_dir)})
    raise SystemExit(0 if report['valid'] else 1)
if __name__=='__main__':main()
