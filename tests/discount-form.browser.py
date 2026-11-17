# Run with a localhost-only admin dev server configured for API_URL below.
# Requires Python Playwright and Chromium. Every API request is intercepted.
# Example: python tests/discount-form.browser.py --output-dir C:/audit/admin
import argparse,json,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser()
parser.add_argument('--base-url', default='http://127.0.0.1:3497')
parser.add_argument('--api-url', default='http://127.0.0.1:3499')
parser.add_argument('--output-dir', default=str(Path(tempfile.gettempdir())/'offerlyiq-admin-promo-browser'))
args=parser.parse_args()
if not all(url.startswith('http://127.0.0.1:') for url in (args.base_url,args.api_url)):
 parser.error('Only isolated localhost URLs are allowed')
out=Path(args.output_dir); out.mkdir(parents=True,exist_ok=True); checks=[]; captured=[]
rows=[dict(id='1',code='EXHAUSTED',name='Exhausted',kind='percentage',value=1000,status='active',max_redemptions=2,redemptions_used=2),dict(id='2',code='LEGACY',name='Uncapped legacy',kind='flat',currency_code='USD',value=100,status='active',max_redemptions=None,redemptions_used=0)]
def check(name,ok,detail=None):
 checks.append(dict(name=name,passed=bool(ok),detail=detail)); print(json.dumps(checks[-1]),flush=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True); c=b.new_context(viewport={'width':1440,'height':1000}); c.add_init_script("localStorage.setItem('access_token','synthetic-admin')")
 def route(r):
  u=r.request.url;m=r.request.method
  if u.startswith(args.api_url+'/'):
   v={}
   if u.endswith('/users/me'):v=dict(id='x',email='audit@example.invalid',role='superadmin',is_active=True,is_verified=True)
   elif '/admin/discounts' in u:
    if m in ['POST','PATCH','DELETE']:
     body=r.request.post_data_json if m!='DELETE' else {};captured.append(dict(method=m,url=u,body=body));v=dict(body,id='new')
    elif u.endswith('/redemptions'):v=[]
    else:v=rows
   r.fulfill(status=200,content_type='application/json',body=json.dumps(v),headers={'Access-Control-Allow-Origin':'*'});return
  if u.startswith(args.base_url+'/'):r.continue_()
  else:r.abort()
 c.route('**/*',route);page=c.new_page();page.goto(args.base_url+'/discounts');page.get_by_role('button',name='New Discount').wait_for(timeout=90000)
 def create(kind,amount,cap,cur='USD'):
  page.get_by_role('button',name='New Discount').click();page.get_by_placeholder('e.g. SUMMER50').fill('TEST');page.get_by_placeholder('e.g. Summer Sale').fill('Test');page.locator('select').select_option(kind);page.locator('input[type=number]').nth(0).fill(amount);page.locator('input[type=number]').nth(1).fill(cap)
  if kind=='flat':page.get_by_placeholder('e.g. USD').fill(cur)
  n=len(captured);page.get_by_role('button',name='Create Discount',exact=True).click();page.wait_for_timeout(200);return n
 for label,kind,amount,cap in [('fractional money cap','percentage','10','1.5'),('negative bonus cap','bonus_credits','5','-1'),('database cap overflow','percentage','10','2147483648'),('precision lost in parseFloat','flat','1.00000000000000001','10'),('tiny percent rounds to zero','percentage','0.0000000001','10')]:
  n=create(kind,amount,cap);check(label,len(captured)==n,captured[n:]);
  if page.get_by_role('button',name='Cancel',exact=True).count():page.get_by_role('button',name='Cancel',exact=True).click()
 page.locator('button[title="Edit Discount"]').first.click();page.locator('select').select_option('disabled');n=len(captured);page.get_by_role('button',name='Save Changes').click();page.wait_for_timeout(200);check('disable exhausted unchanged cap',len(captured)==n+1 and captured[n]['body']=={'status':'disabled'},captured[n:]);page.screenshot(path=str(out/'edit-regression.png'))
 if page.get_by_role('button',name='Cancel',exact=True).count():page.get_by_role('button',name='Cancel',exact=True).click()
 page.locator('button[title="Edit Discount"]').nth(1).click();page.locator('select').select_option('disabled');n=len(captured);page.get_by_role('button',name='Save Changes').click();page.wait_for_timeout(200);check('disable legacy uncapped without editing cap',len(captured)==n+1 and captured[n]['body']=={'status':'disabled'},captured[n:])
 b.close()
out.joinpath('browser-regression.json').write_text(json.dumps(checks,indent=2));sys.exit(1 if any(not x['passed'] for x in checks) else 0)

