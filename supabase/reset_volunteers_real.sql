-- =============================================================================
-- Reset volunteers (teachers + mentors) with real names.
-- Run in Supabase SQL Editor.
-- =============================================================================

-- Make sure required columns exist (idempotent).
alter table volunteers
  add column if not exists assigned_classes text[] default '{}';
alter table volunteers
  add column if not exists session_classes jsonb default '{}'::jsonb;

-- Wipe existing volunteer rows (demo accounts are removed).
delete from volunteers;

-- Helper: empty session map for non-teachers.
-- (Inline literal below; jsonb '{}' means "no per-session class assigned".)

-- Insert real class teachers and mentors.
insert into volunteers
  (id, name, pin, mobile, roles, assigned_activity, assigned_class, assigned_classes,
   session_classes, has_deduction_rights, responsibilities)
values
  -- Class teachers (one per class for the 14-class plan).
  -- Each teacher's three sessions default to their primary class. Admin can edit
  -- per-session assignments later from the Volunteers screen.
  ('t01','Br Prateek Bhaiya',         '4101','',array['Class Teacher'],'Class BA1','BA1',array['BA1'],jsonb_build_object('1','BA1','2','BA1','3','BA1'),false,array['Class BA1 teaching']),
  ('t02','Br Himanshu Bhaiya',        '4102','',array['Class Teacher'],'Class BA2','BA2',array['BA2'],jsonb_build_object('1','BA2','2','BA2','3','BA2'),false,array['Class BA2 teaching']),
  ('t03','Abhinay Ji',                '4103','',array['Class Teacher'],'Class BA3','BA3',array['BA3'],jsonb_build_object('1','BA3','2','BA3','3','BA3'),false,array['Class BA3 teaching']),
  ('t04','Aman Jain Ji',              '4104','',array['Class Teacher'],'Class BA4','BA4',array['BA4'],jsonb_build_object('1','BA4','2','BA4','3','BA4'),false,array['Class BA4 teaching']),
  ('t05','Aniket Jain Ji',            '4105','',array['Class Teacher'],'Class BA5','BA5',array['BA5'],jsonb_build_object('1','BA5','2','BA5','3','BA5'),false,array['Class BA5 teaching']),
  ('t06','Pragya Jain Ji',            '4106','',array['Class Teacher'],'Class GA1','GA1',array['GA1'],jsonb_build_object('1','GA1','2','GA1','3','GA1'),false,array['Class GA1 teaching']),
  ('t07','Aditi',                     '4107','',array['Class Teacher'],'Class GA2','GA2',array['GA2'],jsonb_build_object('1','GA2','2','GA2','3','GA2'),false,array['Class GA2 teaching']),
  ('t08','Lipi Jain Ji',              '4108','',array['Class Teacher'],'Class GA3','GA3',array['GA3'],jsonb_build_object('1','GA3','2','GA3','3','GA3'),false,array['Class GA3 teaching']),
  ('t09','Gautam Gandhar Pradhan Ji', '4109','',array['Class Teacher'],'Class BB1','BB1',array['BB1'],jsonb_build_object('1','BB1','2','BB1','3','BB1'),false,array['Class BB1 teaching']),
  ('t10','Br Rajesh Bhaiya Ji',       '4110','',array['Class Teacher'],'Class BB2','BB2',array['BB2'],jsonb_build_object('1','BB2','2','BB2','3','BB2'),false,array['Class BB2 teaching']),
  ('t11','Khushbu Ji',                '4111','',array['Class Teacher'],'Class GB1','GB1',array['GB1'],jsonb_build_object('1','GB1','2','GB1','3','GB1'),false,array['Class GB1 teaching']),
  ('t12','Br Shrenik Bhaiya Ji',      '4112','',array['Class Teacher'],'Class BC1','BC1',array['BC1'],jsonb_build_object('1','BC1','2','BC1','3','BC1'),false,array['Class BC1 teaching']),
  ('t13','Shrimati Pooja Ji',         '4113','',array['Class Teacher'],'Class GC1','GC1',array['GC1'],jsonb_build_object('1','GC1','2','GC1','3','GC1'),false,array['Class GC1 teaching']),
  ('t14','Shrimati Alka Ji',          '4114','',array['Class Teacher'],'Class MD1','MD1',array['MD1'],jsonb_build_object('1','MD1','2','MD1','3','MD1'),false,array['Class MD1 teaching']),

  -- Female mentors (no per-session class)
  ('m01','Tanu',          '6113','9755796113',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Yoga supervision (girls)','Zone room supervision','Breakfast & dinner queue']),
  ('m02','Jiya',          '2675','9343262675',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Morning Puja supervision (girls)','Zone room supervision','Evening diary round']),
  ('m03','Srishti',       '6633','9238796633',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Class support','Zone room supervision','Coin distribution']),
  ('m04','Ankita',        '5457','8097405457',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Class support','Zone room supervision','Coin distribution']),
  ('m05','Anuprekstha',   '2125','7974962125',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Day shift class support','Lunch queue supervision']),
  ('m06','Shreni',        '3230','9244353230',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Bhakti supervision','Zone room supervision','Lunch supervision']),
  ('m07','Nishtha',       '9530','9691729530',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Early Riser monitor (girls)','Zone room supervision']),
  ('m08','Vishuddhi',     '1655','6263801655',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Samuhik Kaksha support (girls)','Zone room supervision']),
  ('m09','Akanksha',      '0134','9203120134',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Bhakti supervision','Coin collection','Zone room supervision']),
  ('m10','Anubhuti',      '0010','9300000010',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Samuhik Kaksha support','Zone room supervision','Dinner queue supervision']),
  ('m11','Darshika',      '9483','9755049483',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Data & records coordination','Zone room supervision']),
  ('m12','Kalpana Didi',  '2256','9340672256',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Night duty (girls)','Zone night supervision']),
  ('m13','Sapna Didi',    '2365','9009852365',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Breakfast supervision','Lunch supervision','Dinner supervision']),
  ('m14','Shuchi Didi',   '0014','9300000014',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Early Riser room round (girls)','Zone room supervision']),
  ('m15','Bharati Didi',  '1514','7879471514',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Morning Puja support','Bhakti support (girls)']),
  ('m16','Ritu Ji',       '2899','7999442899',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Khojooge To Paoge support','Zone support']),
  ('m17','Ashi Ji',       '0017','9300000017',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Student welfare & sick bay (girls)','Zone support']),
  ('m18','Smita Bhabhi',  '7324','9424327324',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Coin distribution morning','Lunch supervision']),
  ('m19','Richa Bhabhi',  '2209','9691912209',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Coin collection morning','Zone support']),
  ('m20','Neha Didi',     '7515','9630157515',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Yoga support (girls)','Zone support']),
  ('m21','Surbhi Bhabhi', '1000','7725071000',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Lunch queue supervision (day)','Zone midday supervision']),

  -- Male mentors (no per-session class)
  ('m22','Aayush',        '5882','8989525882',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Class support (boys)','Coin distribution','Zone room supervision']),
  ('m23','Prince',        '0260','9109750260',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Early Riser monitor (boys)','Zone room supervision']),
  ('m24','Soham',         '9894','7999849894',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Yoga supervision (boys)','Zone room supervision']),
  ('m25','Tanmay',        '0943','8602810943',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Morning Puja support (boys)','Zone room supervision']),
  ('m26','Om',            '8349','9755818349',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Class support (boys)','Coin distribution']),
  ('m27','Parv (G1)',     '4394','8085904394',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Bhakti supervision (boys)','Zone support']),
  ('m28','Aagam',         '4791','9244594791',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Samuhik Kaksha (boys)','Khojooge To Paoge (boys)']),
  ('m29','Vishal',        '8203','8815088203',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Bhakti supervision (boys)','Coin collection']),
  ('m30','Parv (G2)',     '9971','9244019971',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Class support (afternoon, boys)','Zone room supervision']),
  ('m31','Abhas Jain',    '0162','9201330162',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Meal supervision (boys)','Zone room supervision']),
  ('m32','Veer',          '0465','9111100465',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Coin distribution (boys)','Early Riser support (boys)']),
  ('m33','Reet',          '0812','8827130812',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Night duty (boys)','Zone night supervision']),
  ('m34','Harsh',         '9009','9424699009',array['Zone Mentor'],'Zone Duty','',array[]::text[],'{}'::jsonb,false,array['Emergency coordinator','Medical liaison & first aid']);
