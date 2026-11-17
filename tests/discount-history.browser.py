# Localhost mock-only Playwright regression. Use --late-error for the HTTP500 variant.
import argparse,json,sys,tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('--output-dir',default=str(Path(tempfile.gettempdir())/'admin-history-race'));parser.add_argument('--late-error',action='store_true');args=parser.parse_args();out=Path(args.output_dir);out.mkdir(parents=True,exist_ok=True);checks=[];calls=[];fail={'history':False,'disable':False}
pending=[]
rows=[dict(id='1',code='AUDIT',name='Synthetic',kind='percentage',value=1000,status='draft',max_redemptions=2,redemptions_used=0)]
rows.append({**rows[0],'id':'2','code':'SECOND'})
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);c=b.new_context(viewport={'width':1280,'height':900});c.add_init_script("localStorage.setItem('access_token','synthetic-audit')")
 def route(r):
  u=r.request.url;m=r.request.method
  if u.startswith('http://127.0.0.1:3497'):return r.continue_()
  if not u.startswith('http://127.0.0.1:3499'):return r.abort()
  calls.append({'method':m,'url':u,'body':r.request.post_data});v={};status=200
  if u.endswith('/users/me'):v=dict(id='audit',email='audit@example.invalid',role='superadmin',is_active=True,is_verified=True)
  elif '/admin/discounts' in u:
   if u.endswith('/redemptions'):
    if '/1/' in u:pending.append(r);return
    v=[{'user_id':'USER_B','redeemed_at':'2026-11-17T00:00:00Z'}]
    if fail['history']:status=500;v={'detail':'Synthetic history unavailable'}
   elif m=='PATCH':rows[0].update(r.request.post_data_json);v=rows[0]
   elif m=='DELETE':
    if fail['disable']:status=500;v={'detail':'Synthetic disable failure'}
    else:rows[0]['status']='disabled';v=rows[0]
   else:v=rows
  return r.fulfill(status=status,json=v)
 c.route('**/*',route);page=c.new_page();page.goto('http://127.0.0.1:3497/discounts');page.get_by_role('button',name='New Discount').wait_for()
 page.locator('button[title="View Redemptions"]').first.click();page.wait_for_timeout(100);page.get_by_role('button',name='Close',exact=True).click();page.locator('button[title="View Redemptions"]').nth(1).click();page.wait_for_timeout(200)
 for r in pending:r.fulfill(status=500 if args.late_error else 200,json={'detail':'STALE_A_FAILURE'} if args.late_error else [{'user_id':'USER_A','redeemed_at':'2026-11-17T00:00:00Z'}])
 page.wait_for_timeout(200);body=page.locator('body').inner_text();checks.append({'case':'late A history cannot overwrite B','pass':bool(pending) and 'USER_A' not in body and 'STALE_A_FAILURE' not in body and 'USER_B' in body,'body':body});page.screenshot(path=str(out/'history-race.png'),full_page=True)
 b.close()
(out/'history-race-results.json').write_text(json.dumps({'checks':checks,'calls':calls},indent=2));print(json.dumps(checks,indent=2))

sys.exit(1 if any(not c['pass'] for c in checks) else 0)
