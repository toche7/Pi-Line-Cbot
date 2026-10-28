"""Build reviewed, paraphrased research artifacts from public-page observations."""
from collect_public import ROOT
import json, re
from datetime import datetime, timezone

def write(name, data):
    (ROOT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')

# Authored summaries: these are paraphrases, not full course or lesson copies.
# summary | topics | audience | prerequisites | format | duration | dated sessions
META=[
['ใช้ AI ช่วยเตรียมและวิเคราะห์ข้อมูล สร้างโมเดล และจัดการฐานข้อมูล', 'Data quality;EDA;Machine Learning;Python/Pandas;SQL;ER diagram;Dashboard', 'ผู้ต้องการพัฒนาทักษะ Data Analyst และ Data Engineer', None, 'Online workshop ผ่าน Zoom', '4 สัปดาห์ / 4 วัน / 12 ชั่วโมง', '13 กันยายน–4 ตุลาคม 2569 วันอาทิตย์ 13:00–16:00'],
['ใช้ Prism AI ช่วยค้นคว้า วางโครงและเรียบเรียงงานวิชาการอย่างมีจริยธรรม', 'Prism AI;ค้นคว้าและสรุปข้อมูล;โครงร่างบทความ;จริยธรรม AI', 'นักวิจัย นักศึกษา อาจารย์ และผู้สนใจ AI เพื่องานวิจัย', 'ใช้คอมพิวเตอร์และอินเทอร์เน็ตได้ มีพื้นฐานการเขียนวิชาการ; แนะนำบัญชี Prism AI', 'มีวิดีโอบรรยายย้อนหลังและเอกสารประกอบ', '1 ชั่วโมง 30 นาที', None],
['ใช้ Claude และ Canva AI ช่วยงานเอกสาร การวิเคราะห์ และสื่อสำหรับการทำงาน', 'Claude;Prompting;Canva AI;Presentation;Poster;Infographic', 'คนทำงาน นักศึกษา ครู บุคลากรภาครัฐ และเจ้าของธุรกิจ', 'ใช้คอมพิวเตอร์และอินเทอร์เน็ตได้; แนะนำบัญชี Claude และ Canva', 'มีวิดีโอบรรยายย้อนหลังและเอกสารประกอบ', '2 ชั่วโมง', None],
['พัฒนา workflow และ AI agent prototype พร้อม capstone จากโจทย์งานจริง', 'LLM;Python;Prompt systems;Local LLM/RAG;n8n;Gemini CLI/OpenCode;MCP;PI;Guardrails;Capstone', 'ผู้ใช้ AI ที่ต้องการพัฒนาระบบช่วยงาน', 'ใช้คอมพิวเตอร์และ AI chat ได้ พร้อมเรียนตรรกะ CLI และทำโครงงานต่อเนื่อง; ไม่ต้องเป็นโปรแกรมเมอร์เต็มตัว', 'Hybrid workshop / Onsite สลับ Online ผ่าน Zoom', '14 สัปดาห์ สัปดาห์ละ 6 ชั่วโมง', 'วันเสาร์ 09:00–16:00; ไม่พบวันเริ่ม/สิ้นสุดในหน้า CBTU'],
['ปูพื้นและฝึกประยุกต์ Data Science, Machine Learning และ BI กับโจทย์ธุรกิจ', 'Introduction Data Science;Supervised Learning;Unsupervised Learning;Data Mining;Business Intelligence;Business Deployment', 'คนวัยทำงานที่ต้องการ reskill/upskill ด้านข้อมูล', None, 'Hybrid workshop', '17 วัน วันละ 6 ชั่วโมง รวม 102 ชั่วโมง', '09:00–16:00; ตารางวันเรียนเป็นลิงก์ Google Drive ยังไม่ได้อ่านไฟล์'],
['ฝึกใช้ Excel เพื่อจัดข้อมูล คำนวณ วิเคราะห์ และสร้างรายงาน', 'Excel basics;Formatting;Formulas;IF;VLOOKUP/HLOOKUP/XLOOKUP;Sort/Filter;PivotTable;Charts', None, None, 'วิดีโอออนไลน์ เรียนด้วยตนเอง', None, None],
['สร้างกราฟิก งานนำเสนอ วิดีโอและสื่อดิจิทัลด้วย Canva', 'Elements/Applications;Folders;Logo/Mockup;Poster;Presentation;Video/Animation;Certificate/Website;Canva AI', 'ผู้เริ่มต้น นักเรียน นักศึกษา ครู และบุคลากรที่สร้างสื่อ', 'ไม่ต้องมีพื้นฐานออกแบบ; แนะนำ Canva Pro และคอมพิวเตอร์พร้อมอินเทอร์เน็ต', 'วิดีโอ เรียนด้วยตนเองและทบทวนซ้ำได้', None, None],
['ใช้ Generative AI ช่วยสร้างคอนเทนต์และวิเคราะห์ข้อมูลด้านการตลาดผลิตภัณฑ์สุขภาพ', 'GenAI/LLM;Prompt Engineering;Gemini;Perplexity;NotebookLM;Marketing insights;ตรวจความถูกต้องและความเสี่ยง', 'ผู้เริ่มต้น นักศึกษา นักวิชาการ บุคคลทั่วไป และผู้ประกอบการตาม Audience widget', 'ไม่ต้องเขียนโปรแกรม; แนะนำบัญชี ChatGPT/Gemini หรือ AI tool และคอมพิวเตอร์พร้อมอินเทอร์เน็ต', 'วิดีโอออนไลน์', '5 ชั่วโมง', None],
['สร้าง automation และ chatbot/agent ด้วย n8n เชื่อมบริการและช่องทางสื่อสาร', 'Google Sheets;Email;Webhook/Database;LLM chain;Sentiment;Agent tools/memory;LINE chatbot', 'IT/Digital Transformation ผู้ประกอบการ นักพัฒนา นักวิเคราะห์ และผู้ต้องการลดงานซ้ำ', 'About ระบุไม่ต้องเขียนโปรแกรม; Requirements ระบุ LINE OA/Developers, workflow platform และพื้นฐาน HTTP/JSON', 'เรียนจากวิดีโอเนื้อหาหลัก พร้อมตัวอย่างปฏิบัติ', None, None],
['ฝึกสร้างและติดตั้ง n8n automation และ agent เชื่อม RAG และ LINE', 'n8n basics;LLM chain;Agent with tools;RAG;LINE/Facebook;Local/Cloud deployment', None, None, 'Onsite hands-on workshop', '2 วัน', 'รุ่นที่ 2: 21 และ 28 กุมภาพันธ์ 2569 เวลา 09:00–16:00'],
['ปูพื้น AI/LLM และเขียน prompt เพื่อใช้งาน ChatGPT/Gemini กับงานจริง', 'AI/LLM;Prompt Engineering;Gemini;เอกสาร;ภาพและตาราง;ข้อจำกัดและความปลอดภัย', 'ผู้เริ่มต้น นักศึกษา นักวิชาการ บุคคลทั่วไป และผู้ประกอบการ', 'ไม่ต้องเขียนโปรแกรม; แนะนำบัญชี ChatGPT/AI tool และคอมพิวเตอร์พร้อมอินเทอร์เน็ต', 'วิดีโอออนไลน์', '2 ชั่วโมง', None],
['ทำความเข้าใจ AI Agent, memory และ tools ผ่านตัวอย่างระบบอัตโนมัติ', 'Autonomous/Agentic AI;LLM;n8n;Claude Co-Work;OpenClaw;Memory/Tools;Auto Facebook Post', 'บุคลากร นักศึกษา อาจารย์ และผู้สนใจ AI ในงานจริง', 'ไม่ต้องเขียนโปรแกรม; แนะนำบัญชีเครื่องมือที่สาธิตและคอมพิวเตอร์พร้อมอินเทอร์เน็ต', 'วิดีโอออนไลน์', '2 ชั่วโมง 30 นาที', None],
['ฝึกแนวคิดและการใช้ AI agent ช่วยสร้างเนื้อหา เว็บแอป และวิเคราะห์ไฟล์ข้อมูล', 'Agent workflow;Agent CLI;Content;Web Application;CSV/Excel analysis', None, 'ไม่ต้องมีพื้นฐาน; เตรียมคอมพิวเตอร์และอินเทอร์เน็ต', 'วิดีโอออนไลน์', None, None],
['เรียนภาพรวม GenAI/LLM และการใช้กับข้อความ เอกสาร และ API เบื้องต้น', 'NLP;Token/Embedding;Transformer;Prompting;ChatGPT;PDF/RAG;API;ข้อจำกัดและความเป็นส่วนตัว', 'ผู้สอน นักวิจัย นักพัฒนาหรือ analyst มือใหม่ ทีมคอนเทนต์ ผู้บริหาร และบุคคลทั่วไป', 'ไม่ต้องเขียนโปรแกรม; แนะนำบัญชี ChatGPT/AI tool และคอมพิวเตอร์พร้อมอินเทอร์เน็ต', 'มีวิดีโอ แบบฝึกหัดและ Quiz', '2 ชั่วโมง', None],
['จัดเตรียมและวิเคราะห์ข้อมูล สร้าง dashboard และใช้ข้อมูลอย่างมีธรรมาภิบาล', 'Statistics;Correlation/Regression;Join/Union;Pivot;Data quality;Looker Studio;PDPA', 'นักศึกษา ผู้เริ่มต้น บุคลากรรัฐ/เอกชน และนักวิเคราะห์ระดับเริ่มต้นถึงกลาง', 'ใช้คอมพิวเตอร์และข้อมูลเบื้องต้นได้; ไม่ต้องมี programming ขั้นสูง', 'Workshop; หน้า About ไม่ระบุชัดว่า online หรือ onsite', '6 วัน วันละ 3 ชั่วโมง รวม 18 ชั่วโมง', '8, 15, 22 กุมภาพันธ์ และ 1, 8, 15 มีนาคม 2569 เวลา 13:00–16:00'],
['เตรียมข้อมูล สร้างและประเมินโมเดล Machine Learning แล้วสื่อสารผลด้วย dashboard', 'Python;NumPy/Pandas/Scikit-learn;Regression/Classification;Clustering/PCA;Cross-validation;Data governance;Looker Studio', None, None, 'Hybrid workshop', '6 วัน วันละ 6 ชั่วโมง รวม 36 ชั่วโมง', '7, 14, 21, 28 มีนาคม และ 4, 11 เมษายน 2569 เวลา 09:00–16:00'],
['ฝึกทำ Looker Studio dashboard ควบคู่คุณภาพข้อมูล PDPA และความปลอดภัย', 'Looker Studio;Interactive Dashboard;Blend Data;Calculated Fields/Parameter;Data quality;PDPA', None, None, 'Online ผ่าน Zoom', '4 วัน รวม 12 ชั่วโมง', '2, 9, 16, 23 พฤศจิกายน 2568 เวลา 13:00–16:00'],
[None,None,None,None,None,None,None],
['ใช้ Prompt Engineering และ ChatGPT ช่วยเอกสาร วิเคราะห์ภาพ ตาราง และสรุปข้อมูล', 'Prompt Engineering;Chatbot/ChatGPT;เอกสาร;ภาพ/ตาราง;ข้อจำกัดและความปลอดภัย', 'ผู้เริ่มต้น นักศึกษา นักวิชาการ บุคคลทั่วไป และผู้ประกอบการ', 'ไม่ต้องเขียนโปรแกรม; แนะนำบัญชี ChatGPT/AI tool และคอมพิวเตอร์พร้อมอินเทอร์เน็ต', 'มีวิดีโอ แบบฝึกหัดและ Quiz', '2 ชั่วโมง', None],
['ชุดรวม Canva, Excel, AI Agent with n8n และ Basic Prompt Engineering (2026)', 'Canva;Excel;n8n;Prompt Engineering', None,None,'ชุด 4 หลักสูตร', 'หน้า Bundle แสดง 02:00:00; ยังไม่ยืนยันว่าเป็นระยะเวลารวมจริง',None]
]

if __name__=='__main__':
    xs=json.loads((ROOT/'_detail_working.json').read_text())
    support=json.loads((ROOT/'_support_working.json').read_text())
    listings=json.loads((ROOT/'listing_observations.json').read_text())
    courses=[]
    for i,(x,m) in enumerate(zip(xs,META)):
        summary,topics,audience,prereq,fmt,duration,dates=m
        a=x['about'] or ''
        body=next((b['text'] for b in x['blocks'] if b['class']=='tutor-card-body'),'')
        footer=next((b['text'] for b in x['blocks'] if b['class'].startswith('tutor-card-footer')),'')
        prices=[float(z.replace(',','')) for z in re.findall(r'฿([\d,.]+)',body)]
        status=next((z for z in ['Enrollment is now closed','This course is full right now.','Enroll Now','Add to Cart'] if z in body),None)
        instructors=None
        match=re.search(r'ผู้สอน (.*?) สิ่งที่คุณจะได้เรียนรู้',a)
        if match:instructors=match.group(1)
        if i==5:instructors='กานต์นภัส ช้ำเกตุ (จาก listing และหน้า Bundle)'
        if i in [8,9,11,12,13,18]:instructors=instructors or 'taweesak samanchuen (ชื่อ By ใน catalog)'
        if i==16:instructors='Waranyu Wongseree (ชื่อ By ใน catalog)'
        if i==19:instructors='อภิญญา ชูชาติ; กานต์นภัส ช้ำเกตุ; ทวีศักดิ์ สมานชื่น (ผู้สอนหลักสูตรย่อย)'
        flags=[]
        if i in [0,9,14,15,16]: flags.append('dated_sessions_are_before_collection_date')
        if i in [9,14,15]:flags.append('past_session_dates_but_add_to_cart_displayed')
        if i==2:flags.append('catalog_By_author_differs_from_named_teachers')
        if i==3:flags.append('linked_program_hub_has_unverified_cohort2_waitlist_conflicts')
        if i==4:flags.extend(['completed_cohort_news','newer_program_hub_is_separate_cohort11_not_this_cohort','linked_schedule_not_read'])
        if i==8:flags.append('Requirements_widget_uses_NSN_while_course_describes_n8n')
        if i==17:flags.append('password_protected_detail_not_accessed')
        if i==19:flags.append('bundle_duration_requires_verification')
        if status is None and i==17:status='Enroll Course (listing only); detail password protected'
        cert='Certificate of completion' if 'Certificate of completion' in footer else None
        if i==19:cert='คำอธิบาย Bundle ระบุมี certificate'
        c={'id':f'cbtu-{i+1:02d}','record_type':'bundle' if i==19 else 'course','name':x['name'].removeprefix('Protected: '),'canonical_url':x['canonical_url'],'detail_access':'password_protected' if i==17 else 'public','description_th':summary,'topics':topics.split(';') if topics else None,'learning_outcomes_th':[summary] if summary else None,'audience_th':audience,'prerequisites_th':prereq,'format_th':fmt,'duration_text':duration,'session_dates_text':dates,'instructors_text':instructors,'price':{'displayed_amount':prices[0] if prices else (0 if 'Free' in body else None),'currency':'THB' if prices else None,'reference_amount':prices[1] if len(prices)>1 else None,'label':'Free' if 'Free' in body else None,'is_current_offer_verified':False},'enrollment':{'observed_text':status,'is_live_availability_verified':False},'certificate':{'observed_text':cert,'course_specific_pass_criteria':None,'general_faq_rule':'เรียนจบและผ่านการประเมินตามเกณฑ์; ไม่พบเกณฑ์คะแนนของรายวิชา','faq_url':'https://cbtumu.net/faq/'},'application_links':[{'url':x['canonical_url'],'type':'course_detail_entry','transaction_not_tested':True}],'additional_public_links':x['public_links'],'flags':flags,'provenance':x['provenance'],'field_sources':{'name':'h1 + canonical link','description_th,topics,learning_outcomes_th':'About Course; What Will You Learn (paraphrased)','audience_th,prerequisites_th':'About Course / Audience / Requirements; null if not found','format_th,duration_text,session_dates_text':'About Course / Material Includes / sidebar Duration','instructors_text':'About Course ผู้สอน; catalog By or Bundle where explicitly labelled','price,enrollment':'sidebar .tutor-card-body','certificate':'sidebar .tutor-card-footer; About Bundle; general FAQ only'},'evidence':{'pricing_and_status_excerpt':body[:130],'duration_and_certificate_excerpt':re.sub(r'\d+ Total Enrolled','[aggregate omitted]',footer),'named_teachers_excerpt':match.group(1) if match else None}}
        if i==16:c['certificate']['course_specific_pass_criteria']='คำอธิบายระบุเรียนจบและสอบผ่านตามเกณฑ์จึงขอใบประกาศและหนังสือรับรองคุณวุฒิวิชาชีพได้; ไม่ระบุคะแนน'
        if i==19:c['included_course_ids']=['cbtu-07','cbtu-06','cbtu-09','cbtu-11']
        c['source_refs']=[{'url':x['canonical_url'],'role':'public_detail' if i!=17 else 'password_protected_detail'},{'url':'https://cbtumu.net/','role':'catalog_UI_pagination_observed_2026-10-23'},{'url':'https://cbtumu.net/faq/','role':'general_certificate_rule_not_course_specific'}]
        if i==5:c['source_refs'].append({'url':'https://cbtumu.net/course-bundle/mostcoursebundle/','role':'named_teacher_for_Excel'})
        if i==2:c['catalog_author_text']='taweesak samanchuen; catalog By label, not the two named instructors'
        if i in [11,12,13]:c['enrollment']['catalog_observed_text']='Fully Booked'
        if i==17:c['enrollment']['catalog_observed_text']='Enroll Course'
        c['missing_fields']=[k for k in ['description_th','topics','audience_th','prerequisites_th','format_th','duration_text','session_dates_text','instructors_text'] if c[k] is None]
        if c['price']['displayed_amount'] is None:c['missing_fields'].append('price.displayed_amount')
        if cert is None:c['missing_fields'].append('certificate.course_specific_statement')
        c['missing_fields'].append('certificate.course_specific_pass_criteria') if c['certificate']['course_specific_pass_criteria'] is None else None
        courses.append(c)
    write('courses.json',{'schema_version':'1.0','collection_date':'2026-10-23','timezone':'Asia/Bangkok','status':'research_for_owner_review_not_runtime_ingestion','scope':'19 courses + 1 bundle observed in public Home pagination; not every item in payment selector or site archive','null_means':'not found or unavailable; never assume false/free/unlimited','availability_rule':'Observed page text only; dates, prices and capacity must be confirmed before advising a purchase.','courses':courses})

    # Preserve navigation observations without claiming ordinary ?current_page GET works.
    ids=[[20,1,2,3,4,5],[6,7,8,9,10,11],[12,13,14,15,16,17],[18,19]]
    browser_pages=[{'url':f'https://cbtumu.net/?current_page={i+1}' if i else 'https://cbtumu.net/','observed_on':'2026-10-23','method':'IAB UI click from freshly loaded Home; native AJAX pagination','course_ids':[f'cbtu-{n:02d}' for n in ns]} for i,ns in enumerate(ids)]
    write('catalog_observations.json',{'browser_home_pages':browser_pages,'direct_http_observations':listings,'courses_menu_pagination':{'pages_advertised':3,'pages_attempted':[1,2,3],'result':'Direct GET repeats first page. UI clicks 2 and 3 returned page indicator Page 1 of 3 and repeated entries; use successful Home UI pagination for coverage.'},'detail_counts':{'catalog_records':20,'public_details':19,'password_protected_details':1},'completeness_limit':'Complete union of 4 successfully rendered Home pages on collection date; no claim about all historical/private courses.'})

    sp={x['provenance']['requested_url']:x['provenance'] for x in support if 'provenance' in x}
    faq='https://cbtumu.net/faq/'
    def fact(id,question,answer,section,review=False):
        return {'id':id,'question_th':question,'answer_th':answer,'source_url':faq,'source_section':section,'provenance':sp[faq],'requires_owner_review':review}
    facts=[
        fact('faq-enroll','สมัครเรียนอย่างไร','เลือกหลักสูตรจาก Home แล้วใช้ Enroll/ลงทะเบียน; หากยังไม่มีสมาชิกให้สมัครตามขั้นตอนหน้าเว็บ','วิธีสมัครเรียนคอร์สออนไลน์'),
        fact('faq-access','ชำระแล้วเข้าเรียนเมื่อไร','หน้า FAQ มีทั้งข้อความเข้าเรียนทันทีและรอตรวจ 1–2 วัน จึงต้องให้เจ้าหน้าที่ยืนยันสิทธิ์เข้าเรียน','วิธีสมัครเรียนคอร์สออนไลน์',True),
        fact('faq-coupon','ใช้คูปองได้ทุกคอร์สหรือไม่','ใช้ได้เฉพาะคอร์สที่ร่วมรายการ; ตรวจราคาที่ระบบแสดงหลังกรอกรหัสในขั้นตอนชำระเงิน','วิธีการใช้งานคูปอง'),
        fact('faq-receipt','ขอเอกสารรับเงินอย่างไร','FAQ ระบุให้กรอกรายละเอียดใน Payment เพื่อให้เจ้าหน้าที่ตรวจและออกเอกสาร','วิธีชำระเงินออนไลน์',True),
        fact('faq-receipt-time','ใบเสร็จใช้เวลานานเท่าไร','FAQ ระบุกระบวนการผ่านคณะประมาณ 1–2 สัปดาห์ แล้วจัดส่งภายใน 3–5 วันทำการ; เป็นเวลาที่หน้าเว็บระบุ','วิธีชำระเงินออนไลน์'),
        fact('faq-enter','เข้าเรียนจากเมนูใด','เข้าสู่ระบบด้วยบัญชีที่ลงทะเบียน ไป Dashboard > Enrolled Courses เลือกวิชา แล้ว Start Learning','วิธีเรียนคอร์สออนไลน์'),
        fact('faq-duration','เรียนได้ตลอดชีพทุกคอร์สหรือไม่','FAQ บอกว่าส่วนมากไม่จำกัดอายุ แต่บางคอร์สจำกัด ต้องตรวจเงื่อนไขของรายวิชา','คอร์สออนไลน์มีอายุการใช้งานหรือไม่'),
        fact('faq-cert','ดาวน์โหลดใบประกาศได้เมื่อไร','หลังเรียนจบและผ่านการประเมินตามเกณฑ์ ไป Dashboard > Enrolled Courses > Completed Courses','Certificate'),
        fact('faq-cert-name','เปลี่ยนชื่อในใบประกาศอย่างไร','แก้ First Name/Last Name ที่ Settings > Profile บันทึก Update Profile และเลือก Display name publicly as ตามขั้นตอน FAQ','Certificate'),
        fact('faq-history','ดูสถานะคำสั่งซื้อที่ไหน','Dashboard > Order History > Invoice ตามหน้า FAQ','รายละเอียดหลังชำระเงิน')]
    contact='https://cbtumu.net/contactus/'
    write('supporting_knowledge.json',{'schema_version':'1.0','status':'research_for_owner_review','faq':facts,'contact':{'phones':['099 629 8236','086 945 3895'],'body_email':'cbtu.mu@gmail.com','footer_email':'cbtumu.net@gmail.com','email_requires_owner_confirmation':True,'address_th':'กลุ่มสาขาวิชาเทคโนโลยีการจัดการระบบสารสนเทศ คณะวิศวกรรมศาสตร์ มหาวิทยาลัยมหิดล 999 ถนนพุทธมณฑลสาย 4 ตำบลศาลายา อำเภอพุทธมณฑล จังหวัดนครปฐม 73170','provenance':sp[contact]},'about':{'summary_th':'CBTU เป็นโครงการฝึกอบรมภายใต้คณะวิศวกรรมศาสตร์ มหาวิทยาลัยมหิดล มี Onsite, Online Live, On-demand และ In-house; หน้า About ระบุทะเบียนหน่วยฝึก TP-0021-A และ 6 หลักสูตรที่รับรอง','tpqi_courses_named_on_about':['Mini-Data Science','Data Science Essentials','Data Analyst and Data Engineer Intermediate Level','Data Analyst – Upper Intermediate Level','Data Engineer – Upper Intermediate Level','Project Management'],'rule':'รายการใน About ไม่ได้ยืนยันว่าเปิดรับปัจจุบัน และไม่หมายความว่าทุกคอร์สได้คุณวุฒิ TPQI อัตโนมัติ','provenance':sp['https://cbtumu.net/about-cbtu/']},'payment':{'url':'https://cbtumu.net/payment/','owner_review_required':True,'customer_answer_rule':'ไม่ให้เลขบัญชีหรือรับรองการโอนเงินจากชุดข้อมูลนี้; ให้เจ้าหน้าที่ยืนยันเพราะแหล่งทางการขัดกัน','provenance':sp['https://cbtumu.net/payment/']},'excluded_news':[{'title':'Mini Data Science รุ่นที่ 10 เสร็จสิ้นการอบรม','type':'completion_news_not_open_catalog_offer','summary_th':'ข่าวยืนยันการอบรมรุ่น 10 เสร็จสิ้น รวม 17 วัน 102 ชั่วโมง ที่ KX','provenance':sp['https://cbtumu.net/mini-data-science-10-completion/']},{'title':'ปั้น AI ผู้ช่วยส่วนตัว 24 ชั่วโมง ฉบับมือใหม่ ด้วย HERMES AGENT','type':'completed_training_news_not_open_catalog_offer','summary_th':'ข่าวรายงานการอบรมเสร็จสิ้นที่คณะวิศวกรรมศาสตร์ มหิดล อาคาร 1 ห้อง R301; ไม่มีหลักฐานจาก catalog ว่ารับสมัครรอบใหม่','provenance':sp['https://cbtumu.net/hermes-agent-training-cbtu-mu/']}]})

    issues=[
        {'id':'payment-account-conflict','severity':'block_payment_guidance','observations':[{'url':faq,'section':'วิธีชำระเงินออนไลน์','bank':'ธนาคารไทยพาณิชย์','account_name':'เงินรายได้คณะวิศวกรรมศาสตร์ มหาวิทยาลัยมหิดล','account_number_as_published':'333-279192-7'},{'url':'https://cbtumu.net/payment/','section':'ขั้นตอนการชำระค่าลงทะเบียน','bank':'ธนาคารไทยพาณิชย์','account_name':'มหาวิทยาลัยมหิดล','account_number_as_published':'016-210322-3'}],'resolution':'เจ้าของต้องตรวจว่าบัญชีใดใช้กับรายการใด; ห้ามเลือกบัญชีจากการเดาหรือใช้ทั้งคู่เป็นคำแนะนำ'},
        {'id':'access-time-conflict','sources':[faq,'https://cbtumu.net/payment/'],'observations':['FAQ ขั้นตอนสมัคร: เริ่มเรียนทันทีหลังชำระ','FAQ คำถามถัดมาและ Payment: ตรวจ 1–2 วัน'],'resolution':'ไม่รับรองเวลาที่เข้าเรียนได้ ให้เจ้าหน้าที่ยืนยัน'},
        {'id':'contact-email-conflict','sources':[faq,contact],'observations':['เนื้อหา Contact และ FAQ ใบเสนอราคา: cbtu.mu@gmail.com','Footer: cbtumu.net@gmail.com'],'resolution':'ให้เจ้าของกำหนดอีเมลหลักก่อน ingest'},
        {'id':'past-dates-with-cart','course_ids':['cbtu-10','cbtu-15','cbtu-16'],'resolution':'คงปุ่มและวันเรียนเป็น observations แยกกัน; ไม่สรุปว่าเปิดอบรมสดรอบใหม่'},
        {'id':'certificate-scope','sources':['https://cbtumu.net/',faq,'https://cbtumu.net/about-cbtu/'],'resolution':'Home อ้างใบประกาศทุกหลักสูตร แต่ FAQ มีเงื่อนไขผ่านเกณฑ์; ห้ามเหมารวม TPQI หรือคะแนนผ่านของรายวิชา'},
        {'id':'protected-detail','course_ids':['cbtu-18'],'resolution':'ไม่กรอกรหัสหรือ bypass; รอเจ้าของให้ข้อมูลที่เผยแพร่สาธารณะ'},
        {'id':'author-versus-teacher','course_ids':['cbtu-03'],'observations':['listing By taweesak samanchuen','About Course ผู้สอน: ดำรงพล ชนะวรรณ และ อภิญญา ชูชาติ'],'resolution':'เก็บชื่อผู้สอนจากคำอธิบาย ไม่แทนที่ด้วยผู้โพสต์'},
        {'id':'n8n-requirement-label','course_ids':['cbtu-09'],'resolution':'Requirements ใช้คำ NSN ในบางบรรทัด ขณะที่ About ใช้ n8n; ไม่แก้แหล่งอ้างอิงเอง'},
        {'id':'pagination-and-cache','resolution':'HTML GET ของ ?current_page คืนซ้ำและ web index ต่างจาก live; Home UI click จากหน้าแรกให้ครบ 4 หน้า ส่วน Courses UI หน้า 2/3 กลับตัวชี้หน้า 1'},
    ]
    hubs=[
        {'related_catalog_id':'cbtu-04','record_type':'supplemental_cohort_not_merged','cohort':'Mini AI Agent รุ่น 2','url':'https://miniaiagentweb-production.up.railway.app/apply','observations':{'mode':'waitlist','headline_price':'ประกาศเร็ว ๆ นี้','cohort_price_text':'24000','headline_seats':'ยังไม่ประกาศจำนวนรับ','cohort_seats_text':'30','headline_open_date':'ยังไม่ประกาศวันเปิดรับสมัคร','cohort_deadline':'1 เมษายน 2570','cohort_start':'1 สิงหาคม 2570','outcome_text':'test'},'flags':['unannounced_vs_numeric_price_seats_dates','placeholder_test_text','start_date_is_Sunday_but_weekly_schedule_says_Saturday'],'customer_use':'ต้องตรวจยืนยันก่อนตอบวัน ราคา และที่นั่ง; การลงชื่อรอไม่ใช่ยืนยันรับสมัคร','provenance':sp['https://miniaiagentweb-production.up.railway.app/apply']},
        {'related_catalog_id':'cbtu-05','record_type':'supplemental_cohort_not_merged','cohort':'Mini Data Science รุ่น 11','url':'https://minidswebsite-production.up.railway.app/apply','observations':{'mode':'open','price_text':'29,500 บาท','promotion_text':'Early Bird ลด 10% ตามช่วงที่ประกาศ','seats_text':'30 คน','deadline_a':'15 ธันวาคม 2569 หรือเมื่อเต็ม','deadline_b':'15 สิงหาคม (ไม่ระบุปีในข้อความนี้)','start_text':'1 กันยายน 2569','schedule':'วันเสาร์ 6 ชั่วโมง; 17 สัปดาห์ / 5 เดือน'},'flags':['conflicting_deadlines','start_date_is_Tuesday_but_schedule_says_Saturday','separate_cohort_from_completed_catalog_cohort10','homepage_and_apply_status_may_differ'],'customer_use':'ไม่เปลี่ยนราคา/รุ่น 10 ใน catalog ให้เป็นรุ่น 11; ข้อมูลนี้ยังต้องให้เจ้าของยืนยัน','provenance':sp['https://minidswebsite-production.up.railway.app/apply']}
    ]
    write('review_required.json',{'status':'owner_review_only_do_not_ingest_as_customer_facts','issues':issues,'linked_program_hub_observations':hubs,'source_provenance':list(sp.values()),'other_linked_site_note':{'url':'https://www.minidatasci.com/','observed_via':'web open 2026-10-23','summary_th':'เว็บเก่าระบุ 28,000 บาท 4 เดือน/17 สัปดาห์ คุณสมบัติปริญญาตรีหรือเทียบเท่าและประสบการณ์ 1 ปี; ยังยืนยันไม่ได้ว่าเงื่อนไขใช้กับรุ่น 10/11 ใด','not_merged_into_cohort_requirements':True}})
    # Drop transient full marketing text; retained artifacts use authored summaries and short evidence.
    for filename in ['_detail_working.json','_support_working.json']:
        (ROOT/filename).unlink()
    print('Built 20 catalog records, supporting FAQ and owner-review issues. Removed temporary marketing text.')
