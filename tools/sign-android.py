#!/usr/bin/env python3
"""Finalize a CI unsigned APK with the original intro and the durable private key.
Secrets are supplied by file paths, never arguments containing passwords.
"""
import argparse,hashlib,pathlib,shutil,subprocess,tempfile,zipfile
p=argparse.ArgumentParser()
for name in ['input','gif','keystore','password_file','apksigner','output']:p.add_argument('--'+name.replace('_','-'),required=True,type=pathlib.Path)
a=p.parse_args()
assert a.input.resolve()!=a.output.resolve(),'Use a separate output file'
assert hashlib.sha256(a.gif.read_bytes()).hexdigest()=='27e7369883ef803b91693e272a928f1384220e3aece1caaacac8e7866fc66897','The original IntroK.gif is required'
with tempfile.TemporaryDirectory(prefix='pikeo-sign-') as t:
 t=pathlib.Path(t);unsigned=t/'unsigned.apk';shutil.copyfile(a.input,unsigned)
 with zipfile.ZipFile(unsigned,'a',compression=zipfile.ZIP_DEFLATED) as z:
  assert 'assets/public/assets/IntroK.gif' not in z.namelist(),'Intro already present: use the clean CI artifact'
  assert not any(n.endswith('.jks') or 'password.txt' in n for n in z.namelist())
  z.write(a.gif,'assets/public/assets/IntroK.gif')
 # apksigner consumes file lines; use separate files for the same store/key password.
 store=t/'store.txt';key=t/'key.txt'
 for x in [store,key]:x.write_bytes(a.password_file.read_bytes().rstrip(b'\r\n')+b'\n');x.chmod(0o600)
 subprocess.run(['java','-jar',str(a.apksigner),'sign','--ks',str(a.keystore),'--ks-key-alias','pikeo-release','--ks-pass','file:'+str(store),'--key-pass','file:'+str(key),'--out',str(a.output),str(unsigned)],check=True)
 r=subprocess.run(['java','-jar',str(a.apksigner),'verify','--verbose','--print-certs',str(a.output)],check=True,capture_output=True,text=True)
 assert '9d275a9de89f2a96ebce3b27655c29373d3a5d188c5ed442dff6e4d71f521c73' in r.stdout,'Unexpected signing certificate'
 print(r.stdout);print('APK SHA-256:',hashlib.sha256(a.output.read_bytes()).hexdigest())
