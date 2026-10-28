import copy
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import catalog_validation as v
from build_artifacts import explicit_teachers, make_candidate

class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.data=v.load(Path(__file__).parent/'fixtures/catalog-valid-1.1.0.json')
        self.c=self.data['courses'][0]
    def codes(self,data=None,previous=None,**kw):
        return {e['code'] for e in v.validate(data or self.data,previous,**kw)['errors']}
    def test_valid(self):self.assertEqual(self.codes(),set())
    def test_unsupported_version(self):
        self.data['schema_version']='99';self.assertIn('schema',self.codes())
    def test_required(self):
        for field in ['id','name','canonical_url','provenance']:
            with self.subTest(field=field):
                data=copy.deepcopy(self.data);del data['courses'][0][field]
                self.assertIn('schema',self.codes(data))
    def test_unknown_fields_at_all_levels(self):
        for target in [self.data,self.c,self.c['price'],self.c['provenance'],self.c['instructors'][0]]:
            target['unknown']=1;self.assertIn('schema',self.codes());del target['unknown']
    def test_wrong_types(self):
        for field,value in [('topics','not-a-list'),('name',[]),('flags','flag')]:
            data=copy.deepcopy(self.data);data['courses'][0][field]=value
            self.assertIn('schema',self.codes(data))
    def test_blank_name_is_not_present(self):
        self.c['name']='   ';self.assertIn('schema',self.codes())
    def test_boolean_is_not_numeric_price(self):
        self.c['price']['displayed_amount']=True;self.assertIn('schema',self.codes())
    def test_negative_price(self):
        self.c['price']['displayed_amount']=-1;self.assertIn('schema',self.codes())
    def test_currency_required_for_money(self):
        self.c['price']['currency']=None;self.assertIn('currency',self.codes())
    def test_zero_without_free_evidence(self):
        self.c['price']['displayed_amount']=0;self.assertIn('free_evidence',self.codes())
        self.c['price']['label']='Free';self.assertIn('free_evidence',self.codes())
    def test_explicit_free(self):
        self.c['price'].update(displayed_amount=0,currency=None,label='Free')
        self.c['evidence']['pricing_and_status_excerpt']='Free Enroll Now'
        self.assertEqual(self.codes(),set())
    def test_missing_price_is_null_not_free(self):
        self.c['price'].update(displayed_amount=None,currency=None)
        self.assertIn('missing_fields',self.codes())
        self.c['missing_fields']=v.missing_fields(self.c);self.assertEqual(self.codes(),set())
    def test_price_must_match_evidence(self):
        self.c['price']['displayed_amount']=1234;self.assertIn('price_evidence',self.codes())
    def test_duplicate_id(self):
        self.data['courses'].append(copy.deepcopy(self.c));self.assertIn('duplicate_id',self.codes())
    def test_duplicate_url_after_percent_decode(self):
        other=copy.deepcopy(self.c);other['id']='cbtu-99'
        other['canonical_url']=other['canonical_url'].replace('dataanalysis','%64ataanalysis')
        self.data['courses'].append(other);self.data['collection']['expected_ids'].append('cbtu-99')
        self.assertIn('duplicate_url',self.codes())
    def test_stable_id_and_url(self):
        old=copy.deepcopy(self.data);self.c['canonical_url']='https://cbtumu.net/coursenew/changed/'
        self.assertIn('unstable_id',self.codes(previous=old))
    def test_disallowed_source_and_credentials(self):
        for url in ['https://127.0.0.1/a','http://cbtumu.net/a','https://cbtumu.net.evil.example/a','https://user:password@cbtumu.net/a','https://cbtumu.net/a?token=secret']:
            self.c['source_refs'][0]['url']=url;self.assertTrue(self.codes() & {'schema','source_url'})
    def test_invalid_timestamp(self):
        self.c['provenance']['retrieved_at']='yesterday';self.assertIn('schema',self.codes())
    def test_old_data_warns_not_errors(self):
        at=datetime.fromisoformat(self.c['provenance']['retrieved_at'])+timedelta(days=31)
        report=v.validate(self.data,at=at)
        self.assertTrue(report['valid']);self.assertIn('old_source',{w['code'] for w in report['warnings']})
    def test_catalog_author_cannot_be_teacher(self):
        self.c['instructors'][0]['source_type']='catalog_by'
        self.assertIn('schema',self.codes())
    def test_by_excerpt_is_not_explicit_teacher(self):
        self.c['instructor_evidence'][0]['excerpt']='By '+self.c['instructors'][0]['name']
        self.assertIn('instructor_evidence',self.codes())
    def test_missing_instructor_evidence(self):
        self.c['instructor_evidence']=[];self.assertIn('instructor_evidence',self.codes())
    def test_null_instructor_missing_fields(self):
        self.c['instructors']=None;self.c['instructor_evidence']=[]
        self.assertIn('missing_fields',self.codes())
        self.c['missing_fields']=v.missing_fields(self.c);self.assertEqual(self.codes(),set())
    def test_teacher_source_must_match_course(self):
        for ev in self.c['instructor_evidence']:ev['source_url']='https://cbtumu.net/coursenew/other/'
        for teacher in self.c['instructors']:teacher['source_url']='https://cbtumu.net/coursenew/other/'
        self.assertIn('instructor_source',self.codes())
    def test_main_provenance_must_match_course(self):
        self.c['provenance']['resolved_url']='https://cbtumu.net/coursenew/other/'
        self.assertIn('course_source',self.codes())
    def test_cannot_silently_resolve_conflicts(self):
        old=copy.deepcopy(self.data);self.c['flags']=[]
        self.assertIn('conflict_removed',self.codes(previous=old))
    def test_raw_and_parsed_dates_are_separate(self):
        self.c['dates']['raw']='different';self.assertIn('date_raw',self.codes())
    def test_add_to_cart_cannot_verify_open_seats(self):
        self.c['enrollment'].update(observed_text='Add to Cart',is_live_availability_verified=True)
        self.assertIn('schema',self.codes())
    def test_changes_report_and_removal_gate(self):
        old=copy.deepcopy(self.data)
        self.c['price']['displayed_amount']=1900;self.c['evidence']['pricing_and_status_excerpt']='฿1,900.00 Add to Cart'
        report=v.validate(self.data,old)
        self.assertTrue(report['valid']);self.assertEqual(len(report['changes']['price_changes']),1)
        removed=copy.deepcopy(self.c);removed['id']='cbtu-99';removed['canonical_url']='https://cbtumu.net/coursenew/old/'
        old['courses'].append(removed)
        self.assertIn('removed_records',self.codes(previous=old))
    def test_json_rejects_duplicate_keys_and_nan(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'candidate.json'
            for text in ['{"x":1,"x":2}','{"x":NaN}']:
                path.write_text(text)
                with self.assertRaises(ValueError):v.load(path)
    def test_failure_preserves_last_good_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);destination=root/'courses.json';v.atomic_json(destination,self.data)
            old=destination.read_bytes();self.data['collection']['coverage']='incomplete'
            self.data['collection']['fetch_errors']=[{'id':self.c['id'],'url':self.c['canonical_url'],'error':'network timeout'}]
            candidate=root/'staging'/'courses.json';v.atomic_json(candidate,self.data)
            report=v.publish(candidate,root)
            self.assertFalse(report['valid']);self.assertEqual(destination.read_bytes(),old)
            self.assertFalse((root/'versions').exists())
    def test_success_archives_previous_exact_bytes(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);v.atomic_json(root/'courses.json',self.data)
            old=(root/'courses.json').read_bytes();digest=hashlib.sha256(old).hexdigest()
            self.data['collection']['built_at']=v.now()
            candidate=root/'staging'/'courses.json';v.atomic_json(candidate,self.data)
            self.assertTrue(v.publish(candidate,root)['valid'])
            self.assertEqual((root/'versions'/digest/'courses.json').read_bytes(),old)
            self.assertEqual(v.load(root/'courses.json'),self.data)
    def test_io_failure_before_commit_preserves_previous(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);destination=root/'courses.json';v.atomic_json(destination,self.data)
            old=destination.read_bytes();candidate=root/'staging'/'courses.json';v.atomic_json(candidate,self.data)
            original=v.atomic_bytes
            def fail(path,data):
                if Path(path)==destination:raise OSError('simulated commit I/O failure')
                original(path,data)
            with patch.object(v,'atomic_bytes',side_effect=fail):
                with self.assertRaises(OSError):v.publish(candidate,root)
            self.assertEqual(destination.read_bytes(),old)
    def test_parser_preserves_titles_and_excludes_affiliation(self):
        detail={'marketing_events':[{'tag':'h3','text':'ผู้สอน'},
                {'tag':'p','text':'คุณชื่อ นามสกุล คณะวิศวกรรมศาสตร์','lines':['คุณชื่อ นามสกุล','คณะวิศวกรรมศาสตร์']},
                {'tag':'h3','text':'สิ่งที่จะเรียน'},{'tag':'p','text':'By someone else'}]}
        self.assertEqual(explicit_teachers(detail),['คุณชื่อ นามสกุล'])
    def test_builder_fetch_failure_never_drops_record(self):
        manifest={'records':[{'id':self.c['id'],'canonical_url':self.c['canonical_url'],'record_type':'course'}]}
        candidate,_=make_candidate(self.data,{'collector_schema_version':'1.0.0','records':[]},manifest)
        self.assertEqual(len(candidate['courses']),1)
        self.assertFalse(v.validate(candidate,self.data)['valid'])

if __name__=='__main__':unittest.main()
