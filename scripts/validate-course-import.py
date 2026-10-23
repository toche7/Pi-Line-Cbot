# Read-only ingestion validator adapted from research schema 1.1.0; no publishing or file writes.
"""Strict schema + evidence checks and atomic catalog publication (research only)."""
import json
import math
from pathlib import Path
import re
from datetime import date, datetime, timezone, timedelta
from urllib.parse import urlsplit, unquote
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
VERSION = '1.1.0'
SCHEMA_PATH = ROOT / f'course-schema-{VERSION}.json'
ALLOWED_HOSTS = {'cbtumu.net','www.cbtumu.net','miniaiagentweb-production.up.railway.app',
                 'minidswebsite-production.up.railway.app','www.minidatasci.com','minidatasci.com','drive.google.com'}
NULL_FIELDS = ['description_th','topics','learning_outcomes_th','audience_th','prerequisites_th',
               'format_th','duration_text','session_dates_text','instructors_text','instructors']
FORMATS=FormatChecker()
@FORMATS.checks('date-time',raises=(ValueError,TypeError))
def timestamp_format(value):
    if not isinstance(value,str):return True
    if not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})',value):return False
    return datetime.fromisoformat(value.replace('Z','+00:00')).tzinfo is not None
@FORMATS.checks('date',raises=(ValueError,TypeError))
def date_format(value):
    if not isinstance(value,str):return True
    return bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',value)) and bool(date.fromisoformat(value))

def now(): return datetime.now(timezone.utc).isoformat()
def canonical(url):
    p = urlsplit(url)
    return (p.hostname or '').lower() + unquote(p.path).rstrip('/')
def load(path):
    def reject(value): raise ValueError(f'Non-finite JSON number: {value}')
    def pairs(items):
        out={}
        for key,value in items:
            if key in out: raise ValueError(f'Duplicate JSON key: {key}')
            out[key]=value
        return out
    return json.loads(Path(path).read_text(), parse_constant=reject, object_pairs_hook=pairs)
def missing_fields(c):
    out=[key for key in NULL_FIELDS if c[key] is None]
    if c['price']['displayed_amount'] is None:out.append('price.displayed_amount')
    if c['certificate']['observed_text'] is None:out.append('certificate.course_specific_statement')
    if c['certificate']['course_specific_pass_criteria'] is None:out.append('certificate.course_specific_pass_criteria')
    return sorted(out)

def compare(data, previous):
    old={c['id']:c for c in (previous or {}).get('courses',[])}
    new={c['id']:c for c in data.get('courses',[])}
    return {'added':sorted(new.keys()-old.keys()),'removed':sorted(old.keys()-new.keys()),
            'price_changes':[{'id':id,'previous':old[id]['price'],'candidate':new[id]['price']}
                             for id in sorted(new.keys() & old.keys()) if old[id]['price']!=new[id]['price']]}

def validate(data, previous=None, *, at=None, allow_removals=False):
    report={'schema_version':VERSION,'validated_at':now(),'valid':False,'errors':[],'warnings':[],'changes':None}
    def err(code,path,message):report['errors'].append({'code':code,'path':path,'message':message})
    def warn(code,path,message):report['warnings'].append({'code':code,'path':path,'message':message})
    schema=load(SCHEMA_PATH)
    validator=Draft202012Validator(schema,format_checker=FORMATS)
    for e in sorted(validator.iter_errors(data),key=lambda e:str(list(e.absolute_path))):
        err('schema','/'+ '/'.join(map(str,e.absolute_path)),e.message)
    if report['errors']:return report
    reference=at or datetime.now(timezone.utc)
    if reference.tzinfo is None: raise ValueError('at must be timezone-aware')
    def check_url(url,path):
        p=urlsplit(url)
        if re.search(r'[\s<>\\]',url):err('source_url',path,'Whitespace or unsafe URL characters are not valid')
        try:port=p.port
        except ValueError:port=-1
        if p.scheme!='https' or p.hostname not in ALLOWED_HOSTS or p.username or p.password or port not in (None,443):
            err('source_url',path,'URL must be HTTPS on an explicitly allowed public source without credentials/custom port')
        if re.search(r'(?:^|[?&])(?:password|token|secret|api_key|_tutor_nonce)=',url,re.I):
            err('source_url',path,'Credential/session-like query values must not be retained')
    def walk(value,path=''):
        if isinstance(value,dict):
            for k,v in value.items():walk(v,path+'/'+k)
        elif isinstance(value,list):
            for j,v in enumerate(value):walk(v,path+'/'+str(j))
        elif isinstance(value,str) and value.startswith(('https://','http://')):check_url(value,path)
    walk(data)
    ids=set(); urls=set()
    previous_by_id={c['id']:c for c in (previous or {}).get('courses',[])}
    previous_by_url={canonical(c['canonical_url']):c for c in previous_by_id.values()}
    expected=set(data['collection']['expected_ids'])
    if data['collection']['fetch_errors']:err('fetch_failed','/collection/fetch_errors','Fetch failure blocks publication; previous data must remain')
    if data['collection']['coverage']!='complete':err('incomplete_coverage','/collection/coverage','Incomplete collection blocks publication')
    for i,c in enumerate(data['courses']):
        path=f'/courses/{i}'; key=canonical(c['canonical_url'])
        if c['id'] in ids:err('duplicate_id',path+'/id',c['id'])
        if key in urls:err('duplicate_url',path+'/canonical_url',key)
        ids.add(c['id']);urls.add(key)
        if urlsplit(c['canonical_url']).hostname!='cbtumu.net':err('canonical_host',path,'Catalog course canonical must be on cbtumu.net')
        if urlsplit(c['canonical_url']).query or urlsplit(c['canonical_url']).fragment:err('canonical_url',path,'Canonical course URL cannot contain query/fragment')
        required_prefix='/course-bundle/' if c['record_type']=='bundle' else '/coursenew/'
        if not unquote(urlsplit(c['canonical_url']).path).startswith(required_prefix):err('canonical_url',path,'Canonical path must match the catalog record type')
        if canonical(c['provenance']['resolved_url'])!=key or canonical(c['provenance']['requested_url'])!=key:
            err('course_source',path+'/provenance','Main source provenance must correspond to this course URL')
        old=previous_by_id.get(c['id'])
        if old and canonical(old['canonical_url'])!=key:err('unstable_id',path,'Existing ID changed canonical URL')
        oldurl=previous_by_url.get(key)
        if oldurl and oldurl['id']!=c['id']:err('unstable_id',path,'Existing canonical URL changed stable ID')
        if sorted(c['missing_fields'])!=missing_fields(c):err('missing_fields',path+'/missing_fields','Must exactly match the defined nullable knowledge fields')
        price=c['price']; amount=price['displayed_amount']
        if amount is not None:
            if not math.isfinite(amount):err('price',path+'/price','Non-finite amount')
            if amount==0:
                if price['label']!='Free' or not re.search(r'\bFree\b',c['evidence']['pricing_and_status_excerpt'] or '',re.I):
                    err('free_evidence',path+'/price','Zero requires explicit Free label and source excerpt; missing is null')
            elif not price['currency']:err('currency',path+'/price/currency','Positive monetary amount requires currency')
            if amount>0:
                excerpt=c['evidence']['pricing_and_status_excerpt'] or ''
                source_amounts=[float(v.replace(',','')) for v in re.findall(r'฿([\d,.]+)',excerpt)]
                if not source_amounts or amount!=source_amounts[0]:err('price_evidence',path+'/price','Amount must match explicit source price excerpt')
        elif price['label']=='Free':err('free_evidence',path+'/price','Free must have explicit zero and evidence')
        if price['reference_amount'] is not None and not price['currency']:err('currency',path+'/price','Reference monetary amount requires currency')
        if price['reference_amount'] is not None and not math.isfinite(price['reference_amount']):err('price',path+'/price','Non-finite reference amount')
        if c['enrollment']['is_live_availability_verified'] or price['is_current_offer_verified']:
            err('unverified_offer',path,'This research pipeline cannot verify live seats, checkout or offers')
        if c['dates']['raw']!=c['session_dates_text']:err('date_raw',path+'/dates','Keep raw dates separate and unchanged')
        if c['dates']['parsed'] and c['dates']['raw'] is None:err('date_evidence',path+'/dates','Parsed dates need raw evidence')
        if c['record_type']=='bundle':
            if not c['included_course_ids']:err('bundle_refs',path,'Bundle requires included courses')
        elif c['included_course_ids']:err('bundle_refs',path,'Course cannot include bundle members')
        if c['instructors'] is None:
            if c['instructor_evidence']:err('instructor_evidence',path,'Null instructors cannot have named evidence')
            warn('instructor_unknown',path,'No explicit named-teacher evidence; catalog By is not promoted')
        else:
            seen=set()
            if {(e['name'],e['source_url'],e['source_type']) for e in c['instructor_evidence']}!={(t['name'],t['source_url'],t['source_type']) for t in c['instructors']}:
                err('instructor_evidence',path,'Named evidence must correspond exactly to the listed instructors')
            for j,teacher in enumerate(c['instructors']):
                n=re.sub(r'\s+','',teacher['name'])
                if n in seen:err('duplicate_instructor',path+'/instructors',teacher['name'])
                seen.add(n)
                ev=[e for e in c['instructor_evidence'] if all(e[k]==teacher[k] for k in ('name','source_url','source_type'))]
                if not ev or not any(teacher['name'] in e['excerpt'] and re.search('ผู้สอน|วิทยากร|Instructor|Lecturer',e['excerpt'],re.I) for e in ev):
                    err('instructor_evidence',path+f'/instructors/{j}','Need exact name in explicit teacher-labelled excerpt, not catalog By')
                for e in ev:
                    if canonical(e['provenance']['resolved_url'])!=canonical(e['source_url']):err('instructor_source',path,'Evidence provenance must match teacher source')
                if teacher['source_type']=='course_detail' and canonical(teacher['source_url'])!=key:err('instructor_source',path,'course_detail source must be this course')
                if teacher['source_type']=='explicit_bundle_teacher' and '/course-bundle/' not in teacher['source_url']:err('instructor_source',path,'Bundle evidence must be an explicit bundle page')
                if teacher['source_type']=='explicit_bundle_teacher' and c['record_type']=='course' and not any(c['name'] in e['excerpt'] for e in ev):
                    err('instructor_source',path,'Bundle evidence must explicitly identify this included course')
        stamps=[c['provenance']]+[e['provenance'] for e in c['instructor_evidence']]
        for stamp in stamps:
            try:
                dt=datetime.fromisoformat(stamp['retrieved_at'].replace('Z','+00:00'))
                if dt.tzinfo is None:raise ValueError('missing timezone')
                if reference-dt>timedelta(days=30):warn('old_source',path,'Source snapshot older than 30 days; recheck time-sensitive answers')
                if dt>reference+timedelta(minutes=5):err('future_retrieval',path,'Retrieval time cannot be in the future')
            except ValueError as e:err('retrieval_time',path,str(e))
        if c['dates']['parsed']:
            for d in c['dates']['parsed']:
                if d['end_date'] and d['end_date']<d['start_date']:err('date_order',path+'/dates','end_date precedes start_date')
                if (d['end_date'] or d['start_date'])<reference.date().isoformat():warn('past_sessions',path,'Past raw session dates do not imply a new live intake')
        if c['flags']:warn('review_flags',path,', '.join(c['flags']))
    if ids!=expected:err('coverage_ids','/collection/expected_ids','Expected IDs must exactly match candidate records')
    for i,c in enumerate(data['courses']):
        for member in c['included_course_ids']:
            if member not in ids or member==c['id']:err('bundle_refs',f'/courses/{i}',member)
    report['changes']=compare(data,previous)
    if previous:
        if report['changes']['removed'] and not allow_removals:err('removed_records','/courses','Removals require explicit reviewed --allow-removals; fetch failure never permits removal')
        for c in data['courses']:
            old=previous_by_id.get(c['id'])
            if old and not set(old['flags'])<=set(c['flags']):err('conflict_removed','/courses/'+c['id'],'Existing review flags cannot be silently removed')
        if report['changes']['price_changes']:warn('price_changes','/courses','Prices changed; owner review required')
    warn('curated_summaries','/collection','Authored summaries/manifest are curated; this is not a general autonomous crawler')
    report['valid']=not report['errors'];return report

if __name__ == '__main__':
    import sys
    try:
        def reject(value): raise ValueError('Non-finite JSON number')
        def pairs(items):
            out = {}
            for key, value in items:
                if key in out: raise ValueError('Duplicate JSON key')
                out[key] = value
            return out
        envelope=json.loads(sys.stdin.read(), parse_constant=reject, object_pairs_hook=pairs)
        report=validate(envelope['candidate'], envelope.get('previous'))
    except Exception:
        report={'valid':False,'errors':[{'code':'input_or_dependency','message':'Invalid input or unavailable validator dependency'}],'warnings':[]}
    print(json.dumps(report, ensure_ascii=False))
    raise SystemExit(0 if report['valid'] else 1)
